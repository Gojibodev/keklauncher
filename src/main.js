const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
function createWindow() {
    console.log('Creating main window...');
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false, // Disable the standard window frame
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');

    ipcMain.on('minimize-window', () => {
        console.log('Minimize window event received');
        mainWindow.minimize();
    });

    ipcMain.on('close-window', () => {
        console.log('Close window event received');
        mainWindow.close();
    });

    // Handle update check request
    ipcMain.on('check-for-updates', () => {
        autoUpdater.checkForUpdates();
    });

    // Handle download update request
    ipcMain.on('download-update', () => {
        autoUpdater.downloadUpdate();
    });

    // Handle install update request
    ipcMain.on('install-update', () => {
        autoUpdater.quitAndInstall();
    });

    // Auto-updater events
    autoUpdater.on('checking-for-update', () => {
        mainWindow.webContents.send('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
        mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        mainWindow.webContents.send('update-not-available', info);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        mainWindow.webContents.send('update-downloaded', info);
    });

    autoUpdater.on('error', (err) => {
        mainWindow.webContents.send('update-error', err);
    });
}

app.whenReady().then(() => {
    console.log('App is ready');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});