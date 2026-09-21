# Stage 5 — Platform ↔ Engine integration

Status: implemented

## Boundary

Rekixo AR3D Platform remains the control plane. Rekixo AR3D Engine remains the 3D data/rendering plane.

The databases are **not merged**.

Platform D1 stores only `project_3d_links`:

- Platform project ID
- Engine project ID
- Engine slug
- active/disabled link status
- whether public 3D is enabled
- canonical public Engine URL
- audit metadata

Models, scenes, camera presets and 3D assets never enter Platform D1/R2.

## Versioned Engine contract

Platform validates an Engine project through:

`GET https://admin.rekixo.com/3Dprojects/api/integration/projects/[slug]`

Contract version: `1`.

A contract mismatch fails closed.

## Super Admin

The Super Admin has a dedicated **3D Engine** workspace.

A link can be created only when the Engine confirms the slug and immutable Engine project ID. One Engine project cannot be attached to multiple Platform projects by the current one-to-one contract.

Public 3D can be enabled only when the Engine project is published.

All link mutations require Super Admin authentication and same-origin protection and are audit logged.

## Public experience

`/api/public-data` emits `engine3d` only when all conditions are true:

1. the Platform link exists;
2. link status is active;
3. public 3D is enabled;
4. the Engine public API currently confirms that exact Engine project ID;
5. the Engine project is published.

If Engine is unavailable or unpublished, the Platform project continues normally and the 3D button is omitted.

## Admin handoff

`/api/admin/3d-handoff` is Super-Admin protected and transfers selected-project context to:

`https://admin.rekixo.com/3Dprojects?project=[engine-slug]`

It does **not** copy the Platform session, password, cookie or secret to the Engine.

The Engine Admin remains read-only in Stage 5. Privileged Engine write APIs must not be enabled until a dedicated authenticated authorization layer exists.

## Production resources

Unchanged:

- Platform D1: `tiyansh-production`
- Platform R2: `tiyansh-gallery-production`
- Engine D1: `rekixo-3d-production`
- Engine R2: `rekixo-3d-assets`
- Platform public routes: `/projects/*`
- Engine public routes: `/3Dprojects/*`
