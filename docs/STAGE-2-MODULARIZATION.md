# Stage 2 — Platform modularization

Status: implemented

## Objective

Introduce explicit bounded contexts for the Rekixo AR3D Platform while preserving all existing production behavior.

## Locked invariants

- No D1 migration is part of Stage 2.
- No R2 object is moved.
- No project ID, slug, domain, login ID, pricing/status, plot geometry, gallery object or publish state is rewritten.
- Existing public/admin URLs stay unchanged.
- Existing Worker names and deployment topology stay unchanged.
- Tiyansh legacy compatibility remains available until Stage 3.

## Architecture

The route/runtime shell stays in `app/` because Next/Vinext owns that convention.

Cross-feature imports now go through `@/modules/*` facades. This creates a stable seam before any future physical file moves.

Control plane:
- `modules/super-admin`
- `modules/projects`
- `modules/domains`
- `modules/auth`
- `modules/audit`

Tenant/client plane:
- `modules/client-admin`
- `modules/public-project`
- `modules/pricing`
- `modules/sharing`

Spatial/data plane:
- `modules/plots`
- `modules/mapper`
- `modules/geo`
- `modules/db`

Shared:
- `modules/ui`
- `modules/contracts`

## Dependency direction

`app route/page -> modules facade -> implementation`

API routes are not allowed to reach directly into another feature's root implementation file after Stage 2.

The implementation files intentionally stay in place in this stage; changing their physical paths is not required for modular boundaries and would add deployment risk without user-visible benefit.

## Future-proofing

When a feature is physically moved later, only its module facade needs to change. Route/page imports should remain stable.

Stage 3 may isolate Tiyansh-specific compatibility behind these same module boundaries. Stage 5 may add a dedicated Engine-link module without allowing direct access to the Engine D1/R2 resources.
