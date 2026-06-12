# Local Standalone Guest Portal for Smart Home Lighting

![App Startup Screen](assets/app-screenshot.png)

This project is a completely **standalone, local, and responsive guest portal** for smart home lighting and media players. It communicates directly with your physical gateways (Philips Hue, IKEA, Govee, Matter, and Google Cast) over the local area network (LAN) – **completely independent of external smart home platforms like Home Assistant**.

---

## Key Features

1. **Responsive Layout (Mobile, Foldable, Desktop)**:
   - A modern interface optimized for desktop displays, smartphones, tablets, and foldables.

2. **Setup Hub & Admin Panel**:
   - Access the setup views through the settings cog (`Inställningar (admin)`) in the header.
   - **Organize Rooms**: A touch-friendly Kanban-style organizer to create rooms, assign lights, and sort aliases.
   - **Configure Integrations**: Re-run the step-by-step setup guides to edit credentials without overwriting existing mappings.

3. **Passcode Protection & Client Isolation**:
   - **Admin Settings Login Overlay**: Access to the Setup Wizard is gated by a gorgeous, high-contrast glassmorphic login overlay. The passcode resolves dynamically from `runtime-config.json`, `.env` variables, or falls back to the default `1234`.
   - **Guest vs Admin Separation**: Guests can mapping lights to rooms or reorganize groups via a secure, public `POST /api/setup/save-rooms` route that bypasses authentication while preventing alterations to integration secrets.
   - **Account Settings (Konto)**: Change administrative passcodes and log out securely directly inside the Setup Wizard. For more details, refer to the [SECURITY.md](SECURITY.md) architecture outline.

4. **Dynamic Setup Wizard**:
   - Walks you through pairing and setting up integrations on first start.
   - **Integration Filters**: Select only the services you own (Hue, IKEA, Govee, Cast, Matter) – the stepper automatically filters unused steps and updates progress metrics accordingly.
   - **Real-Time Discovery**: Rescan and fetch newly paired lights at any time with a single click via `🔄 Search again` hooks.

5. **Direct Gateway Integrations (100% Local LAN)**:
   - **Matter Devices**: Built-in Matter commissioner and controller using `@project-chip/matter.js`. Scans unpaired devices via mDNS (`_matterc._udp`), pairs using pairing codes, and supports real-time brightness, RGB color, and color temperature controls.
   - **Philips Hue**: Direct local HTTP REST integration with Hue Bridge v2, receiving real-time state pushes via Server-Sent Events (SSE).
   - **IKEA Smart Home**: Full support for the newer **Dirigera Hub** (local REST API over HTTP with PKCE) and the older **Trådfri Gateway** (CoAP/DTLS), controlling lights, LED drivers, and smart plugs.
   - **Govee Lights**: Direct connection using Govee's modern **Cloud OpenAPI** or the legacy **Developer API** (automatically selected based on API key). Supports full color picker, temperature sliders, and auto-model capabilities.
   - **Google Cast**: Directly sends commands to Chromecast, Google Streamer, and smart speakers over raw TLS sockets on port 8009.

---

## Privacy & Credentials Protection

The project is structured to keep private network keys and secrets fully secure. The following directories and files are ignored by git via [`.gitignore`](.gitignore):
* `runtime-config.json` – Holds your gateway credentials, light mapping configurations, and WiFi variables.
* `server/data/` – Houses local Matter controller encryption keys, fabrics credentials, and connection metadata.
* `.env` – Host-specific environmental variables.
* `gastportal_qr.png` & `gastportal_kort.html` – Generated print layouts to invite guests onto your portal.

Refer to the [SECURITY.md](SECURITY.md) guidelines for full architectural details.

---

## Getting Started

### System Requirements
- Node.js (v18 or later)
- All gateways connected to the same Local Area Network (LAN)

### 1. Installation
Install project dependencies for both backend and frontend from the workspace root:
```bash
npm run install:all
```

### 2. Start the Development Server
Launch the backend server and Vite frontend concurrently:
```bash
npm run dev
```
- **Backend Server**: Starts on http://localhost:3001
- **Client App (Vite)**: Starts on http://localhost:5173

Open http://localhost:5173 in your browser to kick off the interactive Setup Wizard!

### 3. Build for Production
To build and optimize the React files for fast loading speeds in production environments:
```bash
npm run build
```
Start the production server:
```bash
npm run start
```
The portal runs on http://localhost:3001.

### 4. Interactive Code Graph
Generate a visual layout of the project file structure and imports:
```bash
npm run graphify
```
This builds a `graphify-out/graph.html` visualization file. You can access the visualizer through the Admin Settings menu or directly at http://localhost:3001/code-graph.

---

## Project Structure
- `server/`: Express backend code.
  - `server/bridges/`: Gateway API modules (`hue.js`, `ikea.js`, `govee.js`, `matter.js`, `cast.js`).
  - `server/setup.js`: API endpoints for pairing, resource scanning, and configurations.
  - `server/runtimeConfig.js`: Safe reads/writes to `runtime-config.json`.
  - `server/data/`: Matter controller persistence database (git-ignored).
- `client/`: React client code.
  - `client/src/components/setup/`: Setup Wizard views.
  - `client/src/components/RoomOrganizer.jsx`: Room organizer interface.
  - `client/src/index.css`: Glassmorphic styling system.
- `graphify-out/`: Generated visual graph outputs (git-ignored).

---

## Changelog
For a detailed release logs and history, refer to the [Changelog section](#changelog-history) below:

### Changelog History
* **v0.5.0**: Added admin passcode protection, LoginModal overlays, Account step 15, and dynamic passcode hint hiding. Implemented a secure, public endpoint to update room organization without exposing credentials.
* **v0.4.0**: Added Matter-light RGB color picker and color temperature sliders.
* **v0.3.0**: Upgraded IKEA Dirigera smart plug controls and device discovery.
* **v0.2.0**: Added Google Cast direct controls over LAN socket port 8009.
* **v0.1.0**: Initial release featuring Hue, IKEA, Govee integrations and room organizer.
