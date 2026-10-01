export type Geo3DRenderPolicy = {
  flattenBaseMesh: boolean;
  flattenHalfSizeM: number;
};

const JYOTI_ENGINE_PROJECT_ID = "302a8799-24de-4b9f-b217-95fb2c3883c8";
const JYOTI_ENGINE_SLUG = "jyoti-paradise-local-backup-302a8799";

export function geo3DRenderPolicy(
  project:
    | { id?: string | null; slug?: string | null }
    | null
    | undefined,
): Geo3DRenderPolicy {
  const isJyotiParadise =
    project?.id === JYOTI_ENGINE_PROJECT_ID &&
    project?.slug === JYOTI_ENGINE_SLUG;

  return {
    // Google Photorealistic 3D includes an above-ground mesh (buildings/trees).
    // Jyoti's replacement building must clear only its immediate footprint so
    // the custom model cannot be depth-occluded by Google's existing mesh.
    // Keep this opt-in and project-scoped: every other Rekixo project remains
    // on the exact pre-existing rendering path.
    flattenBaseMesh: isJyotiParadise,
    flattenHalfSizeM: isJyotiParadise ? 20 : 0,
  };
}
