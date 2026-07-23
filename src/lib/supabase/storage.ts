import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AppImageBucket =
  | "recipe-images"
  | "recipe-method-images"
  | "production-images"
  | "ingredient-images";

const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeBytes = 5 * 1024 * 1024;

export function validateImageFile(file: File) {
  if (!supportedImageTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG and WebP images are supported.");
  }

  if (file.size > maxImageSizeBytes) {
    throw new Error("Images must be smaller than 5 MB.");
  }
}

export async function compressImageToWebp(file: File, quality = 0.82) {
  validateImageFile(file);

  if (file.type === "image/webp" && file.size <= maxImageSizeBytes) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is not available in this browser.");
  context.drawImage(bitmap, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Image compression failed."))),
      "image/webp",
      quality,
    );
  });

  return new File([blob], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
}

export function buildImageStoragePath(
  businessId: string,
  folder: "recipes" | "recipe-methods" | "productions" | "ingredients",
  recordId: string,
  fileName: string,
) {
  return `${businessId}/${folder}/${recordId}/${crypto.randomUUID()}-${fileName}`
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function uploadPrivateImage(
  supabase: SupabaseClient<Database>,
  bucket: AppImageBucket,
  path: string,
  file: File,
) {
  const compressed = await compressImageToWebp(file);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, compressed, {
      cacheControl: "3600",
      contentType: compressed.type,
      upsert: false,
    });

  if (error) throw error;
  return data.path;
}

export async function createSignedImageUrl(
  supabase: SupabaseClient<Database>,
  bucket: AppImageBucket,
  path: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
