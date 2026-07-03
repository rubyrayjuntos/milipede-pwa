# milipede-pwa

A mobile-first Progressive Web App reimagining of the 1982 arcade game *Millipede*,
rendered as a neon-wireframe 3D scene with Three.js and driven entirely by
procedurally synthesized audio (no static sound/texture assets).

## Stack

- Vite + TypeScript, Three.js (InstancedMesh rendering, custom fresnel glow
  shader, `UnrealBloomPass`, `ReinhardToneMapping`)
- Deterministic 60Hz fixed-timestep simulation, decoupled from the render loop
- Grid-based spatial hash for O(1) collision broad-phase
- Web Audio API synthesis for the laser, DDT explosion, granular millipede
  drone, and generative background score
- Dual-thumb touch controls: left half is a relative virtual trackball, right
  half is hold-to-fire with double-tap DDT detonation
- PWA: `manifest.json`, a cache-first service worker, and an IndexedDB score
  queue flushed via Background Sync when connectivity returns

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build
```

## Project layout

- `src/core` — grid constants, fixed-step game loop, spatial hash, RNG
- `src/sim` — gameplay simulation: mushrooms, millipede, bombs, enemies, player, world orchestrator
- `src/render` — Three.js scene, instanced rendering, glow shader, background
- `src/input` — dual-thumb touch/mouse controls
- `src/audio` — procedural Web Audio synth engine
- `src/ui` — HUD/menu overlay
- `src/pwa` — service worker registration, IndexedDB score queue
