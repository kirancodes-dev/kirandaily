/** Saves text as a file via a Blob and a temporary <a download>. */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // iOS Safari reads the Blob after the click returns, so keep the URL alive for a while.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
