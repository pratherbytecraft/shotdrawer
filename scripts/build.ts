// Builds dist/, which is what the npm package ships: the main process, the
// preload, bin and scripts one file each as CommonJS, in the same layout as
// the source so their paths to assets and package.json hold, and each page
// bundled into one script next to its HTML and CSS. Checking the types is
// tsc's job (npm run typecheck); this only writes JavaScript.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const SOURCE = /\.ts$/;

// esbuild's { in, out } for each source file in a folder, out being the
// output's path in dist/ without its extension.
function entries(dir: string, outDir: string, skip: string[] = []) {
  return fs.readdirSync(path.join(root, dir))
    .filter((f) => SOURCE.test(f) && !f.endsWith('.d.ts') && !skip.includes(f))
    .map((f) => ({ in: path.join(root, dir, f), out: path.join(outDir, f.replace(SOURCE, '')) }));
}

// Each page folder's script is named after the folder (panel/panel.ts).
function pages() {
  const dir = path.join(root, 'src', 'renderer');
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => entries(path.join('src', 'renderer', d.name), path.join('renderer', d.name)).filter((e) => path.basename(e.out) === d.name));
}

// The pages' HTML and CSS, as they are.
function copyPageFiles(from: string, to: string) {
  for (const d of fs.readdirSync(from, { withFileTypes: true })) {
    if (d.isDirectory()) copyPageFiles(path.join(from, d.name), path.join(to, d.name));
    else if (/\.(html|css)$/.test(d.name)) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(path.join(from, d.name), path.join(to, d.name));
    }
  }
}

async function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: [
      ...entries('src/main', 'main'),
      // The preload, the only file directly in src.
      ...entries('src', ''),
      ...entries('bin', 'bin'),
      ...entries('scripts', 'scripts', ['build.ts'])
    ],
    outdir: dist,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    logLevel: 'warning'
  });
  await esbuild.build({
    entryPoints: pages(),
    outdir: dist,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    // Electron 33's Chromium.
    target: 'chrome130',
    logLevel: 'warning'
  });
  copyPageFiles(path.join(root, 'src', 'renderer'), path.join(dist, 'renderer'));
  for (const f of fs.readdirSync(path.join(dist, 'bin'))) fs.chmodSync(path.join(dist, 'bin', f), 0o755);
}

build().catch(() => process.exit(1));
