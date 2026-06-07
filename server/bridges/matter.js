// ============================================================
//  Matter Bridge – Direkt lokal Matter-styrning via matter.js
//  Fil: server/bridges/matter.js
//
//  Implementerar Matter-protokollet lokalt över LAN (mDNS)
//  som en CommissioningController.
// ============================================================
import '@project-chip/matter-node.js';
import { StorageBackendDisk } from '@project-chip/matter-node.js/storage';
import { MatterServer, CommissioningController } from '@project-chip/matter.js';
import { StorageManager } from '@project-chip/matter.js/storage';
import { OnOffCluster, LevelControlCluster } from '@project-chip/matter.js/cluster';
import { NodeId } from '@project-chip/matter.js/datatype';

// Force Matter Node IDs to be within 32-bit range (1000 - 999999)
// to fix firmware bugs (e.g. Nanoleaf) where 64-bit Node IDs trigger "addNoc: 5" (InvalidNodeId)
NodeId.randomOperationalNodeId = () => {
  const min = 1000;
  const max = 999999;
  return NodeId(BigInt(Math.floor(Math.random() * (max - min + 1)) + min));
};

export class MatterBridge {
  constructor({ storagePath = 'server/data/matter-store' } = {}) {
    this.enabled = true;
    this.storagePath = storagePath;
    this.server = null;
    this.controller = null;
    this.initialized = false;
    this.initPromise = this._init();
    MatterBridge.activeInstance = this;
  }

  async _init() {
    try {
      console.log('🧱 Matter: Initierar lagring...');
      this.storageBackend = new StorageBackendDisk(this.storagePath);
      this.storageManager = new StorageManager(this.storageBackend);
      await this.storageManager.initialize();

      console.log('🧱 Matter: Startar MatterServer...');
      this.server = new MatterServer(this.storageManager);

      console.log('🧱 Matter: Konfigurerar CommissioningController...');
      this.controller = new CommissioningController({
        autoConnect: true,
        adminFabricLabel: "Gästportal Matter",
      });

      this.server.addCommissioningController(this.controller);
      await this.server.start();

      this.initialized = true;
      console.log('🧱 Matter: Lokal controller startad och redo!');
    } catch (err) {
      console.error('❌ Matter Bridge initieringsfel:', err.message);
      this.enabled = false;
    }
  }

  async _ensureInitialized() {
    await this.initPromise;
  }

  // Parses entity_id formatted as: matter_<nodeId>_<endpointId>
  _parseEntityId(entityId) {
    const parts = entityId.split('_');
    if (parts.length < 3) return null;
    return {
      nodeId: parts[1],
      endpointId: parseInt(parts[2], 10),
    };
  }

  async getStates(deviceConfigs) {
    await this._ensureInitialized();
    if (!this.enabled || !this.controller) return [];

    const states = [];
    for (const d of deviceConfigs) {
      const parsed = this._parseEntityId(d.entity_id);
      if (!parsed) continue;

      try {
        const node = await this.controller.getNode(NodeId(BigInt(parsed.nodeId)));
        
        let state = 'off';
        let brightness = 255;

        // OnOff Cluster
        const onOffClient = node.getClusterClientForDevice(parsed.endpointId, OnOffCluster);
        if (onOffClient) {
          const onVal = await onOffClient.attributes.onOff.get();
          state = onVal ? 'on' : 'off';
        }

        // LevelControl Cluster (Brightness)
        const levelClient = node.getClusterClientForDevice(parsed.endpointId, LevelControlCluster);
        if (levelClient) {
          const levelVal = await levelClient.attributes.currentLevel.get();
          if (levelVal !== undefined && levelVal !== null) {
            brightness = Math.round((levelVal / 254) * 255);
          }
        }

        states.push({
          entity_id: d.entity_id,
          state,
          attributes: {
            brightness,
            friendly_name: d.name,
          },
        });
      } catch (err) {
        // Enhet kan vara offline eller inte svara just nu
        states.push({
          entity_id: d.entity_id,
          state: 'unknown',
          attributes: {
            brightness: 128,
            friendly_name: d.name,
            error: err.message,
          },
        });
      }
    }
    return states;
  }

  async setLight(deviceConfig, changes) {
    await this._ensureInitialized();
    if (!this.enabled || !this.controller) return;

    const parsed = this._parseEntityId(deviceConfig.entity_id);
    if (!parsed) return;

    try {
      console.log(`🧱 Matter: Kontrollerar node ${parsed.nodeId} endpoint ${parsed.endpointId}`);
      const node = await this.controller.getNode(NodeId(BigInt(parsed.nodeId)));

      // On/Off Kontroll
      if (changes.state !== undefined) {
        const onOffClient = node.getClusterClientForDevice(parsed.endpointId, OnOffCluster);
        if (onOffClient) {
          if (changes.state === 'on') {
            await onOffClient.on();
          } else {
            await onOffClient.off();
          }
        }
      }

      // Ljusstyrka (Brightness)
      if (changes.brightness !== undefined) {
        const levelClient = node.getClusterClientForDevice(parsed.endpointId, LevelControlCluster);
        if (levelClient) {
          const level = Math.round((changes.brightness / 255) * 254);
          await levelClient.moveToLevel({ level, transitionTime: 0, optionsMask: {}, optionsOverride: {} });
        }
      }
    } catch (err) {
      console.error(`❌ Matter setLight fel för "${deviceConfig.name}":`, err.message);
      throw err;
    }
  }

  async startRealtime(io, deviceConfigs) {
    await this._ensureInitialized();
    if (!this.enabled || !this.controller) return;

    console.log('🧱 Matter: Startar realtidslyssnare...');

    for (const d of deviceConfigs) {
      const parsed = this._parseEntityId(d.entity_id);
      if (!parsed) continue;

      try {
        const node = await this.controller.getNode(NodeId(BigInt(parsed.nodeId)));

        // Prenumerera på On/Off statusförändringar
        const onOffClient = node.getClusterClientForDevice(parsed.endpointId, OnOffCluster);
        if (onOffClient) {
          onOffClient.attributes.onOff.addListener(async (onVal) => {
            const levelClient = node.getClusterClientForDevice(parsed.endpointId, LevelControlCluster);
            let brightness = 255;
            if (levelClient) {
              const lvl = await levelClient.attributes.currentLevel.get();
              brightness = Math.round((lvl / 254) * 255);
            }

            io.emit('state_changed', {
              entity_id: d.entity_id,
              state: {
                entity_id: d.entity_id,
                state: onVal ? 'on' : 'off',
                attributes: {
                  brightness,
                  friendly_name: d.name,
                },
              },
            });
          });
          // Etablera prenumeration mot enheten (min 0s, max 60s)
          onOffClient.attributes.onOff.subscribe(0, 60).catch(err => {
            console.warn(`⚠️ Kunde inte prenumerera på OnOff för ${d.name}:`, err.message);
          });
        }

        // Prenumerera på ljusstyrkeförändringar
        const levelClient = node.getClusterClientForDevice(parsed.endpointId, LevelControlCluster);
        if (levelClient) {
          levelClient.attributes.currentLevel.addListener(async (levelVal) => {
            const onOffClient = node.getClusterClientForDevice(parsed.endpointId, OnOffCluster);
            let state = 'on';
            if (onOffClient) {
              const onVal = await onOffClient.attributes.onOff.get();
              state = onVal ? 'on' : 'off';
            }

            io.emit('state_changed', {
              entity_id: d.entity_id,
              state: {
                entity_id: d.entity_id,
                state,
                attributes: {
                  brightness: Math.round((levelVal / 254) * 255),
                  friendly_name: d.name,
                },
              },
            });
          });
          // Etablera prenumeration mot enheten (min 0s, max 60s)
          levelClient.attributes.currentLevel.subscribe(0, 60).catch(err => {
            console.warn(`⚠️ Kunde inte prenumerera på ljusstyrka för ${d.name}:`, err.message);
          });
        }
      } catch (err) {
        console.warn(`⚠️ Kunde inte binda realtidsprenumeration för ${d.name}:`, err.message);
      }
    }
  }

  async destroy() {
    console.log('🔌 Stänger Matter Bridge...');
    if (MatterBridge.activeInstance === this) {
      MatterBridge.activeInstance = null;
    }
    try {
      if (this.server) {
        await this.server.close();
      }
    } catch (err) {
      console.error('Fel vid stängning av Matter Server:', err.message);
    }
  }
}
