# PLAN.md: David Raup (1966) 3D Shell Generator

## 1. Project Overview & Objectives
Build a lightweight, no-UI-framework Vite + Three.js web application that simulates David Raup's classic 1966 *Coiled Shell Morphospace* model. Vite is used only as a build/dev tool — there is no React/Vue/etc. The user can run a single command in their Mac terminal (`npm start`) to launch the local development server, auto-open the interactive 3D shell viewer in their browser, and publish the project to a new GitHub repository using the GitHub CLI (`gh`).

### Key Mathematical Parameters (Raup 1966)
- **$W$ (Whorl Expansion Rate):** Rate of logarithmic radius increase per full turn ($2\pi$).
- **$D$ (Distance from Axis):** Normalized distance of the generating circle center from the coiling axis. Defined as $D = (r_c - a)/(r_c + a)$, so $D = 0$ puts the generating curve tangent to the axis and $D \to 1$ flattens it toward a near-straight cone.
- **$T$ (Vertical Translation Rate):** Vertical movement down the coiling axis per revolution. Defined here as $z_c = T \cdot r_c$, which keeps the apical angle constant (a true logarithmic spire).

### Model Defaults (fixed unless noted)
- Initial generating-curve radius: $a_0 = 1$
- Default turns: $5$ (see adaptive cap in Phase 2)
- Coiling resolution (`thetaSegments`): $512$
- Cross-section resolution (`phiSegments`): $64$

---

## 2. Project Architecture & File Structure

```
raup-1966-shell-generator/
├── index.html              # Main HTML container with control panel layout
├── style.css               # Modern dark-mode styling & glassmorphism UI
├── package.json            # Scripts: dev, build, preview, start
├── vite.config.js          # Vite configuration with auto-open on server start
├── .gitignore              # node_modules, dist, .DS_Store
├── README.md               # Complete usage documentation & scientific background
└── src/
    ├── math/
    │   └── raupGeometry.js # Pure math function generating shell parametric vertices
    ├── scene/
    │   └── shellViewer.js  # Three.js setup (scene, camera, lighting, OrbitControls)
    ├── ui/
    │   └── controls.js     # Event listeners for sliders, presets, and wireframe toggle
    └── main.js             # Application entry point binding math, scene, and UI
```

---

## 3. Implementation Steps for OpenCode

### Phase 1: Environment Setup & Project Initialization
1. Initialize a new Vite project in the current directory:
   ```bash
   npm create vite@latest . -- --template vanilla
   ```
   **Important:** the directory is not empty (`PLAN.md` already exists), so Vite will prompt *"Current directory is not empty. Please choose how to proceed."* Choose **"Ignore files and continue"** — do **not** let it remove existing files. Verify `PLAN.md` still exists afterward.
2. Install dependencies (the vanilla template already includes Vite as a devDependency, so do not reinstall it):
   ```bash
   npm install
   npm install three
   ```
3. Remove the template demo leftovers that don't match this plan (`src/counter.js`, `src/javascript.svg`, and the template `src/style.css` if it conflicts with the root `style.css`).
4. Update `package.json` scripts:
   ```json
   "scripts": {
     "dev": "vite",
     "start": "vite --open",
     "build": "vite build",
     "preview": "vite preview"
   }
   ```
5. Create `vite.config.js` **without** a second auto-open (auto-open lives in the `start` script only):
   ```js
   import { defineConfig } from 'vite';
   export default defineConfig({});
   ```
6. Add `.gitignore` with `node_modules/`, `dist/`, and `.DS_Store`.

### Phase 2: Core Math Engine (`src/math/raupGeometry.js`)
Implement the parametric surface function based on Raup's 1966 helicospiral equations. Keep this module **pure** — no `three` import; return plain typed arrays (`positions`, `normals`, `indices`) so `shellViewer.js` can wrap them in a `BufferGeometry`.

**Inputs:** $W$ ($1.1 \dots 10.0$), $D$ ($0.0 \dots 0.85$), $T$ ($0.0 \dots 6.0$), `thetaSegments`, `phiSegments`, and an optional turns/cap value.

**Scalar equations:**
- Growth exponent per radian: $k = W^{1 / (2\pi)}$
- Cross-section radius: $a(\theta) = a_0 \cdot k^\theta$
- Axis distance: $r_c(\theta) = a(\theta) \cdot \frac{1 + D}{1 - D}$
- Vertical offset: $z_c(\theta) = T \cdot r_c(\theta)$

**Scale control (critical):**
Because radius grows as $W^{\text{turns}}$, high-$W$ shells explode (e.g. $W = 8$ over 3 turns is already $\approx 512\times$). Do **both** of the following:
1. **Adaptive turn cap** — stop early once $a(\theta)/a_0$ reaches a growth cap (e.g. $40\times$), in addition to the default 5-turn limit, so extreme presets stay numerically stable.
2. **Normalize the output** — center the mesh and uniformly scale it to a unit bounding-sphere radius before returning. Uniform scaling preserves the $W/D/T$ relationships, so the shape is unchanged; it just guarantees the viewer always frames the shell.

**Surface mapping** ($\theta$ = coiling angle, $\phi$ = angle around the generating curve):
- $R(\theta,\phi) = r_c(\theta) + a(\theta)\cos\phi$
- $Z(\theta,\phi) = z_c(\theta) + a(\theta)\sin\phi$
- $X = R\cos\theta$, $\quad Y = R\sin\theta$, $\quad Z = Z(\theta,\phi)$

**Mesh construction:**
- Build a $(\text{thetaSegments}+1) \times (\text{phiSegments}+1)$ grid. **Duplicate seam vertices** at $\theta = 0$ and $\theta = 2\pi$ to avoid UV/shading seams.
- Emit triangle indices with **consistent CCW winding** so normals point outward; double-check no faces are inverted.
- Compute normals **analytically** from the cross product of the partial derivatives $\partial P/\partial\theta \times \partial P/\partial\phi$ (normalized). If that proves error-prone, fall back to `geometry.computeVertexNormals()` in `shellViewer.js`.
- **Open ends:** either cap the aperture (an aperture disk) and the apex, or render the mesh with `side: THREE.DoubleSide`. Pick one and apply it consistently.

### Phase 3: Three.js Renderer (`src/scene/shellViewer.js`)
1. Create a responsive Three.js canvas with `WebGLRenderer` (cap `devicePixelRatio` at 2), `PerspectiveCamera`, and `OrbitControls`. Enable damping and call `controls.update()` in the animation loop.
2. Add studio lighting:
   - Key Directional Light (warm white)
   - Fill Directional Light (cool soft tint)
   - Ambient Light for soft shadow filling
3. Add an **environment map** for the physical material — use `RoomEnvironment` + `PMREMGenerator` and assign `scene.environment`. Without it, `MeshPhysicalMaterial` renders flat and dark.
4. Create a `THREE.BufferGeometry` from the Phase 2 arrays and rebuild it whenever sliders change.
   - **Dispose the previous geometry** (`geometry.dispose()`) before assigning the new one to avoid GPU memory leaks.
   - **Throttle regeneration** with `requestAnimationFrame` (or the slider `change` event) instead of rebuilding on every `input` event.
5. Apply a continuous organic calcified nacre material (`THREE.MeshPhysicalMaterial`) with:
   - low roughness / clearcoat for wet specular highlights
   - `iridescence` for the nacre rainbow sheen
   - a pale cream base color
6. Handle `resize` events (update camera aspect + renderer size). With the geometry normalized to a unit sphere in Phase 2, keep the camera at a fixed framing distance rather than re-fitting on every change.

### Phase 4: UI & Presets (`src/ui/controls.js` & `index.html`)
1. Create a side panel with interactive sliders (with visible labels and numeric value readouts):
   - Slider 1: `$W$` (Whorl Expansion)
   - Slider 2: `$D$` (Distance from Axis)
   - Slider 3: `$T$` (Vertical Translation)
   - Resolution stays fixed as the Phase 2 constants; it is **not** exposed in the UI.
2. Add one-click preset buttons:
   - **Ammonite (Flat Coil):** $W = 2.2, D = 0.15, T = 0.0$
   - **Turritella (Tower Screw):** $W = 1.35, D = 0.10, T = 4.5$
   - **Classic Snail:** $W = 2.0, D = 0.25, T = 1.5$
   - **Ram's Horn (Open Coil):** $W = 1.8, D = 0.65, T = 0.8$
   - **Abalone (Flared):** $W = 8.0, D = 0.10, T = 0.4$ — *stylized; a real abalone is a low-spired, ear-shaped shell, so treat this label as illustrative rather than taxonomically accurate.*
3. Add toggle switches for Wireframe mode and Auto-rotate turntable (`controls.autoRotate`).
4. Add a **Reset** button restoring the default $W/D/T$.

### Phase 5: Terminal Launch & GitHub Workflow Integration
1. Verify local terminal launch command:
   ```bash
   npm start
   ```
   *(Starts the Vite dev server and opens the browser automatically on macOS. The port is usually `5173` but may increment if it is already in use.)*
2. Confirm the GitHub CLI is authenticated (prerequisite, not optional):
   ```bash
   gh auth status
   ```
   If not logged in, run `gh auth login` first.
3. Confirm `.gitignore` excludes `node_modules/`, `dist/`, and `.DS_Store`.
4. Initialize the local repository with a modern default branch:
   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "feat: initial release of Raup 1966 3D Shell Morphospace Generator"
   ```
5. Publish to GitHub using `gh` CLI (the repo name intentionally differs from the local directory name `what-the-shell`):
   ```bash
   gh repo create raup-1966-shell-generator --public --source=. --remote=origin --push
   ```

### Phase 6: Documentation (`README.md`)
Write a README covering:
- what the project is and the Raup (1966) model background
- the meaning of $W$, $D$, $T$ and their ranges
- how to install and run (`npm install`, `npm start`, `npm run build`)
- a short description of each preset
- the live-demo/repo links (add the Pages or host URL if deployed)

---

## 4. Acceptance Criteria & Verification Checklist

- [ ] `npm start` runs cleanly from the macOS terminal without errors and opens the browser automatically.
- [ ] `npm run build` completes without errors or warnings.
- [ ] Dragging any slider ($W$, $D$, $T$) updates the 3D shell mesh in real time smoothly.
- [ ] Repeated slider dragging does **not** grow GPU memory (previous geometry is disposed).
- [ ] High-$W$ presets (e.g. Abalone) render at a sane, fully framed scale — no clipping or runaway geometry.
- [ ] The mesh has outward-facing normals and no visible seam or missing caps.
- [ ] Preset buttons accurately update slider values and regenerate geometry instantly.
- [ ] Orbit controls allow full 360-degree rotation, panning, and zooming; auto-rotate works.
- [ ] Code is formatted, clean, and free of console errors.
- [ ] `.gitignore` excludes `node_modules/` and `dist/`; the commit contains no build artifacts.
- [ ] Git repository is initialized (branch `main`) and pushed successfully to GitHub via `gh`.
