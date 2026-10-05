import { describe, expect, it } from 'vitest';
import { checkPdf, deleteFile, fileStoreAvailable, FileStoreError, formatBytes, getFile, MAX_FILE_BYTES, putFile, SEMESTER_PDF_KEY } from './fileStore';

describe('file store', () => {
  it('checks picked PDFs', () => {
    expect(checkPdf({ name: 'coe.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
    expect(checkPdf({ name: 'COE.PDF', type: '', size: 1000 })).toBeNull();
    expect(checkPdf({ name: 'photo.jpg', type: 'image/jpeg', size: 1000 })).toBe('Choose a PDF file.');
    expect(checkPdf({ name: 'empty.pdf', type: 'application/pdf', size: 0 })).toBe('That file is empty.');
    expect(checkPdf({ name: 'big.pdf', type: 'application/pdf', size: MAX_FILE_BYTES + 1 })).toBe('The PDF is too large (max 20 MB).');
    expect(checkPdf({ name: 'max.pdf', type: 'application/pdf', size: MAX_FILE_BYTES })).toBeNull();
  });

  it('formats sizes', () => {
    expect(formatBytes(1_468_006)).toBe('1.4 MB');
    expect(formatBytes(839_680)).toBe('820 KB');
    expect(formatBytes(10)).toBe('1 KB');
  });

  // Vitest runs in Node, which has no IndexedDB: every call must fail politely, never throw synchronously.
  it('fails politely where IndexedDB is unavailable', async () => {
    expect(fileStoreAvailable()).toBe(false);
    await expect(getFile(SEMESTER_PDF_KEY)).rejects.toBeInstanceOf(FileStoreError);
    await expect(deleteFile(SEMESTER_PDF_KEY)).rejects.toThrow(/can’t keep files/);
    await expect(putFile(SEMESTER_PDF_KEY, new Blob(['%PDF'], { type: 'application/pdf' }))).rejects.toBeInstanceOf(FileStoreError);
  });
});
