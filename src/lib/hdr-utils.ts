/**
 * Whether an image URL looks like HDR or wide-gamut content, going by its
 * file extension or naming.
 *
 * Nothing is done to such photos beyond tagging them (see `.hdr-enhanced`
 * in globals.css). Browsers tone-map HDR AVIFs themselves: on an HDR
 * display they show the full range, on an SDR one they map it down. CSS
 * filters stacked on top of that are what blow photos out, so there are
 * none.
 */
export function isLikelyHDR(url: string): boolean {
  const hdrExtensions = ['.hdr', '.exr', '.heif', '.heic', '.avif'];
  const hdrIndicators = ['hdr', 'p3', 'rec2020', 'dolby', 'vision'];

  const urlLower = url.toLowerCase();
  return (
    hdrExtensions.some(extension => urlLower.endsWith(extension)) ||
    hdrIndicators.some(indicator => urlLower.includes(indicator))
  );
}
