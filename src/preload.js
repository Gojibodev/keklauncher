const { contextBridge, ipcRenderer } = require('electron');
require('dotenv').config();

contextBridge.exposeInMainWorld('electron', {
    // Window controls
    minimizeWindow: () => {
        console.log('Sending minimize-window event');
        ipcRenderer.send('minimize-window');
    },
    closeWindow: () => {
        console.log('Sending close-window event');
        ipcRenderer.send('close-window');
    },

    // Modpack management
    getModpacks: () => ipcRenderer.invoke('get-modpacks'),
    loadModpack: (modpackId) => ipcRenderer.invoke('load-modpack', modpackId),
    getModpackStats: (modpackId) => ipcRenderer.invoke('get-modpack-stats', modpackId),
    compareMods: (modpackId) => ipcRenderer.invoke('compare-mods', modpackId),
    downloadMods: (modpackId, onlyNew) => ipcRenderer.invoke('download-mods', modpackId, onlyNew),
    deleteMod: (modpackId, filename) => ipcRenderer.invoke('delete-mod', modpackId, filename),
    openModpackFolder: (modpackId) => ipcRenderer.invoke('open-modpack-folder', modpackId),
    getInstalledMods: (modpackId) => ipcRenderer.invoke('get-installed-mods', modpackId),

    // Modpack event listeners
    onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onModDownloadProgress: (callback) => ipcRenderer.on('mod-download-progress', (event, data) => callback(data)),
    onModDownloadOverall: (callback) => ipcRenderer.on('mod-download-overall', (event, data) => callback(data)),
    onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (event, data) => callback(data)),

    // Minecraft launcher
    launchMinecraft: (profileName) => ipcRenderer.invoke('launch-minecraft', profileName),
    checkMinecraft: () => ipcRenderer.invoke('check-minecraft'),
    switchModpack: (modpackId) => ipcRenderer.invoke('switch-modpack', modpackId),
    getActiveModpack: () => ipcRenderer.invoke('get-active-modpack'),
    createMinecraftProfile: (modpackName, minecraftVersion) => ipcRenderer.invoke('create-minecraft-profile', modpackName, minecraftVersion),

    // CurseForge API
    curseForgeSearch: (query, minecraftVersion) => ipcRenderer.invoke('curseforge-search', query, minecraftVersion),
    curseForgeGetMod: (modId, minecraftVersion) => ipcRenderer.invoke('curseforge-get-mod', modId, minecraftVersion),
    curseForgeCheck: () => ipcRenderer.invoke('curseforge-check')
});