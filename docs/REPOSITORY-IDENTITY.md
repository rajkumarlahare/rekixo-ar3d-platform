# Rekixo AR3D Platform — Repository Identity Contract

Status: **LOCKED FOR STEP 1**
Date: 2026-09-21

## Canonical identity

The canonical source repository is:

`rajkumarlahare/rekixo-ar3d-platform`

Historical source repository name:

`rajkumarlahare/tiyansh-prime-square`

The historical name came from the first customer project. It must not be reused as the product/platform identity in new code or documentation.

## What the repository rename changes

- GitHub repository display/name identity
- local clone folder name
- Git remote URL
- npm package identity
- human-facing architecture documentation

## What the repository rename does not change

- project ID `tiyansh-prime-square`
- Tiyansh customer project data
- D1 database `tiyansh-production`
- R2 bucket `tiyansh-gallery-production`
- legacy Worker `tiyansh-prime-square`
- generic Worker `rekixo-client-sites`
- Super Admin Worker `rekixo-super-admin`
- existing domains/routes
- migration filenames/history
- project slugs, status, pricing, plots or gallery data

## Product-family boundary

Rekixo AR3D currently has two sibling source repositories:

1. `rekixo-ar3d-platform` — multi-project control plane, mapper, customer sites and administration.
2. `rekixo-ar3d-engine` — realistic 3D authoring/runtime engine.

They may integrate later through an explicit contract, but production databases and asset buckets stay isolated.

## Local checkout target

Recommended workstation layout:

```text
~/Dev/AR3D/
├── rekixo-ar3d-platform/
└── rekixo-ar3d-engine/
```

After the GitHub repository rename, an existing clone should update its remote explicitly:

```bash
git remote set-url origin https://github.com/rajkumarlahare/rekixo-ar3d-platform.git
```

## Change-control rule

Any later refactor that physically moves Super Admin, Client Admin, mapper or public runtime code is a separate architecture phase. Step 1 must remain an identity-only change with no production resource migration.
