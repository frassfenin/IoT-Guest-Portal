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
import { OnOffCluster, LevelControlCluster, ColorControlCluster } from '@project-chip/matter.js/cluster';
import { NodeId } from '@project-chip/matter.js/datatype';

// Force Matter Node IDs to be within 32-bit range (1000 - 999999)
// to fix firmware bugs (e.g. Nanoleaf) where 64-bit Node IDs trigger "addNoc: 5" (InvalidNodeId)
NodeId.randomOperationalNodeId = () => {
  const min = 1000;
  const max = 999999;
  return NodeId(BigInt(Math.floor(Math.random() * (max - min + 1)) + min));
};

// Color conversions for Matter (which uses 0-254 for Hue and Saturation)
function hexToHsv(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else if (max === b) {
    h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;

  return {
    hue: Math.round((h / 360) * 254),
    saturation: Math.round(s * 254)
  };
}

function hsvToHex(matterHue, matterSat) {
  const h = (matterHue * 360) / 254;
  const s = matterSat / 254;
  const v = 1.0; // Assume full brightness for the color picker display

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h <= 360) {
    r = c; g = 0; b = x;
  }

  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

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

        // ColorControl Cluster (RGB color & temperature)
        const colorClient = node.getClusterClientForDevice(parsed.endpointId, ColorControlCluster);
        let colorAttr = undefined;
        let colorTempMireds = undefined;
        let minMireds = undefined;
        let maxMireds = undefined;

        if (colorClient) {
          if (colorClient.attributes.currentHue && colorClient.attributes.currentSaturation) {
            const hueVal = await colorClient.attributes.currentHue.get();
            const satVal = await colorClient.attributes.currentSaturation.get();
            if (hueVal !== undefined && satVal !== undefined) {
              colorAttr = hsvToHex(hueVal, satVal);
            }
          }

          if (colorClient.attributes.colorTemperatureMireds) {
            const tempVal = await colorClient.attributes.colorTemperatureMireds.get();
            if (tempVal !== undefined) {
              colorTempMireds = tempVal;
            }
            if (colorClient.attributes.colorTempPhysicalMinMireds) {
              minMireds = await colorClient.attributes.colorTempPhysicalMinMireds.get();
            }
            if (colorClient.attributes.colorTempPhysicalMaxMireds) {
              maxMireds = await colorClient.attributes.colorTempPhysicalMaxMireds.get();
            }
          }
        }

        states.push({
          entity_id: d.entity_id,
          state,
          attributes: {
            brightness,
            friendly_name: d.name,
            ...(colorAttr !== undefined && { color: colorAttr }),
            ...(colorTempMireds !== undefined && { color_temp: colorTempMireds }),
            ...(minMireds !== undefined && { min_mireds: minMireds }),
            ...(maxMireds !== undefined && { max_mireds: maxMireds }),
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

      // Färg (RGB) och färgtemperatur (color_temp)
      const colorClient = node.getClusterClientForDevice(parsed.endpointId, ColorControlCluster);
      if (colorClient) {
        if (changes.color !== undefined && colorClient.attributes.currentHue) {
          const { hue, saturation } = hexToHsv(changes.color);
          await colorClient.commands.moveToHueAndSaturation({
            hue,
            saturation,
            transitionTime: 0,
            optionsMask: {},
            optionsOverride: {}
          });
        }

        if (changes.color_temp !== undefined && colorClient.attributes.colorTemperatureMireds) {
          await colorClient.commands.moveToColorTemperature({
            colorTemperatureMireds: Math.round(changes.color_temp),
            transitionTime: 0,
            optionsMask: {},
            optionsOverride: {}
          });
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

        const emitState = async () => {
          try {
            const [s] = await this.getStates([d]);
            if (s) {
              io.emit('state_changed', {
                entity_id: d.entity_id,
                state: s,
              });
            }
          } catch (err) {
            console.warn(`⚠️ Kunde inte skicka realtidsuppdatering för ${d.name}:`, err.message);
          }
        };

        // Prenumerera på On/Off statusförändringar
        const onOffClient = node.getClusterClientForDevice(parsed.endpointId, OnOffCluster);
        if (onOffClient) {
          onOffClient.attributes.onOff.addListener(async () => {
            await emitState();
          });
          // Etablera prenumeration mot enheten (min 0s, max 60s)
          onOffClient.attributes.onOff.subscribe(0, 60).catch(err => {
            console.warn(`⚠️ Kunde inte prenumerera på OnOff för ${d.name}:`, err.message);
          });
        }

        // Prenumerera på ljusstyrkeförändringar
        const levelClient = node.getClusterClientForDevice(parsed.endpointId, LevelControlCluster);
        if (levelClient) {
          levelClient.attributes.currentLevel.addListener(async () => {
            await emitState();
          });
          // Etablera prenumeration mot enheten (min 0s, max 60s)
          levelClient.attributes.currentLevel.subscribe(0, 60).catch(err => {
            console.warn(`⚠️ Kunde inte prenumerera på ljusstyrka för ${d.name}:`, err.message);
          });
        }

        // Prenumerera på färg och färgtemperatur
        const colorClient = node.getClusterClientForDevice(parsed.endpointId, ColorControlCluster);
        if (colorClient) {
          if (colorClient.attributes.currentHue) {
            colorClient.attributes.currentHue.addListener(async () => {
              await emitState();
            });
            colorClient.attributes.currentHue.subscribe(0, 60).catch(err => {
              console.warn(`⚠️ Kunde inte prenumerera på färgton (hue) för ${d.name}:`, err.message);
            });
          }
          if (colorClient.attributes.currentSaturation) {
            colorClient.attributes.currentSaturation.addListener(async () => {
              await emitState();
            });
            colorClient.attributes.currentSaturation.subscribe(0, 60).catch(err => {
              console.warn(`⚠️ Kunde inte prenumerera på mättnad (sat) för ${d.name}:`, err.message);
            });
          }
          if (colorClient.attributes.colorTemperatureMireds) {
            colorClient.attributes.colorTemperatureMireds.addListener(async () => {
              await emitState();
            });
            colorClient.attributes.colorTemperatureMireds.subscribe(0, 60).catch(err => {
              console.warn(`⚠️ Kunde inte prenumerera på färgtemperatur för ${d.name}:`, err.message);
            });
          }
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
