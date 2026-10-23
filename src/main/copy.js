// What a copy puts on the clipboard. Several paths are joined in the copy
// format picked in the settings: one per line, space separated, or space
// separated with each path in single quotes for pasting into a shell.
const path = require('path');
const { pathToFileURL } = require('url');

const FORMATS = ['newline', 'space', 'quoted'];

// A path in single quotes, with any single quote in it closed, escaped and
// opened again, so a shell reads it back exactly.
function quote(p) {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

function join(paths, format) {
  if (format === 'space') return paths.join(' ');
  if (format === 'quoted') return paths.map(quote).join(' ');
  return paths.join('\n');
}

function fileUrl(p) {
  return pathToFileURL(p).href;
}

function fileName(p) {
  return path.basename(p);
}

module.exports = { FORMATS, quote, join, fileUrl, fileName };
