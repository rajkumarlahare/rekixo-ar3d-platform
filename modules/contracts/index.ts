export const PLATFORM_MODULE_CONTRACT_VERSION = 2 as const;

export const PLATFORM_MODULES = [
  "auth",
  "audit",
  "domains",
  "projects",
  "plots",
  "mapper",
  "geo",
  "pricing",
  "sharing",
  "project-assets",
  "db",
  "super-admin",
  "client-admin",
  "public-project",
  "ui",
  "legacy-compat",
  "engine-integration",
] as const;

export type PlatformModuleName = (typeof PLATFORM_MODULES)[number];
