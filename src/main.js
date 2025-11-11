const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const ModpackManager = require('./modpackManager');
const ModDownloader = require('./modDownloader');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Initialize modpack manager
const modpackManager = new ModpackManager(
    path.join(__dirname, '../modpacks'),
    path.join(__dirname, '../mods')
);

let modDownloader = null;
let mainWindow = null;
function createWindow() {
    console.log('Creating main window...');
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
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

    // ============ MODPACK MANAGEMENT IPC HANDLERS ============

    // Get all available modpacks
    ipcMain.handle('get-modpacks', async () => {
        try {
            const modpacks = modpackManager.getAvailableModpacks();
            return { success: true, modpacks };
        } catch (error) {
            console.error('Error getting modpacks:', error);
            return { success: false, error: error.message };
        }
    });

    // Load modpack details
    ipcMain.handle('load-modpack', async (event, modpackId) => {
        try {
            const modpack = modpackManager.loadModpack(modpackId);
            if (!modpack) {
                return { success: false, error: 'Modpack not found' };
            }
            return { success: true, modpack };
        } catch (error) {
            console.error('Error loading modpack:', error);
            return { success: false, error: error.message };
        }
    });

    // Get modpack statistics
    ipcMain.handle('get-modpack-stats', async (event, modpackId) => {
        try {
            const stats = modpackManager.getModpackStats(modpackId);
            return { success: true, stats };
        } catch (error) {
            console.error('Error getting modpack stats:', error);
            return { success: false, error: error.message };
        }
    });

    // Compare installed mods with configuration
    ipcMain.handle('compare-mods', async (event, modpackId) => {
        try {
            const comparison = modpackManager.compareModsWithConfig(modpackId);
            return { success: true, comparison };
        } catch (error) {
            console.error('Error comparing mods:', error);
            return { success: false, error: error.message };
        }
    });

    // Download/update mods for a modpack
    ipcMain.handle('download-mods', async (event, modpackId, onlyNew = false) => {
        try {
            const modpack = modpackManager.loadModpack(modpackId);
            if (!modpack) {
                return { success: false, error: 'Modpack not found' };
            }

            const modpackPath = modpackManager.getModpackPath(modpackId);
            modDownloader = new ModDownloader(modpackPath);

            const modsToDownload = onlyNew
                ? modpackManager.compareModsWithConfig(modpackId).missing
                : modpack.mods;

            if (modsToDownload.length === 0) {
                return { success: true, message: 'No mods to download', results: { successful: [], failed: [], skipped: [] } };
            }

            mainWindow.webContents.send('download-started', {
                modpackId,
                totalMods: modsToDownload.length
            });

            const results = await modDownloader.downloadMods(
                modsToDownload,
                // onModProgress
                (filename, downloaded, total, percent) => {
                    mainWindow.webContents.send('mod-download-progress', {
                        filename,
                        downloaded,
                        total,
                        percent
                    });
                },
                // onOverallProgress
                (completed, total) => {
                    mainWindow.webContents.send('mod-download-overall', {
                        completed,
                        total,
                        percent: (completed / total) * 100
                    });
                },
                onlyNew
            );

            mainWindow.webContents.send('download-completed', { results });

            return { success: true, results };
        } catch (error) {
            console.error('Error downloading mods:', error);
            mainWindow.webContents.send('download-error', { error: error.message });
            return { success: false, error: error.message };
        }
    });

    // Delete a specific mod
    ipcMain.handle('delete-mod', async (event, modpackId, filename) => {
        try {
            const success = modpackManager.deleteMod(modpackId, filename);
            return { success };
        } catch (error) {
            console.error('Error deleting mod:', error);
            return { success: false, error: error.message };
        }
    });

    // Open modpack folder
    ipcMain.handle('open-modpack-folder', async (event, modpackId) => {
        try {
            const modpackPath = modpackManager.getModpackPath(modpackId);
            await shell.openPath(modpackPath);
            return { success: true };
        } catch (error) {
            console.error('Error opening folder:', error);
            return { success: false, error: error.message };
        }
    });

    // Get installed mods list
    ipcMain.handle('get-installed-mods', async (event, modpackId) => {
        try {
            const mods = modpackManager.getInstalledMods(modpackId);
            return { success: true, mods };
        } catch (error) {
            console.error('Error getting installed mods:', error);
            return { success: false, error: error.message };
        }
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