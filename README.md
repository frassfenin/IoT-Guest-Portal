# Lokal Standalone Gästportal för Smart Hem-belysning (Beta 0.1)

Detta projekt är en helt **fristående, lokal och responsiv gästportal** för smart hem-belysning och mediaspelare. Den kommunicerar direkt med dina fysiska broar (Philips Hue, IKEA, Govee, Matter och Google Cast) över det lokala nätverket – **helt utan externa smarta hem-plattformar som Home Assistant**.

---

## Huvudfunktioner

1. **Mobil-, Foldable- och Desktop-anpassad**:
   - En modern, responsiv layout med en glasmorfisk sidopanel på desktop/foldables, och en smidig navigeringsbar i botten på mobila enheter.
   
2. **Inställningshubb & Adminpanel**:
   - Öppnas via kugghjulet (`⚙️ Ändra rum`) i sidhuvudet.
   - **Organisera rum (Kanban Sorterare)**: Skapa nya rum och placera dina lampor i rätt rum. Stöder både drag-and-drop (med muspekare) och en touch-vänlig rullgardinsmeny på mobiler.
   - **Konfigurera enheter**: Kör om installationsguiden utan att skriva över befintliga inställningar (redigeringsläge).

3. **Dynamisk Installationsguide (Setup Wizard)**:
   - Vid första start (eller vid omkonfiguration) guidas du igenom parning av dina enheter.
   - **Tjänsteurval**: Bocka i precis vilka system du äger (Hue, IKEA, Govee, Cast, Matter) – guiden hoppar automatiskt över steg för oanvända tjänster, och progress-mätaren anpassas automatiskt.
   - **Realtids Sök igen-funktion**: Skanna av broar igen med ett klick via `🔄 Sök igen`-knappen för att hämta nyanslutna lampor utan att starta om.
   - **Smart Plugs & Uttag**: Hittar och styr både lampor, LED-drivers och smarta eluttag (t.ex. IKEA dirigera smart plugs och Matter plugs) på samma gång.

4. **Direct Bridge-integrationer (100% lokala nätverksbroar)**:
   - **Matter-enheter (Lokal)**: Inbyggd lokal Matter-commissioner och Controller (använder `@project-chip/matter.js`). Söker upp oparade enheter via mDNS (`_matterc._udp`) och parpar dem säkert med 11- eller 21-siffrig PIN-kod.
   - **Philips Hue**: Direkt kommunikation med Hue Bridge v2, med realtidsuppdateringar via Server-Sent Events (SSE).
   - **IKEA Smart Home**: Fullt stöd för både nya **Dirigera Hub** (lokalt REST API med PKCE) och äldre **Trådfri Gateway** (CoAP/DTLS), inklusive eluttag.
   - **Govee Lights**: Stöd för Govees moderna **Cloud OpenAPI** samt det äldre **Developer API** (valjs automatiskt baserat på API-nyckeln).
   - **Google Cast**: TLS-socketstyrning av Google Streamers, Chromecasts och smarta högtalare direkt över port 8009.

5. **Sömlös Hot-Reload & Resursrensning**:
   - Inbyggda `.destroy()`-kontroller för alla broar stänger ner DTLS-anslutningar, abortar SSE-eventströmmar och stoppar polling-timers direkt när konfigurationen sparas eller ändras, vilket eliminerar resursläckor och anslutningskonflikter.

---

## Säkerhet & GitHub-privacy

Projektet är konfigurerat för att hålla dina privata uppgifter helt skyddade om du laddar upp källkoden till GitHub. Följande filer och mappar ingår i [`.gitignore`](.gitignore) och laddas **aldrig** upp:
* `runtime-config.json` – Lagrar dina lokala bridge-API-nycklar, rumsuppdelningar och WiFi-lösenord.
* `server/data/` – Lagrar dina lokala Matter-enheters fabric-koder, anslutningsmetadata och krypteringsnycklar.
* `.env` – Eventuella lokala miljövariabler.
* `gastportal_qr.png` & `gastportal_kort.html` – Genererade utskriftskort till dina gäster.

---

## Kom igång

### Systemkrav
- Node.js (v18 eller senare)
- Enheter anslutna på samma lokala nätverk (LAN)

### 1. Installation
Ställ dig i projektets rotkatalog och installera alla beroenden för både server och frontend:
```bash
npm run install:all
```

### 2. Starta Utvecklingsservern
Kör servern och frontenden samtidigt i utvecklingsläge:
```bash
npm run dev
```
- **Backend-servern** startar på http://localhost:3001
- **Frontend-klienten (Vite)** startar på http://localhost:5173

Öppna http://localhost:5173 i din webbläsare för att starta den interaktiva installationsguiden!

### 3. Bygga för Produktion
För att kompilera och optimera frontenden för snabbast möjliga laddtid i produktion:
```bash
npm run build
```
Starta sedan produktionsservern:
```bash
npm run start
```
Portalen körs då på http://localhost:3001.

---

## Projektstruktur
- `server/`: Backend-kärnan i Node.js Express.
  - `server/bridges/`: Drivrutiner för enhetsbroarna (`hue.js`, `ikea.js`, `govee.js`, `matter.js`, `cast.js`).
  - `server/setup.js`: API-routerna för parning, testning och resursavsökning.
  - `server/runtimeConfig.js`: Säker hantering av `runtime-config.json` (skapas lokalt vid setup).
  - `server/data/`: Lokal databas för Matter-anslutningar (ignorerad av Git).
- `client/`: React-frontend byggd med Vite.
  - `client/src/components/setup/`: Den interaktiva installationsguiden.
  - `client/src/components/RoomOrganizer.jsx`: Kanban-sorteraren för rum.
  - `client/src/index.css`: Glassmorphism-designsystemet.
