# Tiyansh legacy reference

These files are historical recovery/reference inputs for the first Rekixo AR3D customer project.

They are intentionally outside `public/` and are **not** part of the live customer runtime.

- `plots.json` — preserved manual source used to generate the already-applied Tiyansh geometry recovery migration.
- `plots-data.js` — historical browser bundle from the pre-multi-tenant site.
- `masterplan.jpg` — historical static masterplan reference.

The live Tiyansh project now uses the same D1/R2-backed generic runtime as every other customer project. Do not reintroduce these files as runtime fallbacks. Rollback should use Git history / the legacy Worker deployment contract, not a silent tenant-specific browser fallback.
