const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Common fix for Electron crashing before window creation on VMs / remote
// desktop sessions where GPU acceleration is unreliable.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('no-sandbox');

const LOG_FILE = path.join(app.getPath('userData'), 'financial-desktop.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (e) { /* ignore */ }
  console.log(...args);
}
process.on('uncaughtException', (err) => log('uncaughtException:', err.stack || err.message));

const API_PORT = 5002;
const UI_PORT = 5300;

let apiProcess = null;
let staticServer = null;
let mainWindow = null;

function resourcePaths() {
  if (app.isPackaged) {
    return {
      apiExe: path.join(process.resourcesPath, 'api', 'financial-api.exe'),
      apiCwd: path.join(process.resourcesPath, 'api'),
      uiDist: path.join(process.resourcesPath, 'ui'),
    };
  }
  // Dev mode: testing the Electron shell against a locally-built (not yet packaged) output.
  return {
    apiExe: path.join(__dirname, '..', 'api-dist', 'financial-api', 'financial-api.exe'),
    apiCwd: path.join(__dirname, '..', 'api-dist', 'financial-api'),
    uiDist: path.join(__dirname, '..', 'ui', 'dist'),
  };
}

function splashHtml() {
  return `data:text/html,${encodeURIComponent(`
    <html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,'Segoe UI',sans-serif;background:#eef2fb;color:#1e293b;">
      <div style="text-align:center;">
        <p style="font-size:1.1rem;font-weight:700;">Lowell Nails Financial</p>
        <p style="font-size:0.85rem;color:#64748b;">Starting…</p>
      </div>
    </body></html>
  `)}`;
}

function waitForHealth(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      setTimeout(tick, 300);
    };
    tick();
  });
}

function startApi(paths) {
  log('Spawning API:', paths.apiExe, 'cwd:', paths.apiCwd);
  apiProcess = spawn(paths.apiExe, [], { cwd: paths.apiCwd });
  apiProcess.on('error', (err) => {
    log('API spawn error:', err.message);
    dialog.showErrorBox('Financial API failed to start', err.message);
  });
  apiProcess.on('exit', (code, signal) => log(`API process exited code=${code} signal=${signal}`));
  apiProcess.stdout?.on('data', (d) => log(`[api] ${d}`));
  apiProcess.stderr?.on('data', (d) => log(`[api:err] ${d}`));
}

function startStaticServer(uiDist) {
  return new Promise((resolve) => {
    const expressApp = express();
    expressApp.use(
      '/fin-api',
      createProxyMiddleware({
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        // Express's `use('/fin-api', ...)` mount already strips the '/fin-api' prefix
        // before this middleware sees req.url, so we only need to prepend '/api' here.
        pathRewrite: (path) => `/api${path}`,
      })
    );
    expressApp.use(express.static(uiDist));
    expressApp.get('*', (req, res) => res.sendFile(path.join(uiDist, 'index.html')));
    staticServer = expressApp.listen(UI_PORT, '127.0.0.1', resolve);
  });
}

function killApiProcess() {
  if (!apiProcess || apiProcess.killed) return;
  try {
    // Plain child.kill() often leaves the uvicorn child of a spawned .exe alive on Windows.
    execSync(`taskkill /pid ${apiProcess.pid} /T /F`);
  } catch (e) {
    // Process may have already exited.
  }
  apiProcess = null;
}

async function createWindow() {
  log('createWindow() starting. isPackaged=', app.isPackaged, 'userData=', app.getPath('userData'));
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Lowell Nails Financial',
    autoHideMenuBar: true,
  });
  mainWindow.loadURL(splashHtml());
  log('Splash window created.');

  const paths = resourcePaths();
  log('Resolved paths:', JSON.stringify(paths));

  try {
    startApi(paths);
    log('Waiting for API health check...');
    await waitForHealth(`http://127.0.0.1:${API_PORT}/api/health`, 15000);
    log('API healthy. Starting static server...');
    await startStaticServer(paths.uiDist);
    log(`Static server up on ${UI_PORT}. Loading app UI.`);
    mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}`);
  } catch (err) {
    log('Startup failed:', err.stack || err.message);
    dialog.showErrorBox('Failed to start Financial', err.message);
  }
}

app.whenReady().then(() => {
  log('app.whenReady fired.');
  createWindow();
}).catch((err) => log('whenReady rejected:', err.stack || err.message));

app.on('window-all-closed', () => {
  killApiProcess();
  if (staticServer) staticServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killApiProcess();
  if (staticServer) staticServer.close();
});
