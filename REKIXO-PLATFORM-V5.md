# Rekixo AR3D Platform Architecture V5

## Repository identity

- Canonical GitHub repository: `rekixo-ar3d-platform`.
- Historical GitHub repository name: `tiyansh-prime-square`.
- Tiyansh Prime Square is a tenant/project, not the platform identity.
- The repository rename does **not** rename production Worker, D1, R2, route, project IDs, or migration history.
- `rekixo-ar3d-engine` is a sibling repository in the same Rekixo AR3D product family with separate runtime resources.

## Locked production architecture

- `rekixo-super-admin`
  - Owner-only Super Admin.
  - D1/R2 shared platform control plane.
- `rekixo-client-sites`
  - One generic Worker for all current and future customer public websites and client-admin access.
  - Project is resolved from hostname or platform slug.
  - No new Worker is required for each customer.
- `tiyansh-prime-square`
  - Temporary rollback/routing bridge only.
  - It uses the same D1/R2 and the same generic tenant runtime as `rekixo-client-sites`.
  - Its workers.dev host is scoped to the Tiyansh tenant and is not a shared multi-project host.
  - Historical static Tiyansh browser data is not part of the live runtime.

## Tenant isolation

All mutable content stays project-scoped:
- D1 `plots`, `settings`, `gallery`, `admin_users`
- R2 `projects/<projectId>/...`
- New `project_domains` hostname registry
- Public requests resolve a single project from the request hostname.
- `projectId` query parameters are not a public cross-tenant override.
- Draft preview requires an authenticated Super Admin/client session.

## Publication safety

New projects default to `draft`.
A generic project cannot publish until:
- masterplan is ready,
- map dimensions exist,
- plot inventory is not empty,
- every plot has a polygon,
- every polygon validates.

Tiyansh is migrated as `published` and remains the locked legacy reference, but it now executes through the same project-scoped data path as other customer tenants.

## URLs

Guaranteed after the generic Worker exists:
`https://rekixo-client-sites.<workers-subdomain>.workers.dev/p/<project-slug>`

Optional platform URL after one-time Cloudflare setup:
`https://sites.rekixo.com/p/<project-slug>`

Optional scalable subdomain:
`https://<project-slug>.sites.rekixo.com`

Optional customer domain:
`https://customer-domain.example`

## Cloudflare setup boundary

Saving a domain in Rekixo only configures application routing.

For a hostname to send traffic to the Worker:
- A domain/subdomain in a Cloudflare zone you control can be attached as a Worker Custom Domain or Worker Route.
- For many subdomains under your own zone, use a wildcard DNS record + wildcard Worker Route.
- For customer-owned vanity domains that are not zones in your Cloudflare account, use Cloudflare for SaaS / Custom Hostnames.

Do not create a separate Worker per customer.

Official references:
https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
https://developers.cloudflare.com/workers/configuration/routing/routes/
https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/

## One-time Cloudflare recommendation

1. Keep `admin.rekixo.com` on `rekixo-super-admin`.
2. Deploy `rekixo-client-sites`.
3. Attach `sites.rekixo.com` to `rekixo-client-sites` when ready.
4. If you want `client-slug.sites.rekixo.com`, configure wildcard DNS + Worker Route for `*.sites.rekixo.com/*` to `rekixo-client-sites`.
5. Keep the old `tiyansh-prime-square` Worker as a rollback/routing bridge until the external Tiyansh production hostname cutover is independently confirmed.
6. Stage 3 production parity checks must stay green before any later removal of the legacy deployment step.

## Why V5 does not auto-create DNS/custom hostnames

Domain ownership, certificate validation, and Cloudflare zone/SaaS configuration are infrastructure authorization steps. The application stores and resolves the mapping, but it must not silently create or hijack DNS hostnames.

## Stage 3 legacy isolation

Tiyansh-specific runtime identity is isolated behind `modules/legacy-compat`. Generic product code has no default tenant. Super Admin uses a platform scope instead of a Tiyansh project fallback, customer data requires explicit project IDs, and the browser runtime always boots from D1/R2-backed project data. Historical static inputs remain only under `legacy/tiyansh-reference/` for migration audit/history.
