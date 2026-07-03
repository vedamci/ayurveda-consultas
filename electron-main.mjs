import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let serverReady = false;
let backendPort = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isFinite(backendPort)) {
  backendPort = 3000;
}

// Configurar variables de entorno antes de importar el servidor
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';
process.env.IS_PACKAGED = app.isPackaged ? 'true' : 'false';

// Determine correct base directory
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;

process.env.ELECTRON_APP_ROOT = APP_ROOT;

console.log('[Electron Main] APP_ROOT:', APP_ROOT);
console.log('[Electron Main] isPackaged:', app.isPackaged);

function canBindPort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();

    probe.once('error', () => {
      resolve(false);
    });

    probe.once('listening', () => {
      probe.close(() => {
        resolve(true);
      });
    });

    probe.listen(port, 'localhost');
  });
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 50; port += 1) {
    if (await canBindPort(port)) {
      return port;
    }
  }

  throw new Error(`No se encontró un puerto libre entre ${preferredPort} y ${preferredPort + 49}.`);
}

async function startBackend() {
  // In dev mode, nodemon already runs the server via concurrently — don't import it again
  if (!app.isPackaged) {
    console.log('[Electron Main] Dev mode: server is managed by nodemon, skipping import.');
    return true;
  }

  console.log('[Electron Main] Production mode: Loading backend server...');
  try {
    backendPort = await findAvailablePort(backendPort);
    process.env.PORT = String(backendPort);
    console.log(`[Electron Main] Backend will listen on port ${backendPort}.`);

    const serverPath = path.join(APP_ROOT, 'server', 'index.js');
    const serverUrl = `file://${serverPath}`;
    console.log('[Electron Main] Importing server from:', serverUrl);

    await import(serverUrl);
    console.log('[Electron Main] ✅ Backend server loaded successfully!');
    return true;
  } catch (err) {
    console.error('[Electron Main] ❌ Failed to load Express backend:', err);
    dialog.showErrorBox(
      "Error del Servidor",
      `No se pudo iniciar el servidor interno:\n\n${err.message}\n\nDetalles: ${err.stack}`
    );
    return false;
  }
}

function getTargetUrl() {
  return !app.isPackaged ? 'http://localhost:5173/' : `http://localhost:${backendPort}/`;
}

function checkServerReady(timeoutMs, callback) {
  const startTime = Date.now();
  const targetUrl = getTargetUrl();
  let called = false; // Guard against multiple invocations

  console.log(`[Electron Main] Polling server at ${targetUrl} (timeout: ${timeoutMs}ms)...`);

  function poll() {
    if (called || !mainWindow) return;

    if (Date.now() - startTime > timeoutMs) {
      console.error('[Electron Main] ❌ Server timeout!');
      dialog.showErrorBox(
        "Error de Conexión",
        "El servidor interno no inició a tiempo (60 segundos). Por favor, cierra la aplicación e inténtalo de nuevo."
      );
      app.quit();
      return;
    }

    const req = http.get(targetUrl, (res) => {
      // Consume the response data to free up the socket
      res.resume();
      
      if (!called && (res.statusCode === 200 || res.statusCode === 304)) {
        called = true;
        console.log(`[Electron Main] ✅ Server responding with ${res.statusCode}!`);
        serverReady = true;
        callback();
      } else if (!called) {
        setTimeout(poll, 500);
      }
    });

    req.on('error', () => {
      if (!called) setTimeout(poll, 500);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      if (!called) setTimeout(poll, 500);
    });
  }

  poll();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Ayurveda Consultas",
    icon: path.join(APP_ROOT, 'public', 'LOGO_2020_VEDAMCI.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    }
  });

  // Cargar pantalla de carga
  const loadingPath = path.join(APP_ROOT, 'loading.html');
  mainWindow.loadFile(loadingPath);

  // Solo abrir DevTools en desarrollo
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadMainApp() {
  if (!mainWindow) return;
  const targetUrl = getTargetUrl();
  console.log(`[Electron Main] Loading main app from: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);
}

// ── Impresión nativa de PDF con Chromium (raíz del arreglo de paginación) ──
// El renderer llama window.vedamciPrint.toPDF(). Chromium pagina de verdad
// respetando @media print + @page; nunca corta texto ni rasteriza.
ipcMain.handle('vedamci:print-to-pdf', async (event, options = {}) => {
  try {
    const wc = event.sender;
    // Esperar a que las fuentes estén listas para que la medición de página sea exacta.
    try {
      await wc.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true');
    } catch { /* noop */ }

    const data = await wc.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true, // respeta @page { size: A4 } del CSS
      margins: { marginType: 'default' },
      ...options,
    });
    return { ok: true, data };
  } catch (err) {
    console.error('[Electron Main] printToPDF falló:', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// Inicialización de la aplicación
app.whenReady().then(async () => {
  console.log('[Electron Main] App ready, creating window...');

  // 1. Mostrar la pantalla de carga inmediatamente
  createWindow();

  // 2. Levantar el servidor Express (solo en producción)
  const backendStarted = await startBackend();
  if (!backendStarted) {
    app.quit();
    return;
  }

  // 3. Monitorear el puerto de red
  checkServerReady(60000, () => {
    loadMainApp();
  });
});

// Salir de la app al cerrar las ventanas
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    if (serverReady) {
      loadMainApp();
    } else {
      checkServerReady(60000, () => {
        loadMainApp();
      });
    }
  }
});

app.on('before-quit', () => {
  console.log('[Electron Main] Shutting down...');
});
