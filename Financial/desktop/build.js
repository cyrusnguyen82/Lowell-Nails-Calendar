/**
 * build.js — Orchestrates packaging the Financial app into a portable desktop .exe.
 *
 *   node build.js api   → just freezes the Python backend with PyInstaller
 *   node build.js all   → builds the UI, freezes the backend, then runs electron-builder
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DESKTOP_DIR = __dirname;
const API_DIR = path.resolve(DESKTOP_DIR, '..', 'api');
const CALENDAR_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const API_DIST = path.resolve(DESKTOP_DIR, '..', 'api-dist');
const API_BUILD = path.resolve(DESKTOP_DIR, '..', 'api-build');

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function buildApi() {
  console.log('\n=== Freezing Financial API with PyInstaller ===');
  const hiddenImports = [
    'uvicorn.logging',
    'uvicorn.loops.auto',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan.on',
  ].map((m) => `--hidden-import ${m}`).join(' ');

  run(
    `py -m PyInstaller --noconfirm --onedir --name financial-api ` +
    `--distpath "${API_DIST}" --workpath "${API_BUILD}" --specpath "${API_BUILD}" ` +
    `--paths "${CALENDAR_ROOT}" ${hiddenImports} server.py`,
    API_DIR
  );

  const envSrc = path.join(CALENDAR_ROOT, '.env');
  const envDest = path.join(API_DIST, 'financial-api', '.env');
  fs.copyFileSync(envSrc, envDest);
  console.log(`Copied .env -> ${envDest}`);

  const exePath = path.join(API_DIST, 'financial-api', 'financial-api.exe');
  if (!fs.existsSync(exePath)) {
    throw new Error(`Expected PyInstaller output not found: ${exePath}`);
  }
  console.log(`API frozen OK: ${exePath}`);
}

function buildUi() {
  console.log('\n=== Building Financial UI (vite build) ===');
  run('npm run build', path.resolve(DESKTOP_DIR, '..', 'ui'));
  const indexPath = path.resolve(DESKTOP_DIR, '..', 'ui', 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Expected vite build output not found: ${indexPath}`);
  }
  console.log(`UI build OK: ${indexPath}`);
}

function packageElectron() {
  console.log('\n=== Packaging with electron-builder (portable .exe) ===');
  run('npx electron-builder', DESKTOP_DIR);
}

const mode = process.argv[2] || 'all';

if (mode === 'api') {
  buildApi();
} else if (mode === 'all') {
  buildUi();
  buildApi();
  packageElectron();
} else {
  console.error(`Unknown mode: ${mode} (expected "api" or "all")`);
  process.exit(1);
}
