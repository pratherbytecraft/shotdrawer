// Which files in the screenshot folder are screenshots: a picture or PDF
// whose name starts with the screenshot tool's prefix. macOS names them
// "Screenshot 2026-10-26 at 9.38.04 PM.png" (with a narrow no-break space
// before PM), older versions "Screen Shot ...", and a prefix set with
// `defaults write com.apple.screencapture name` replaces the first word.
import path from 'path';

export const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.heic', '.pdf', '.tiff']);
const PREFIXES = ['Screenshot', 'Screen Shot'];

export function isScreenshot(name: string, prefix?: string | null) {
  // macOS writes a new screenshot under a hidden name first.
  if (name.startsWith('.')) return false;
  if (!EXTENSIONS.has(path.extname(name).toLowerCase())) return false;
  return [prefix, ...PREFIXES].some((p) => p && name.startsWith(p));
}
