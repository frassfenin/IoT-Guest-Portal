# Changelog

All notable changes to the Local Standalone Guest Portal will be documented in this file.

---

## [1.2.0] - 2026-05-26
### Added
- Proactive local database Git protection: Added `server/data/` (Matter commissioned fabrics and controller cache) to `.gitignore` to prevent leaking local network keys.
- Cleaned up potential UUID credentials from sample template files (`.env.example`).

### Removed
- **Google Assistant Embedded SDK integration**: Completely removed the deprecated embedded OAuth2, connection tests, and command exchange routes due to Google retiring the Embedded Assistant API (returning 404).
- **Nanoleaf Local OpenAPI integration**: Pruned all SSDP discovery, local pairing, and light endpoints to streamline backend bridges and reduce local SSDP multicast traffic.

---

## [1.1.0] - 2026-05-26
### Added
- **Direct Matter Protocol Support**: Native integration with `@project-chip/matter.js` and `@project-chip/matter-node.js`.
- Act as a local **Matter Commissioner & Controller**:
  - Uncommissioned Matter device discovery on the local network via mDNS (`_matterc._udp`).
  - Secure local node commissioning using manual 11-digit or 21-digit setup PIN-codes.
  - Persistent operational fabric key storage under `server/data/matter-store`.
  - Descriptor client parsing to map endpoints to light bulb or smart plug entities.
  - Real-time attribute subscription updates (`OnOff` / `LevelControl` brightness states) using Matter subscription listeners rather than legacy polling.

---

## [1.0.0] - 2026-05-15
### Added
- **Core Guest Portal Web Application**: Premium dark glassmorphism layout optimized for mobile screens, foldable layouts (Pixel Fold / Pixel 10 Pro Fold), and desktop displays.
- **Dynamic Setup Wizard**: Step-by-step first-run configuration helper that auto-saves credentials in `runtime-config.json` and skips steps for unselected services.
- **Kanban Room Organizer**: Drag-and-drop room planner to organize home lights and smart plugs into dedicated rooms, with touch-friendly mobile fallback.
- **Philips Hue Bridge**: Direct local integration with Hue Bridge v2 API, using Server-Sent Events (SSE) for instant two-way state synchronization.
- **IKEA Home Smart**: Dual integration covering both the modern **IKEA Dirigera Hub** (local OAuth/PKCE authorization) and legacy **IKEA Trådfri Gateway** (CoAP/DTLS).
- **Govee Lights**: Cloud OpenAPI state control with automatic fallback to older Developer APIs.
- **Google Cast**: Raw TLS socket connection over port 8009 for quick play/pause/stop controlling of Google Streamers, Chromecasts, and Nest speakers.
- **Auto-generated Scenes**: Automated generation of standard lighting profiles (*Mysigt*, *Läsning*, *God natt*, *Välkommen*) across all active bridges.
