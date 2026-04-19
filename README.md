# Heli-VertiSafe (v5.0)

Helipad / vertiport feasibility analysis — React, Vite, Three.js. Scoring and compliance reference ICAO Annex 14 Vol II and Saudi GACAR.

## Requirements

- Node.js (LTS)
- npm

## Commands

Run all commands from **this folder** (where `package.json` lives):

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

If `npm run dev` fails with missing `package.json`, you are in the wrong directory. Use `cd` into this `helivertisafe` folder first.

## Entry points

| File | Role |
|------|------|
| `src/main.jsx` | React bootstrap |
| `src/helivertisafe.jsx` | Full application (v5.0 single-file build) |

## Cursor

This repo includes **`.cursorrules`** at the project root (same level as `package.json`). Cursor loads it automatically for edits in this folder.

## Documentation (parent folder)

If your workspace is the parent `files` directory, see:

- `../README-HELIVERTISAFE.md` — index of all guides
- `../cursor-setup-guide.md` — setup from scratch
- `../cursor-phase1-prompts.md` — refactor / split prompts
- `../helivertisafe-roadmap.md` — full roadmap

To sync the monolithic source from the repo root when you update `../helivertisafe.jsx`:

```powershell
Copy-Item -Path "..\helivertisafe.jsx" -Destination ".\src\helivertisafe.jsx" -Force
```

(Adjust paths if your layout differs.)

## Stack

- React 19
- Vite 8
- three.js
