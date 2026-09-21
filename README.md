# Rekixo AR3D Platform

Rekixo AR3D Platform is the multi-project real-estate control plane and customer website platform for the Rekixo AR3D product family.

This repository began with the first customer project, **Tiyansh Prime Square**, but the production application is now a project-agnostic platform. Tiyansh Prime Square, Mangal Raj Park, and future customer projects are tenants/data inside the platform; they are not separate copies of this codebase.

## Repository identity

- Canonical repository name: `rekixo-ar3d-platform`
- Historical repository name: `tiyansh-prime-square`
- Product family: **Rekixo AR3D**
- Separate sibling engine repository: `rekixo-ar3d-engine`

The repository rename is an identity cleanup only. It must not rename or migrate production Cloudflare resources.

## Current platform responsibilities

The current codebase contains:

- Rekixo Super Admin / control plane
- Client Admin authentication and project-scoped management
- Generic customer project website runtime
- Plot Mapper and source-backed plot measurement workflow
- Geo / satellite mapper and public map experience
- project provisioning, publishing, domains and sharing
- plot status, pricing, gallery and project profile management
- D1 schema/migrations and R2 project assets
- generic multi-tenant Cloudflare Worker routing
- a temporary legacy Tiyansh compatibility Worker

## Production tenancy model

Mutable customer data is project-scoped.

- D1 tables use `project_id` / project membership boundaries.
- R2 project assets use project-scoped object keys.
- Hostnames resolve to a single project.
- New customer projects reuse the generic platform runtime; a new Worker is not created for every customer.

See [REKIXO-PLATFORM-V5.md](./REKIXO-PLATFORM-V5.md) and [REKIXO-NEW-PROJECT-WORKFLOW.md](./REKIXO-NEW-PROJECT-WORKFLOW.md).

## Stable production resource IDs

These names are historical infrastructure identifiers and remain unchanged during repository identity cleanup:

- D1: `tiyansh-production`
- R2: `tiyansh-gallery-production`
- Generic client Worker: `rekixo-client-sites`
- Super Admin Worker: `rekixo-super-admin`
- Legacy bridge Worker: `tiyansh-prime-square`

Do not rename live D1/R2 resources or the legacy Worker merely to match the GitHub repository name.

## Source layout

Step 1 changes repository identity only. The existing production source layout remains intentionally intact so identity cleanup cannot break routing or deployments.

Important current areas:

- `app/` — Next/Vinext route and runtime entrypoints
- `modules/` — stable bounded interfaces for Auth, Projects, Domains, Plots, Mapper, Geo, Pricing, DB, Super Admin, Client Admin and Public Project
- `db/` — Drizzle schema/runtime access
- `drizzle/` — production D1 migration history
- `public/project/` — generic customer project runtime assets
- `worker/` — Cloudflare edge routing
- `scripts/` — build/deployment helpers
- `tests/` — regression contracts
- `.github/workflows/` — CI/CD

Stage 2 establishes stable `@/modules/*` boundaries before any risky physical route moves. See [docs/STAGE-2-MODULARIZATION.md](./docs/STAGE-2-MODULARIZATION.md). Future physical moves must preserve these interfaces and production behavior.

## Development

Prerequisites:

- Node.js `>=22.13.0`
- npm
- Linux-compatible shell for the current verified scripts

Install and run:

```bash
npm ci
npm run dev
```

Verification:

```bash
npm run build
node --test tests/*.test.mjs
```

Production deployment is GitHub-Actions-first. Merges to `main` run the full regression suite, apply additive D1 migrations, then deploy the existing Generic Client, legacy Tiyansh, and Super Admin Workers.

## Architecture boundary with the 3D Engine

`rekixo-ar3d-platform` and `rekixo-ar3d-engine` are sibling repositories in the same Rekixo AR3D product family.

The platform owns project/customer/plot operations. The engine owns realistic 3D models, scenes and rendering. Their production databases and asset buckets stay isolated; later integration should use an explicit project-link/service contract rather than sharing databases.

## Safety rules

- Never treat Tiyansh Prime Square as the repository identity again.
- Never create a code repository per normal customer project.
- Never move customer production assets into Git.
- Never rename a live Cloudflare resource just for cosmetic consistency.
- Never rewrite already-applied migration history.
- Preserve project-scoped isolation and existing project URLs during future refactors.
