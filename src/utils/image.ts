/**
 * Profile photo processing: any picture (camera, library, screenshot) →
 * square, centre-cropped 256 × 256 JPEG data URL small enough to store and
 * sync with the rest of the data (the schema allows up to 400 000 chars).
 *
 * The maths and checks are pure (unit tested); `fileToPhotoDataUrl` needs a
 * browser (Image + canvas).
 */

/** Hard limit from the data schema (profileExtra.photo). */
export const PHOTO_MAX_CHARS = 400_000;
/** What we aim for, well under the limit (a 256 px JPEG is usually 20–60 k chars). */
export const PHOTO_TARGET_CHARS = 150_000;
/** Refuse absurdly large files before trying to decode them (memory on phones). */
export const PHOTO_MAX_FILE_BYTES = 40 * 1024 * 1024;
export const PHOTO_SIZE = 256;

const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

/** Largest centred square inside a width × height picture. */
export function centerSquareCrop(width: number, height: number): CropRect {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}

/**
 * Intermediate sizes for downscaling a big square in halves (much smoother
 * than one giant step). Ends with the target size.
 */
export function downscaleSteps(source: number, target: number): number[] {
  const steps: number[] = [];
  let s = Math.floor(source);
  while (s / 2 > target) {
    s = Math.floor(s / 2);
    steps.push(s);
  }
  steps.push(target);
  return steps;
}

/** Sizes/qualities tried in order until the result is small enough. */
export const PHOTO_ATTEMPTS: readonly { size: number; quality: number }[] = [
  { size: 256, quality: 0.85 },
  { size: 256, quality: 0.75 },
  { size: 224, quality: 0.7 },
  { size: 192, quality: 0.65 },
  { size: 160, quality: 0.6 },
  { size: 128, quality: 0.55 },
];

/** A stored photo: an image data URL of an allowed type within the size limit. */
export function isValidPhotoDataUrl(value: string, maxChars = PHOTO_MAX_CHARS): boolean {
  return value.length <= maxChars && PHOTO_RE.test(value);
}

/** Good enough to keep: valid and under our (smaller) target. */
export function isAcceptablePhoto(value: string): boolean {
  return isValidPhotoDataUrl(value, PHOTO_TARGET_CHARS);
}

/** HEIC/HEIF (iPhone camera format) — many browsers outside Safari can't decode it. */
export function looksLikeHeic(file: { type?: string; name?: string }): boolean {
  return /hei[cf]/i.test(file.type ?? '') || /\.hei[cf]$/i.test(file.name ?? '');
}

/** User-facing reason a picture can't be used. */
export class PhotoError extends Error {}

/** Checks that can be made before decoding (type and size). Returns an error message or null. */
export function precheckPhotoFile(file: { type?: string; name?: string; size: number }): string | null {
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > PHOTO_MAX_FILE_BYTES) return 'That picture is too large (over 40 MB). Pick a smaller one.';
  const type = file.type ?? '';
  if (type && !type.startsWith('image/')) return 'That isn’t a picture. Choose a photo (JPEG, PNG, WebP or HEIC).';
  return null;
}

/* ───────────────────────── browser part ───────────────────────── */

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

function canvasOf(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('This browser can’t edit pictures.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Draws the centre square of `img` at `size` px (white behind transparent PNGs). */
function renderSquare(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const crop = centerSquareCrop(img.naturalWidth, img.naturalHeight);
  if (crop.size < 1) throw new PhotoError('That picture looks empty.');
  let source: CanvasImageSource = img;
  let sx = crop.sx;
  let sy = crop.sy;
  let s = crop.size;
  let out: HTMLCanvasElement | null = null;
  for (const step of downscaleSteps(crop.size, Math.min(size, crop.size))) {
    const { canvas, ctx } = canvasOf(step);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, step, step);
    ctx.drawImage(source, sx, sy, s, s, 0, 0, step, step);
    source = canvas;
    out = canvas;
    sx = 0;
    sy = 0;
    s = step;
  }
  if (!out) throw new PhotoError('Couldn’t process that picture.');
  if (out.width === size) return out;
  // Tiny source picture: scale it up to the standard size.
  const { canvas, ctx } = canvasOf(size);
  ctx.drawImage(out, 0, 0, size, size);
  return canvas;
}

/**
 * Turns a picture file into the stored profile photo. Throws PhotoError
 * with a friendly message when it can't (e.g. HEIC on a browser that can't
 * read it).
 */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  const pre = precheckPhotoFile(file);
  if (pre) throw new PhotoError(pre);
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new PhotoError(
      looksLikeHeic(file)
        ? 'This browser can’t read HEIC photos. On iPhone pick it from Photos (it’s converted automatically), or use a JPEG/PNG.'
        : 'Couldn’t read that picture. Try a JPEG or PNG.',
    );
  }
  for (const attempt of PHOTO_ATTEMPTS) {
    const canvas = renderSquare(img, attempt.size);
    const url = canvas.toDataURL('image/jpeg', attempt.quality);
    if (isAcceptablePhoto(url)) return url;
  }
  throw new PhotoError('Couldn’t make that picture small enough. Try another one.');
}
