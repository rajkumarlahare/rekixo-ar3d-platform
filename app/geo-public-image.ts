import { env } from "cloudflare:workers";

const MAX_IMAGES_BINDING_INPUT_BYTES = 20 * 1024 * 1024;

type ImageResult = { response(): Response };
type ImageHandle = {
  transform(options: { width: number }): ImageHandle;
  output(options: { format: "image/webp"; quality: number }): Promise<ImageResult>;
};
type ImagesBinding = {
  input(stream: ReadableStream): ImageHandle;
};

function imagesBinding() {
  return (env as unknown as { IMAGES?: ImagesBinding }).IMAGES;
}

export async function createGeoOverlayVariant(options: {
  sourceKey: string;
  targetKey: string;
  width: number;
  quality: number;
  customMetadata?: Record<string, string>;
}) {
  const images = imagesBinding();
  if (!images) return false;

  const source = await env.BUCKET.get(options.sourceKey);
  if (!source?.body || source.size > MAX_IMAGES_BINDING_INPUT_BYTES) return false;

  try {
    const optimized = await images
      .input(source.body)
      .transform({ width: options.width })
      .output({ format: "image/webp", quality: options.quality });
    const response = optimized.response();
    if (!response.ok || !response.body) return false;

    await env.BUCKET.put(options.targetKey, response.body, {
      httpMetadata: { contentType: "image/webp" },
      customMetadata: {
        ...(options.customMetadata || {}),
        sourceKey: options.sourceKey,
        optimizedWidth: String(options.width),
        optimizedQuality: String(options.quality),
      },
    });
    return true;
  } catch (error) {
    console.warn("Geo public overlay optimization skipped", error);
    return false;
  }
}
