const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

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

    ipcMain.on('check-for-updates', () => {
        autoUpdater.checkForUpdates();
    });

    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('update-not-available');
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-downloaded');
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