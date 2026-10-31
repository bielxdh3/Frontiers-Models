# Signature Feature Scope Note: Riviera Photo Studio & Snapshot Suite

## 1. Feature Concept and Purpose
The **Riviera Photo Studio & Snapshot Suite** is a dedicated cinematic photo mode accessible both during active race pause and at any moment within the replay viewer. It allows players to freeze any high-speed drift, sunset coastal jump, or dramatic pack collision, decouple into a smooth 6-DOF orbital/drone camera, apply coastal cinematic grading filters, adjust lens focal length and depth-of-field styling, overlay stylized coastal badges/postcards, and export high-resolution PNG screenshots locally.

## 2. Interactions with Existing Systems
- **Simulation Engine:** Freezes vehicle dynamics, particle emitters, damage states, and race timers with zero state drift or physics leakage.
- **Three.js Scene & Renderer:** Decouples from chase/replay cameras into an independent smooth drone/orbit camera; renders custom post-processing color grading (Golden Hour, Riviera 80s, Cyber Coastal, Noir, Vivid Tropical) and framing borders.
- **Replay Timeline:** Can be launched from any scrubbed timestamp across all three cameras in the replay viewer, faithfully capturing the exact historic damage, opponent positions, and dynamic weather at that millisecond.
- **UI & Input Management:** Provides clean, intuitive studio sliders (FOV, Roll, Height, Filter, Exposure, Postcard Stamp) with an auto-hide HUD mode (`H` key) for pure cinematic framing.
- **Static Local Export:** Generates high-fidelity canvas data URLs and triggers instant native browser PNG downloads without any external APIs, servers, or libraries.

## 3. Deliberately Excluded Scope (Complexity Ceiling: 7/10)
- **Deliberately Excluded:** 3D prop/asset spawning, terrain sculpting, or vehicle geometry editing.
- **Deliberately Excluded:** Multi-frame video encoding/export (e.g., WebM/MP4 encoders or FFmpeg WASM), avoiding browser thread stutter, massive bundle weight, and memory leaks.
- **Deliberately Excluded:** Remote social media uploads or external cloud sync, adhering strictly to the clean-room, static-local privacy boundary.
