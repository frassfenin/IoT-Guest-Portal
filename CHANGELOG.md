# Changelog

All notable changes to the Local Standalone Guest Portal will be documented in this file.

---

## [0.5.0] - 2026-06-07
### Added
- **Docker-support**: Det går nu att installera och köra gästportalen i en Docker-container.
- **Produktionsservering**: Express-servern serverar nu den kompilerade klienten (`client/dist`) automatiskt när den körs i produktion.
- **GitHub-länk**: En direktlänk till GitHub-projektet (`https://github.com/frassfenin/IoT-Guest-Portal`) längst ner i inställningsmenyn med en skräddarsydd SVG-ikon.

### Changed
- **Organisera rum & lampor (Master-Detail)**: Byggt om rumsorganisatören från grunden med en modern split-pane Master-Detail-layout för widescreen/desktop/foldables, samt ett responsivt slide-in-flöde för mobiler som ersätter det gamla Kanban-gränssnittet.
- **Glassmorfisk inställningsknapp**: Designat om inställningsknappen med en skandinavisk glassmorfisk stil (semi-transparent vit bakgrund, tunn kant, mjuk skugga och subtil hover-effekt med snurrande kugghjul).

### Fixed
- **Prestanda & Firefox-skroll**: Optimerat bakgrundsblobar genom att flytta `border-radius` ut ur keyframe-animationer till statiska klasser, tagit bort överflödiga `backdrop-filter` och skiftat till GPU-accelererad `translate3d`-transformering för att lösa trögt scrollande ("sluggishness") på mobiler och foldables i Firefox.
- **Layout-låsning på mobil**: Åtgärdat en bugg där gästportalen ibland visade en tom skärm på mobila enheter på grund av felaktiga kolumn-visningslägen.
- **Överflöde på mobiler (LightCard Overflow)**: Ändrat rutnätets kolumner från `150px` till `220px` för att tvinga fram en ren och luftig enkelkolumn på mobilskärmar istället för att lampkorten trycks ihop och flödar ut ur sina boxar. Lagt till flexbox-baserad texttrunkering på namn och status.

---

## [0.4.0] - 2026-05-29
### Changed
- **Skandinavisk Minimalism Redesign (Desktop & Global)**:
  - Genomfört en total visuell och strukturell omvandling av gränssnittet till ett ljus minimalistiskt tema med dämpade pastellbakgrunder.
  - Flyttat rums- och belysningskontrollerna front and center på desktop.
  - Ersatt den gamla tab-baren och informationspanelen med en flytande bottenmeny (Dock-bar) innehållande popup-bubblor (popovers) för WiFi-inloggning, husanteckningar och systemstatus.
  - Implementerat en lila inställningsdropdown uppe till höger med snabbval till inställningsguiden och rumsorganisatören.
  - Skapat ultratunna (3px) reglage för ljusstyrka och färgtemperatur för en renare visuell profil.
- **Levande Bakgrundsblobar & Premium Glasdesign**:
  - Lagt till en fjärde pastell-lavendelblobb i bakgrunden för rikare färgdjup som harmoniserar med den lila inställningsknappen.
  - Implementerat super-dynamisk, morfkraftig keyframe-animering av blobarnas `border-radius`, rotation, skala och position (organisk lavalampa-effekt).
  - Skärpt konturerna på bakgrundsblobarna (blur 80px, opacitet 52%) och bytt blend mode till `normal` för krispigare pasteller i ljust läge.
  - Uppgraderat `.room-section` och `.light-card` med ökad transparens, kraftigare `backdrop-filter: blur(20px)` och saturerande färggenomsläpp (`saturate(160%)` till `saturate(170%)`) så att blobarna färgar av sig på glaset när de glider under dem.
  - Skapat lysande varma glasgradienter (`linear-gradient`) för aktiva ljuskort (`.light-card--on` med `saturate(180%)`) och ett exklusivt indigo-blått glaskort för spelande mediespelare (`.media-card--playing`).
  - Lagt till lyxig taktil 3D hover-övergång (`transform: translateY(-2px)`) med spring-kurvor på alla ljus- och mediekort.
- **Modernisering av Ikoner till Lucide React**:
  - Helt utraderat alla operativsystemsberoende och stela emojis i gränssnittet till förmån för enhetliga outline-vektorer från **Lucide React**.
  - Utrustat den lila inställningsknappen med en rotationsanimerad `<Settings />`-ikon (snurrar mjukt 90 grader på hover).
  - Integrerat outline-ikoner för alla dropdown-val och dock-knappar: `<Sparkles />` (Scener), `<Wifi />` (WiFi), `<FileText />` (Anteckningar/Husmanual) och `<Info />` (Status).
  - Implementerat intelligent enhetsdetektering: visar automatiskt `<Plug />` för eluttag och `<Lightbulb />` för lampor på ljuskorten, samt `<Cast />` (Chromecast), `<Tv />` eller `<Speaker />` på mediekorten baserat på dess profil.
  - Dimmer-reglagen har utrustats med knivskarpa vektorer för ljusstyrka (`<Sun />`) och färgtemperatur (`<Thermometer />`, `<Snowflake />`).
  - Skapat roterande vektorspinners (`<Loader2 />` med spin-keyframes) och framgångs-bockar (`<Check />`) för scener i SceneGrid under laddnings- och bekräftelseförlopp.
  - Ramat in manuella husanteckningsemojis i eleganta ikoncirklar (`.note-item__icon-wrap`) med subtila bakgrunder.

---

## [0.3.0] - 2026-05-26
### Added
- Proactive local database Git protection: Added `server/data/` (Matter commissioned fabrics and controller cache) to `.gitignore` to prevent leaking local network keys.
- Cleaned up potential UUID credentials from sample template files (`.env.example`).

### Removed
- **Google Assistant Embedded SDK integration**: Completely removed the deprecated embedded OAuth2, connection tests, and command exchange routes due to Google retiring the Embedded Assistant API (returning 404).
- **Nanoleaf Local OpenAPI integration**: Pruned all SSDP discovery, local pairing, and light endpoints to streamline backend bridges and reduce local SSDP multicast traffic.

---

## [0.2.0] - 2026-05-26
### Added
- **Direct Matter Protocol Support**: Native integration with `@project-chip/matter.js` and `@project-chip/matter-node.js`.
- Act as a local **Matter Commissioner & Controller**:
  - Uncommissioned Matter device discovery on the local network via mDNS (`_matterc._udp`).
  - Secure local node commissioning using manual 11-digit or 21-digit setup PIN-codes.
  - Persistent operational fabric key storage under `server/data/matter-store`.
  - Descriptor client parsing to map endpoints to light bulb or smart plug entities.
  - Real-time attribute subscription updates (`OnOff` / `LevelControl` brightness states) using Matter subscription listeners rather than legacy polling.

---

## [0.1.0] - 2026-05-15
### Added
- **Core Guest Portal Web Application**: Premium dark glassmorphism layout optimized for mobile screens, foldable layouts (Pixel Fold / Pixel 10 Pro Fold), and desktop displays.
- **Dynamic Setup Wizard**: Step-by-step first-run configuration helper that auto-saves credentials in `runtime-config.json` and skips steps for unselected services.
- **Kanban Room Organizer**: Drag-and-drop room planner to organize home lights and smart plugs into dedicated rooms, with touch-friendly mobile fallback.
- **Philips Hue Bridge**: Direct local integration with Hue Bridge v2 API, using Server-Sent Events (SSE) for instant two-way state synchronization.
- **IKEA Home Smart**: Dual integration covering both the modern **IKEA Dirigera Hub** (local OAuth/PKCE authorization) and legacy **IKEA Trådfri Gateway** (CoAP/DTLS).
- **Govee Lights**: Cloud OpenAPI state control with automatic fallback to older Developer APIs.
- **Google Cast**: Raw TLS socket connection over port 8009 for quick play/pause/stop controlling of Google Streamers, Chromecasts, and Nest speakers.
- **Auto-generated Scenes**: Automated generation of standard lighting profiles (*Mysigt*, *Läsning*, *God natt*, *Välkommen*) across all active bridges.
