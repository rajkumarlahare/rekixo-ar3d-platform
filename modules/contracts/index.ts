export const PLATFORM_MODULE_CONTRACT_VERSION = 1 as const;

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
  "db",
  "super-admin",
  "client-admin",
  "public-project",
  "ui",
] as const;

export type PlatformModuleName = (typeof PLATFORM_MODULES)[number];
