// What a copy puts on the clipboard. Several paths are joined in the copy
// format picked in the settings: one per line, space separated, or space
// separated with each path in single quotes for pasting into a shell.
import path from 'path';
import { pathToFileURL } from 'url';
import type { CopyFormat } from '../shared/types';

export const FORMATS: CopyFormat[] = ['newline', 'space', 'quoted'];

// A path in single quotes, with any single quote in it closed, escaped and
// opened again, so a shell reads it back exactly.
export function quote(p: string) {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

export function join(paths: string[], format: string) {
  if (format === 'space') return paths.join(' ');
  if (format === 'quoted') return paths.map(quote).join(' ');
  return paths.join('\n');
}

export function fileUrl(p: string) {
  return pathToFileURL(p).href;
}

export function fileName(p: string) {
  return path.basename(p);
}
