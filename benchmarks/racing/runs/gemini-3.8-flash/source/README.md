# Riviera: Cinematic Coastal 3D Arcade Racer
**Racing-bench V2.6 — Standalone Implementation**

An original, polished, fully playable 3D arcade racing game running entirely client-side in a modern desktop browser. Built with Three.js (WebGL 2), TypeScript, Vite, Web Audio API, and non-database local persistence.

---

## 🚀 Quick Launch & Static Preview

### 1. Development Server
```bash
npm install
npm run dev
```
Open the displayed local URL (typically `http://localhost:5173`).

### 2. Static Production Build
```bash
npm run build
```
Compiles static HTML/CSS/JS bundles into `dist/`. No database, server-side APIs, or credentials required.

### 3. Static Preview
```bash
npm run preview
```
Serves the compiled `dist/` directory on `http://localhost:4173`. Can also be served by any generic static HTTP/HTTPS host (e.g. `npx serve dist`, Caddy, or Nginx).

### 4. Automated Testing
- **Unit and Regression Tests (Vitest):**
  ```bash
  npm test
  ```
- **Browser Acceptance Journeys (Playwright):**
  ```bash
  npm run test:e2e
  ```

---

## 🎮 Driving Controls (Fully Remappable)

| Action | Primary Default Key | Alternative Default |
| :--- | :--- | :--- |
| **Accelerate** | `W` | `Up Arrow` (`↑`) |
| **Brake / Reverse** | `S` | `Down Arrow` (`↓`) |
| **Steer Left** | `A` | `Left Arrow` (`←`) |
| **Steer Right** | `D` | `Right Arrow` (`→`) |
| **Drift / Handbrake** | `Spacebar` | — |
| **Nitro Boost** | `Left Shift` | `N` |
| **Recover Car** | `R` | — |
| **Pause Game** | `Escape` | `P` |
| **Toggle Photo Mode UI** | `H` | — |

*All primary driving keys can be rebound in **Settings & Keys** with real-time physical key detection (`KeyboardEvent.code`), collision/conflict detection, and reset-to-defaults.*

---

## 🌟 Game Modes & Dedicated Courses

1. **Coastal Sprint — Time Trial:**
   - 3 consecutive laps around a high-speed coastal highway hugging cliffs and azure beaches.
   - Authoritative lap timing, sequential checkpoint passing validation, shortcut/recovery invalidation.
   - Best valid single lap represents the session result and writes to local personal best records.
2. **Riviera Grand Prix — Race vs AI:**
   - 3-lap race against 5 concurrent AI rivals (6 cars total).
   - Weaves through a Mediterranean tourist village, across a stone bay bridge, and through an illuminated cliffside tunnel.
   - 3 fixed difficulty tiers (Easy, Normal, Hard) with zero rubber-banding.
3. **Horizon Rush — Checkpoint Run:**
   - Arcade time-attack pass through winding mountain ridges.
   - Urgency countdown timer replenished by passing ordered checkpoint gates (+14s bonus).
   - Dynamic combo multiplier rewarding high speed (>115 km/h), nitro, and long drifts.

---

## 🚗 Selectable Differentiated Cars

- **Riviera Spyder (Agile / Drift Specialist):** Open-top roadster, rapid turn-in, nimble steering, high drift angle tolerance, quick nitro replenishment.
- **Corsica GT (Balanced Grand Tourer):** Aerodynamic coupe with balanced weight distribution, high stability at speed, and predictable grip.
- **Monaco Hyperion (Speed Champion / Hypercar):** Low-slung wedge hypercar with explosive nitro thrust and unmatched straightaway velocity.

---

## 📷 Signature Feature: Riviera Photo Studio & Snapshot Suite

Accessible both in the **Pause Menu** during active racing and at any moment inside the **Replay Viewer**:
- **6-DOF Orbital/Drone Camera:** Freely orbit around the car with adjustable azimuth, elevation, distance, and Dutch tilt roll angle.
- **Optics & Focal Length:** Adjustable lens FOV (25° to 85°).
- **Coastal Color Grading Filters:** *Golden Hour*, *Retro Riviera 80s*, *Cyber Coastal*, *Monochrome Noir*, *Vivid Tropical*, and *Natural Clean*.
- **Postcard Borders & Badges:** Overlays authentic seaside racing typography ("Riviera Grand Prix", "Coastal Sprint", "Horizon Rush").
- **Local High-Res Snapshot Export:** Instant one-click capture generating a native PNG postcard directly to disk without external APIs or uploads.

---

## 📼 Replay Engine & 5-Slot Replay Vault

- Full recording of every race with player trajectory, 5 AI rivals, damage state, weather wetness, and daylight time.
- Direction-agnostic scrubber timeline: jumping forward or backward settles on the identical historical physical and visual damage state.
- 3 distinct camera perspectives: *Dynamic Chase*, *Bumper / Hood*, and *Trackside Broadcast TV*.
- Strict 5-slot local library: saved using OPFS (with localStorage fallback), export and import portable `.racingreplay` files.
- Strict record authenticity invariant: imported or replayed runs are stamped as imported and cannot write to personal best records.

---

## 🎨 Graphics Quality & Accessibility

- **Quality Presets:** Low (0.75x DPR, no shadows), Medium (1.0x DPR, standard shadows), High (native DPR up to 2.0x, PCF soft shadows, full particles & effects).
- **Procedural Web Audio API:** Dual-oscillator engine synth, tire screech bandpass filters, nitro roar, crash crunch, checkpoint chimes, and ambient coastal surf.
- **Reduced Motion Support:** Softens camera swings, disables high-frequency FOV leaps, and clamps camera shake.
