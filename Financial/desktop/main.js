const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

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
  apiProcess = spawn(paths.apiExe, [], { cwd: paths.apiCwd });
  apiProcess.on('error', (err) => {
    dialog.showErrorBox('Financial API failed to start', err.message);
  });
  apiProcess.stdout?.on('data', (d) => console.log(`[api] ${d}`));
  apiProcess.stderr?.on('data', (d) => console.error(`[api] ${d}`));
}

function startStaticServer(uiDist) {
  return new Promise((resolve) => {
    const expressApp = express();
    expressApp.use(
      '/fin-api',
      createProxyMiddleware({
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/fin-api': '/api' },
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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Lowell Nails Financial',
    autoHideMenuBar: true,
  });
  mainWindow.loadURL(splashHtml());

  const paths = resourcePaths();

  try {
    startApi(paths);
    await waitForHealth(`http://127.0.0.1:${API_PORT}/api/health`, 15000);
    await startStaticServer(paths.uiDist);
    mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}`);
  } catch (err) {
    dialog.showErrorBox('Failed to start Financial', err.message);
    app.quit();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  killApiProcess();
  if (staticServer) staticServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killApiProcess();
  if (staticServer) staticServer.close();
});
