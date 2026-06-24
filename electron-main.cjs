const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverReady = false;

// Configurar variables de entorno antes de importar el servidor
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';
process.env.IS_PACKAGED = app.isPackaged ? 'true' : 'false';

function startBackend() {
  console.log('Loading backend server inside main process...');
  // Importar dinámicamente el servidor Express (módulo ES)
  import('./server/index.js').catch((err) => {
    console.error('❌ Failed to load Express backend inside main process:', err);
    dialog.showErrorBox(
      "Error del Servidor",
      "No se pudo iniciar la base de datos interna de la aplicación: " + err.message
    );
  });
}

function getTargetUrl() {
  return !app.isPackaged ? 'http://localhost:5173/' : 'http://localhost:3000/';
}

function checkServerReady(timeoutMs, callback) {
  const startTime = Date.now();
  const targetUrl = getTargetUrl();
  console.log(`Polling server at ${targetUrl} (timeout: ${timeoutMs}ms)...`);
  
  function poll() {
    if (!mainWindow) return;

    if (Date.now() - startTime > timeoutMs) {
      dialog.showErrorBox(
        "Error de Conexión",
        "El servidor interno de la aplicación no inició a tiempo (límite de 45 segundos superado). Por favor, cierra la aplicación e inténtalo de nuevo."
      );
      app.quit();
      return;
    }

    const req = http.get(targetUrl, (res) => {
      // Si responde con 200, el servidor Express está listo y sirviendo los archivos
      if (res.statusCode === 200) {
        console.log('✅ Server is ready and responding with 200!');
        serverReady = true;
        callback();
      } else {
        setTimeout(poll, 150);
      }
    });

    req.on('error', () => {
      setTimeout(poll, 150);
    });
  }

  poll();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Ayurveda Consultas",
    icon: path.join(__dirname, 'public/LOGO_2020_VEDAMCI.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Cargar pantalla de carga
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  // Abrir herramientas de desarrollo
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadMainApp() {
  if (!mainWindow) return;
  const targetUrl = getTargetUrl();

  if (!app.isPackaged) {
    mainWindow.loadURL(targetUrl);
  } else {
    // Limpiar caché y cargar con timestamp dinámico
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadURL(`${targetUrl}?t=${Date.now()}`);
    });
  }
}

// Inicialización de la aplicación
app.whenReady().then(() => {
  // 1. Mostrar la pantalla de carga inmediatamente
  createWindow();
  
  // 2. Levantar el servidor Express dentro del proceso principal
  startBackend();
  
  // 3. Monitorear el puerto de red
  checkServerReady(45000, () => {
    loadMainApp();
  });
});

// Salir de la app al cerrar las ventanas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    if (serverReady) {
      loadMainApp();
    } else {
      checkServerReady(45000, () => {
        loadMainApp();
      });
    }
  }
});
