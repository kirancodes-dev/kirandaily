import { describe, expect, it } from 'vitest';
import {
  PHOTO_ATTEMPTS,
  PHOTO_MAX_CHARS,
  PHOTO_TARGET_CHARS,
  centerSquareCrop,
  downscaleSteps,
  isAcceptablePhoto,
  isValidPhotoDataUrl,
  looksLikeHeic,
  precheckPhotoFile,
} from './image';
import { profileExtraSchema } from './schema';

describe('photo crop maths', () => {
  it('takes the centred square of landscape and portrait pictures', () => {
    expect(centerSquareCrop(4032, 3024)).toEqual({ sx: 504, sy: 0, size: 3024 });
    expect(centerSquareCrop(1170, 2532)).toEqual({ sx: 0, sy: 681, size: 1170 });
    expect(centerSquareCrop(300, 300)).toEqual({ sx: 0, sy: 0, size: 300 });
  });

  it('handles odd and degenerate sizes', () => {
    expect(centerSquareCrop(5, 2)).toEqual({ sx: 1, sy: 0, size: 2 });
    expect(centerSquareCrop(0, 100)).toEqual({ sx: 0, sy: 50, size: 0 });
    expect(centerSquareCrop(10.7, 4.2)).toEqual({ sx: 3, sy: 0, size: 4 });
  });

  it('downscales big pictures in halves and ends at the target', () => {
    expect(downscaleSteps(3024, 256)).toEqual([1512, 756, 378, 256]);
    expect(downscaleSteps(500, 256)).toEqual([256]);
    expect(downscaleSteps(256, 256)).toEqual([256]);
    expect(downscaleSteps(100, 256)).toEqual([256]);
  });

  it('starts at 256 px / ~0.85 quality and only gets smaller', () => {
    expect(PHOTO_ATTEMPTS[0]).toEqual({ size: 256, quality: 0.85 });
    for (let i = 1; i < PHOTO_ATTEMPTS.length; i++) {
      expect(PHOTO_ATTEMPTS[i].size).toBeLessThanOrEqual(PHOTO_ATTEMPTS[i - 1].size);
      expect(PHOTO_ATTEMPTS[i].quality).toBeLessThan(PHOTO_ATTEMPTS[i - 1].quality);
    }
  });
});

describe('photo checks', () => {
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

  it('accepts image data URLs the schema accepts', () => {
    expect(isValidPhotoDataUrl(jpeg)).toBe(true);
    expect(isValidPhotoDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isValidPhotoDataUrl('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(profileExtraSchema.shape.photo.safeParse(jpeg).success).toBe(true);
  });

  it('refuses other types, broken data and oversized photos', () => {
    expect(isValidPhotoDataUrl('data:image/gif;base64,R0lGOD==')).toBe(false);
    expect(isValidPhotoDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isValidPhotoDataUrl('data:,')).toBe(false);
    expect(isValidPhotoDataUrl('https://example.com/me.jpg')).toBe(false);
    expect(isValidPhotoDataUrl('data:image/jpeg;base64,<script>')).toBe(false);
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(PHOTO_MAX_CHARS);
    expect(isValidPhotoDataUrl(huge)).toBe(false);
    expect(profileExtraSchema.shape.photo.safeParse(huge).success).toBe(false);
  });

  it('keeps photos well under the schema limit', () => {
    expect(PHOTO_TARGET_CHARS).toBeLessThanOrEqual(PHOTO_MAX_CHARS / 2);
    expect(isAcceptablePhoto(jpeg)).toBe(true);
    expect(isAcceptablePhoto('data:image/jpeg;base64,' + 'A'.repeat(PHOTO_TARGET_CHARS))).toBe(false);
  });

  it('spots HEIC files by type or name', () => {
    expect(looksLikeHeic({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe(true);
    expect(looksLikeHeic({ type: '', name: 'IMG_2.heif' })).toBe(true);
    expect(looksLikeHeic({ type: 'image/jpeg', name: 'IMG_3.jpg' })).toBe(false);
  });

  it('refuses empty, huge and non-image files before decoding', () => {
    expect(precheckPhotoFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(precheckPhotoFile({ type: 'image/jpeg', size: 50 * 1024 * 1024 })).toMatch(/too large/);
    expect(precheckPhotoFile({ type: 'application/pdf', size: 1000 })).toMatch(/isn’t a picture/);
    expect(precheckPhotoFile({ type: 'image/heic', size: 3_000_000 })).toBeNull();
    // Some pickers give no type at all — let the decoder decide.
    expect(precheckPhotoFile({ type: '', size: 1000 })).toBeNull();
  });
});
