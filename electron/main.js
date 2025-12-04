const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Fix for Linux sandbox issue
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
}

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

let mainWindow;
let backendProcess = null;

// Start the backend server
function startBackend() {
  if (backendProcess) return;

  const backendPath = isDev 
    ? path.join(__dirname, '../backend/server.js')
    : path.join(process.resourcesPath, 'backend/server.js');

  console.log('Starting backend server from:', backendPath);

  backendProcess = spawn('node', [backendPath], {
    cwd: isDev ? path.join(__dirname, '..') : process.resourcesPath,
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });
}

// Stop the backend server
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'EyeEar Audiobook Generator',
    backgroundColor: '#0f0f1a',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Wait for backend to be ready
function waitForBackend(callback, maxAttempts = 30) {
  const http = require('http');
  let attempts = 0;

  const checkBackend = () => {
    attempts++;
    const req = http.get('http://localhost:3001/api/health', (res) => {
      if (res.statusCode === 200) {
        console.log('Backend is ready!');
        callback();
      } else {
        retryOrFail();
      }
    });

    req.on('error', () => {
      retryOrFail();
    });

    req.setTimeout(1000, () => {
      req.destroy();
      retryOrFail();
    });
  };

  const retryOrFail = () => {
    if (attempts < maxAttempts) {
      setTimeout(checkBackend, 500);
    } else {
      console.error('Backend failed to start after', maxAttempts, 'attempts');
      callback(); // Try to continue anyway
    }
  };

  checkBackend();
}

app.whenReady().then(() => {
  // Start backend first (only in production or when running standalone)
  if (!isDev || process.env.START_BACKEND !== 'false') {
    startBackend();
    waitForBackend(() => {
      createWindow();
    });
  } else {
    // In dev mode with external backend, just create window
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
