export {
  DEFAULT_PROJECT_ID,
  requestHost,
  clientFallbackHost,
  legacyFallbackHost,
  clientPlatformHost,
  sharedAdminHost,
  isPlatformAccessHost,
  clientLoginModeForProject,
  projectBySlug,
  publicProjectId,
  projectHostRole,
} from "@/app/project-context";
export {
  buildProjectLinks,
  currentProjectLinks,
  type ProjectLinkSet,
} from "@/app/project-links";
export {
  pickProjectContactSettings,
  missingRequiredProjectContact,
  projectMapFallbackUrl,
  withProjectContactFallbacks,
  type ProjectContactProfile,
} from "@/app/project-profile-policy";
