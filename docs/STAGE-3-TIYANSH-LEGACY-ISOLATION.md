# Stage 3 — Tiyansh legacy isolation

Status: implemented

## Objective

Tiyansh Prime Square must behave as a normal Rekixo AR3D tenant while the historical Worker remains available only as a rollback/routing bridge.

## Completed architecture

- Tiyansh project and legacy host constants live only in `modules/legacy-compat`.
- The legacy workers.dev hostname resolves only Tiyansh; it is not a shared multi-tenant project host.
- Super Admin sessions use the platform scope `__rekixo_platform__`, not a Tiyansh project ID.
- Super Admin asset/gallery access requires an explicit selected project.
- Drizzle runtime schema no longer supplies a Tiyansh default project ID for plots, settings or gallery.
- Client Admin is D1/R2-backed for Tiyansh exactly like every other project.
- Public runtime no longer loads bundled Tiyansh plots or masterplan files.
- The shared 3D viewer is exposed as `RekixoPlot3D`; the old `Tiyansh3D` name remains only as a temporary cached-shell alias.
- Historical Tiyansh static source files are archived under `legacy/tiyansh-reference/` and are not served from `public/`.
- Existing applied Tiyansh migrations remain immutable history.
- Existing Tiyansh client accounts remain email + password. Projects created after the mobile-login migration remain mobile + password.

## Production parity gate

`scripts/verify-tiyansh-generic-parity.mjs` checks the live generic and legacy Workers for:

- identical project identity, public settings, plots, pricing payloads and gallery metadata;
- valid canonical polygons for every returned plot;
- required D1/R2 masterplan metadata;
- live masterplan and gallery asset access;
- Tiyansh email-login rendering on both generic and legacy access paths;
- runtime v62 on the generic path;
- after legacy deployment, rejection of foreign project paths on the Tiyansh legacy host.

The deployment workflow runs this gate once after the Generic Client Worker is deployed and again after the legacy Tiyansh Worker is deployed.

## Legacy Worker retention

Stage 3 does **not** delete the `tiyansh-prime-square` Worker. It remains a rollback/routing bridge until the external production hostname cutover is independently confirmed. Removing it before that proof would reduce safety without improving tenant architecture.

The bridge runs the same project-data-driven code as the generic Worker. It no longer contains a separate Tiyansh browser application.

## No data migration

Stage 3 has no D1 migration and moves no R2 objects. Project IDs, domains, pricing, plot status, geometry, gallery records and client credentials remain unchanged.

## CI acceptance

The Stage 3 pull request is accepted only when source syntax, production build, the full regression suite, Stage 2 module boundaries, Stage 3 isolation contracts, Measurement V2 contracts, and the live Tiyansh generic-vs-legacy preflight all pass. Production is accepted only after both post-deploy parity gates pass in the same deployment run.
