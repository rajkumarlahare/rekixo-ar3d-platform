# Rekixo AR3D Platform module boundaries

Stage 2 introduces stable internal module interfaces without changing production routes, D1/R2 resources, project IDs, or tenant data.

## Dependency rule

Browser/API entrypoints under `app/` should import shared platform behavior through `@/modules/*` instead of reaching directly into another feature's implementation file.

The route tree remains under Next/Vinext's required `app/` directory. This stage intentionally does **not** move route files.

## Boundaries

- `auth` — Super Admin/client sessions, login identity, password and client-edit policy.
- `audit` — audit log write contract.
- `domains` — host/slug normalization and project-domain persistence.
- `projects` — project resolution, links, provisioning, profile/customer actions.
- `plots` — area policy and plot-side/measurement semantics.
- `mapper` — geometry/CAD/source-sheet parsing.
- `geo` — geo models, calibration, public manifest/image configuration.
- `pricing` — pricing-sheet parsing and expansion.
- `sharing` — project share branding contract.
- `db` — D1 access and schema facade.
- `super-admin` — Super Admin UI composition surface.
- `client-admin` — Client Admin UI composition surface.
- `public-project` — public-project read-side facade.
- `ui` — cross-feature UI primitives owned by the platform.
- `contracts` — architecture-level module names/version.
- `legacy-compat` — explicitly isolated historical Tiyansh routing/rollback identifiers; generic product code must not define them.
- `engine-integration` — versioned Platform ↔ AR3D Engine linkage/read boundary; it may call the Engine HTTP contract but must never bind to Engine D1/R2.

## Compatibility

The current implementation files remain in `app/` during Stage 2 so production behavior and existing tests stay stable. The `modules/*` paths are now the supported cross-feature interfaces. Later physical moves can happen behind these interfaces without changing route imports.

No module may bind to a new database or bucket merely because code is reorganized.

## Stage 3 rule

Tiyansh-specific identifiers may exist only behind `modules/legacy-compat` or in immutable migration/reference history. New generic features must not import legacy reference files or infer a default tenant.
