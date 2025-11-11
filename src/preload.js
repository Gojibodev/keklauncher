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
    curseForgeCheck: () => ipcRenderer.invoke('curseforge-check'),

    // Modpack Creator
    creatorNewModpack: (modpackId, metadata) => ipcRenderer.invoke('creator-new-modpack', modpackId, metadata),
    creatorImportFromMinecraft: (minecraftPath, modpackId, metadata) => ipcRenderer.invoke('creator-import-from-minecraft', minecraftPath, modpackId, metadata),
    creatorListWorkspaces: () => ipcRenderer.invoke('creator-list-workspaces'),
    creatorAddFolder: (modpackId, folderName) => ipcRenderer.invoke('creator-add-folder', modpackId, folderName),
    creatorAddFile: (modpackId, folderName, sourcePath) => ipcRenderer.invoke('creator-add-file', modpackId, folderName, sourcePath),
    creatorAddModFromURL: (modpackId, url) => ipcRenderer.invoke('creator-add-mod-url', modpackId, url),
    creatorAddModFromCurseForge: (modpackId, modId, minecraftVersion) => ipcRenderer.invoke('creator-add-mod-curseforge', modpackId, modId, minecraftVersion),
    creatorAddModsFromCurseForge: (modpackId, modIds, minecraftVersion) => ipcRenderer.invoke('creator-add-mods-curseforge', modpackId, modIds, minecraftVersion),
    creatorSearchCurseForge: (modpackId, searchQuery, minecraftVersion) => ipcRenderer.invoke('creator-search-curseforge', modpackId, searchQuery, minecraftVersion),
    creatorSetInstaller: (modpackId, installerPath) => ipcRenderer.invoke('creator-set-installer', modpackId, installerPath),
    creatorUpdateMetadata: (modpackId, updates) => ipcRenderer.invoke('creator-update-metadata', modpackId, updates),
    creatorExportModpack: (modpackId, exportAsZip) => ipcRenderer.invoke('creator-export-modpack', modpackId, exportAsZip),
    creatorDeleteWorkspace: (modpackId) => ipcRenderer.invoke('creator-delete-workspace', modpackId),
    creatorOpenWorkspace: (modpackId) => ipcRenderer.invoke('creator-open-workspace', modpackId),

    // Creator event listeners
    onCreatorDownloadProgress: (callback) => ipcRenderer.on('creator-download-progress', (event, data) => callback(data)),
    onCreatorBatchProgress: (callback) => ipcRenderer.on('creator-batch-progress', (event, data) => callback(data))
});