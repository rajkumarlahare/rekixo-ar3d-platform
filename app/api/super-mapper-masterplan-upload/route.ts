import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";

const MAX_ORIGINAL_BYTES = 100 * 1024 * 1024;
const MAX_PART_BYTES = 8 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_ORIGINAL_BYTES / MAX_PART_BYTES);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

async function activeProject(projectId: string) {
  if (!projectId) return false;
  return Boolean(
    await env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
    )
      .bind(projectId)
      .first(),
  );
}

function validToken(value: string) {
  return /^[a-zA-Z0-9_-]{12,80}$/.test(value);
}

function validUploadId(value: string) {
  // R2 uploadId is an opaque provider-issued value. Do not impose a
  // character allow-list here: production IDs may contain characters that
  // are perfectly valid once URL-decoded. Keep only structural abuse guards.
  return (
    value.length >= 1 &&
    value.length <= 1024 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function objectKey(projectId: string, token: string) {
  return `projects/${projectId}/mapper/masterplanOriginal/${token}`;
}

function uploadToken(expectedSize: number) {
  return `${crypto.randomUUID()}_${Math.round(expectedSize).toString(36)}`;
}

function expectedSizeFromToken(token: string) {
  const separator = token.lastIndexOf("_");
  if (separator < 1) return null; // compatibility with uploads initiated before this hardening
  const encoded = token.slice(separator + 1);
  if (!/^[0-9a-z]+$/i.test(encoded)) return null;
  const value = Number.parseInt(encoded, 36);
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_ORIGINAL_BYTES
    ? value
    : null;
}

function maxPartsForToken(token: string) {
  const expected = expectedSizeFromToken(token);
  return expected ? Math.ceil(expected / MAX_PART_BYTES) : MAX_PARTS;
}

function browserSafeImageMagic(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  if (
    view.length >= 8 &&
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47 &&
    view[4] === 0x0d &&
    view[5] === 0x0a &&
    view[6] === 0x1a &&
    view[7] === 0x0a
  ) return true;
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff)
    return true;
  if (
    view.length >= 12 &&
    String.fromCharCode(...view.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...view.slice(8, 12)) === "WEBP"
  ) return true;
  return false;
}

function normalizedType(filename: string, contentType: string) {
  const type = String(contentType || "").toLowerCase();
  const extension = filename.toLowerCase().split(".").pop() || "";
  if (IMAGE_TYPES.has(type)) return type;
  if (
    IMAGE_EXTENSIONS.has(extension) &&
    (!type || type === "image/jpg" || type === "application/octet-stream")
  ) {
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    return "image/jpeg";
  }
  return "";
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("projectId") || "");
  const action = String(url.searchParams.get("action") || "");

  if (!(await activeProject(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  if (action === "initiate") {
    const body = (await request.json().catch(() => ({}))) as {
      filename?: unknown;
      contentType?: unknown;
      size?: unknown;
    };
    const filename = String(body.filename || "").slice(0, 240);
    const size = Number(body.size || 0);
    const contentType = normalizedType(filename, String(body.contentType || ""));
    if (!filename || !contentType)
      return Response.json(
        { error: "Masterplan JPG/PNG/WebP hona chahiye" },
        { status: 400 },
      );
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ORIGINAL_BYTES)
      return Response.json(
        { error: "Original masterplan 100 MB se chhota hona chahiye" },
        { status: 400 },
      );

    const token = uploadToken(size);
    const upload = await env.BUCKET.createMultipartUpload(objectKey(projectId, token), {
      httpMetadata: { contentType },
      customMetadata: {
        filename,
        expectedSize: String(Math.round(size)),
        projectId,
      },
    });

    return Response.json({
      ok: true,
      token,
      uploadId: upload.uploadId,
      maxPartBytes: MAX_PART_BYTES,
      maxParts: Math.ceil(size / MAX_PART_BYTES),
    });
  }

  const token = String(url.searchParams.get("token") || "");
  const uploadId = String(url.searchParams.get("uploadId") || "");
  if (!validToken(token) || !validUploadId(uploadId))
    return Response.json({ error: "Masterplan upload session invalid hai" }, { status: 400 });

  const upload = env.BUCKET.resumeMultipartUpload(
    objectKey(projectId, token),
    uploadId,
  );

  if (action === "part") {
    const partNumber = Number(url.searchParams.get("partNumber") || 0);
    const allowedParts = maxPartsForToken(token);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > allowedParts)
      return Response.json({ error: "Masterplan part number invalid hai" }, { status: 400 });

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_PART_BYTES)
      return Response.json(
        { error: "Masterplan chunk 8 MB se bada nahi ho sakta" },
        { status: 413 },
      );
    if (partNumber === 1 && !browserSafeImageMagic(bytes))
      return Response.json(
        { error: "Masterplan file valid JPG, PNG ya WebP image nahi hai" },
        { status: 400 },
      );

    const part = await upload.uploadPart(partNumber, bytes);
    return Response.json({
      ok: true,
      partNumber: part.partNumber,
      etag: part.etag,
    });
  }

  if (action === "complete") {
    const body = (await request.json().catch(() => ({}))) as {
      parts?: Array<{ partNumber?: unknown; etag?: unknown }>;
    };
    const parts = Array.isArray(body.parts)
      ? body.parts
          .map((part) => ({
            partNumber: Number(part.partNumber),
            etag: String(part.etag || ""),
          }))
          .filter(
            (part) =>
              Number.isInteger(part.partNumber) &&
              part.partNumber >= 1 &&
              part.partNumber <= 100 &&
              Boolean(part.etag),
          )
      : [];
    const allowedParts = maxPartsForToken(token);
    const uniquePartNumbers = new Set(parts.map((part) => part.partNumber));
    if (
      !parts.length ||
      parts.length !== body.parts?.length ||
      uniquePartNumbers.size !== parts.length ||
      parts.some((part) => part.partNumber > allowedParts)
    )
      return Response.json({ error: "Masterplan multipart list invalid hai" }, { status: 400 });

    await upload.complete(parts);

    // New upload tokens bind the declared byte size to the R2 object key. This
    // keeps existing in-flight UUID-only sessions compatible while making all
    // newly initiated uploads exact-size verified after multipart completion.
    const expectedSize = expectedSizeFromToken(token);
    if (expectedSize !== null) {
      const object = await env.BUCKET.head(objectKey(projectId, token));
      const actualSize = Number(object?.size || 0);
      if (!object || actualSize !== expectedSize || actualSize > MAX_ORIGINAL_BYTES) {
        await env.BUCKET.delete(objectKey(projectId, token)).catch(() => undefined);
        return Response.json(
          { error: "Masterplan upload size verify nahi hua. Dobara upload karein." },
          { status: 409 },
        );
      }
    }

    return Response.json({ ok: true, token });
  }

  if (action === "abort") {
    await upload.abort();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Masterplan upload action invalid hai" }, { status: 400 });
}
