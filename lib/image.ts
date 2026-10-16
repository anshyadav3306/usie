// Shrinks photos before upload so they send fast and stay inside the free storage limit.
export async function compressImage(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
  ext: string;
  mime: string;
}> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  // Keep animated GIFs untouched.
  if (file.type === "image/gif") {
    return { blob: file, width: bitmap.width, height: bitmap.height, ext: "gif", mime: "image/gif" };
  }

  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", 0.82)
  );
  return { blob, width, height, ext: "jpg", mime: "image/jpeg" };
}

// Crops a profile photo to a centred square and shrinks it.
export async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", 0.85)
  );
}
