const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const ModpackManager = require('./modpackManager');
const ModDownloader = require('./modDownloader');
const MinecraftLauncher = require('./minecraftLauncher');
const CurseForgeAPI = require('./curseforgeAPI');
const ModpackCreator = require('./modpackCreator');
require('dotenv').config();

// Register custom URL protocol for deep linking
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('keklauncher', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('keklauncher');
}

// Handle the protocol on Windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window and handle the protocol
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // Handle protocol URL
            const url = commandLine.find(arg => arg.startsWith('keklauncher://'));
            if (url) {
                handleProtocolUrl(url);
            }
        }
    });
}

// Handle protocol on macOS
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
});

// Handle custom protocol URL
function handleProtocolUrl(url) {
    console.log('Protocol URL received:', url);

    try {
        const urlObj = new URL(url);

        if (urlObj.protocol === 'keklauncher:' && urlObj.hostname === 'install') {
            const modpackUrl = urlObj.searchParams.get('url');

            if (modpackUrl && mainWindow) {
                // Navigate to creator page and trigger import
                mainWindow.webContents.send('protocol-install', modpackUrl);

                // Show notification
                mainWindow.webContents.send('show-notification', {
                    title: 'Modpack Installation',
                    message: `Installing modpack from: ${modpackUrl}`,
                    type: 'info'
                });
            }
        }
    } catch (error) {
        console.error('Error parsing protocol URL:', error);
    }
}

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Initialize managers
const modpackManager = new ModpackManager(
    path.join(__dirname, '../modpacks'),
    null // Will use AppData/.kek/modpacks
);

const minecraftLauncher = new MinecraftLauncher();

// Initialize CurseForge API if key is available
let curseForgeAPI = null;
if (process.env.CURSEFORGE_API_KEY) {
    curseForgeAPI = new CurseForgeAPI(process.env.CURSEFORGE_API_KEY);
}

// Initialize Modpack Creator
const modpackCreator = new ModpackCreator(curseForgeAPI);

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

    // ============ MINECRAFT LAUNCHER HANDLERS ============

    // Launch Minecraft
    ipcMain.handle('launch-minecraft', async (event, profileName) => {
        try {
            const result = await minecraftLauncher.launchMinecraft(profileName);
            return result;
        } catch (error) {
            console.error('Error launching Minecraft:', error);
            return { success: false, error: error.message };
        }
    });

    // Check if Minecraft is installed
    ipcMain.handle('check-minecraft', async () => {
        try {
            const isInstalled = minecraftLauncher.isMinecraftInstalled();
            return { success: true, isInstalled };
        } catch (error) {
            console.error('Error checking Minecraft:', error);
            return { success: false, error: error.message };
        }
    });

    // Switch to modpack
    ipcMain.handle('switch-modpack', async (event, modpackId) => {
        try {
            const result = modpackManager.switchToModpack(modpackId, 'copy');
            return result;
        } catch (error) {
            console.error('Error switching modpack:', error);
            return { success: false, error: error.message };
        }
    });

    // Get active modpack
    ipcMain.handle('get-active-modpack', async () => {
        try {
            const activeModpack = modpackManager.getActiveModpack();
            return { success: true, activeModpack };
        } catch (error) {
            console.error('Error getting active modpack:', error);
            return { success: false, error: error.message };
        }
    });

    // Create Minecraft profile
    ipcMain.handle('create-minecraft-profile', async (event, modpackName, minecraftVersion) => {
        try {
            const result = minecraftLauncher.createProfile(modpackName, minecraftVersion);
            return result;
        } catch (error) {
            console.error('Error creating profile:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CURSEFORGE API HANDLERS ============

    // Search CurseForge mods
    ipcMain.handle('curseforge-search', async (event, query, minecraftVersion) => {
        try {
            if (!curseForgeAPI) {
                return { success: false, error: 'CurseForge API key not configured' };
            }

            const mods = await curseForgeAPI.searchMods(query, minecraftVersion, 20);
            return { success: true, mods };
        } catch (error) {
            console.error('Error searching CurseForge:', error);
            return { success: false, error: error.message };
        }
    });

    // Get mod for modpack from CurseForge
    ipcMain.handle('curseforge-get-mod', async (event, modId, minecraftVersion) => {
        try {
            if (!curseForgeAPI) {
                return { success: false, error: 'CurseForge API key not configured' };
            }

            const mod = await curseForgeAPI.getModForModpack(modId, minecraftVersion);
            return { success: true, mod };
        } catch (error) {
            console.error('Error getting mod from CurseForge:', error);
            return { success: false, error: error.message };
        }
    });

    // Check if CurseForge API is available
    ipcMain.handle('curseforge-check', async () => {
        return { success: true, available: curseForgeAPI !== null };
    });

    // ===== Modpack Creator Handlers =====

    ipcMain.handle('creator-new-modpack', async (event, modpackId, metadata) => {
        try {
            const result = modpackCreator.createNewModpack(modpackId, metadata);
            return result;
        } catch (error) {
            console.error('Error creating modpack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-import-from-minecraft', async (event, minecraftPath, modpackId, metadata) => {
        try {
            const result = await modpackCreator.importFromMinecraft(minecraftPath, modpackId, metadata);
            return result;
        } catch (error) {
            console.error('Error importing from Minecraft:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-list-workspaces', async () => {
        try {
            const workspaces = modpackCreator.listWorkspaces();
            return { success: true, workspaces };
        } catch (error) {
            console.error('Error listing workspaces:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-add-folder', async (event, modpackId, folderName) => {
        try {
            const result = modpackCreator.addFolder(modpackId, folderName);
            return result;
        } catch (error) {
            console.error('Error adding folder:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-add-file', async (event, modpackId, folderName, sourcePath) => {
        try {
            const result = await modpackCreator.addFile(modpackId, folderName, sourcePath);
            return result;
        } catch (error) {
            console.error('Error adding file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-add-mod-url', async (event, modpackId, url) => {
        try {
            const result = await modpackCreator.addModFromURL(modpackId, url, (downloaded, total, percent) => {
                mainWindow.webContents.send('creator-download-progress', {
                    type: 'url',
                    url,
                    downloaded,
                    total,
                    percent
                });
            });
            return result;
        } catch (error) {
            console.error('Error adding mod from URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-add-mod-curseforge', async (event, modpackId, modId, minecraftVersion) => {
        try {
            const result = await modpackCreator.addModFromCurseForge(modpackId, modId, minecraftVersion, (downloaded, total, percent) => {
                mainWindow.webContents.send('creator-download-progress', {
                    type: 'curseforge',
                    modId,
                    downloaded,
                    total,
                    percent
                });
            });
            return result;
        } catch (error) {
            console.error('Error adding mod from CurseForge:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-add-mods-curseforge', async (event, modpackId, modIds, minecraftVersion) => {
        try {
            const result = await modpackCreator.addModsFromCurseForge(modpackId, modIds, minecraftVersion, (progress) => {
                mainWindow.webContents.send('creator-batch-progress', progress);
            });
            return result;
        } catch (error) {
            console.error('Error adding mods from CurseForge:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-search-curseforge', async (event, modpackId, searchQuery, minecraftVersion) => {
        try {
            const results = await modpackCreator.searchAndAddMod(modpackId, searchQuery, minecraftVersion);
            return { success: true, results };
        } catch (error) {
            console.error('Error searching CurseForge:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-set-installer', async (event, modpackId, installerPath) => {
        try {
            const result = await modpackCreator.setInstaller(modpackId, installerPath);
            return result;
        } catch (error) {
            console.error('Error setting installer:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-update-metadata', async (event, modpackId, updates) => {
        try {
            const result = modpackCreator.updateMetadata(modpackId, updates);
            return result;
        } catch (error) {
            console.error('Error updating metadata:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-export-modpack', async (event, modpackId, exportAsZip) => {
        try {
            const result = await modpackCreator.exportModpack(modpackId, exportAsZip);
            return result;
        } catch (error) {
            console.error('Error exporting modpack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-delete-workspace', async (event, modpackId) => {
        try {
            const result = modpackCreator.deleteWorkspace(modpackId);
            return result;
        } catch (error) {
            console.error('Error deleting workspace:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-open-workspace', async (event, modpackId) => {
        try {
            const workDir = path.join(modpackCreator.workspacePath, modpackId);
            shell.openPath(workDir);
            return { success: true };
        } catch (error) {
            console.error('Error opening workspace:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-export-shareable', async (event, modpackId, exportAsZip) => {
        try {
            const result = await modpackCreator.exportToShareable(modpackId, exportAsZip);
            return result;
        } catch (error) {
            console.error('Error exporting to shareable location:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-export-project', async (event, modpackId, exportAsZip) => {
        try {
            const result = await modpackCreator.exportToProjectRoot(modpackId, exportAsZip);
            return result;
        } catch (error) {
            console.error('Error exporting to project root:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-load-to-workspace', async (event, modpackPath, newWorkspaceId) => {
        try {
            const result = await modpackCreator.loadModpackToWorkspace(modpackPath, newWorkspaceId);
            return result;
        } catch (error) {
            console.error('Error loading modpack to workspace:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-open-export-folder', async (event, folderType) => {
        try {
            let folderPath;
            if (folderType === 'shareable') {
                folderPath = path.join(app.getPath('documents'), 'KEK Modpacks');
            } else if (folderType === 'appdata') {
                folderPath = modpackCreator.modpacksPath;
            } else if (folderType === 'project') {
                const projectRoot = path.join(app.getAppPath(), '..');
                folderPath = path.join(projectRoot, 'modpacks');
            }
            if (folderPath) {
                shell.openPath(folderPath);
                return { success: true, path: folderPath };
            }
            return { success: false, error: 'Invalid folder type' };
        } catch (error) {
            console.error('Error opening export folder:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-install-from-url', async (event, modpackUrl, modpackId) => {
        try {
            const result = await modpackCreator.installFromURL(modpackUrl, modpackId);
            return result;
        } catch (error) {
            console.error('Error installing from URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-generate-public', async (event, modpackId, options) => {
        try {
            const result = await modpackCreator.generatePublicModpack(modpackId, options);
            return result;
        } catch (error) {
            console.error('Error generating public modpack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('creator-suggest-mod', async (event, modpackId, modInfo) => {
        try {
            const result = await modpackCreator.addModSuggestion(modpackId, modInfo);
            return result;
        } catch (error) {
            console.error('Error adding mod suggestion:', error);
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