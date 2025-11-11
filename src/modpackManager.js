const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

class ModpackManager {
    constructor(configPath, modsBasePath) {
        // Use AppData/.kek for storing modpacks
        const appDataPath = app.getPath('appData');
        this.kekBasePath = path.join(appDataPath, '.kek');

        this.configPath = configPath || path.join(__dirname, '../modpacks');
        this.modsBasePath = modsBasePath || path.join(this.kekBasePath, 'modpacks');
        this.minecraftPath = this.getMinecraftPath();
        this.currentModpack = null;

        // Ensure directories exist
        this.ensureDirectories();
    }

    /**
     * Get the Minecraft installation path
     * @returns {string} Minecraft path
     */
    getMinecraftPath() {
        const appDataPath = app.getPath('appData');

        if (process.platform === 'win32') {
            return path.join(appDataPath, '.minecraft');
        } else if (process.platform === 'darwin') {
            return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
        } else {
            return path.join(app.getPath('home'), '.minecraft');
        }
    }

    ensureDirectories() {
        if (!fs.existsSync(this.kekBasePath)) {
            fs.mkdirSync(this.kekBasePath, { recursive: true });
        }
        if (!fs.existsSync(this.configPath)) {
            fs.mkdirSync(this.configPath, { recursive: true });
        }
        if (!fs.existsSync(this.modsBasePath)) {
            fs.mkdirSync(this.modsBasePath, { recursive: true });
        }
    }

    /**
     * Get all available modpacks
     * @returns {Array} List of modpack metadata
     */
    getAvailableModpacks() {
        const modpacks = [];

        try {
            const files = fs.readdirSync(this.configPath);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const configFile = path.join(this.configPath, file);
                    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    modpacks.push({
                        id: path.basename(file, '.json'),
                        name: config.name,
                        version: config.version,
                        description: config.description,
                        minecraftVersion: config.minecraftVersion
                    });
                }
            }
        } catch (error) {
            console.error('Error reading modpacks:', error);
        }

        return modpacks;
    }

    /**
     * Load a modpack configuration
     * @param {string} modpackId - The modpack identifier
     * @returns {Object|null} Modpack configuration or null if not found
     */
    loadModpack(modpackId) {
        try {
            const configFile = path.join(this.configPath, `${modpackId}.json`);

            if (!fs.existsSync(configFile)) {
                console.error(`Modpack ${modpackId} not found`);
                return null;
            }

            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            this.currentModpack = config;
            return config;
        } catch (error) {
            console.error(`Error loading modpack ${modpackId}:`, error);
            return null;
        }
    }

    /**
     * Get the installation path for a modpack
     * @param {string} modpackId - The modpack identifier
     * @returns {string} Installation path
     */
    getModpackPath(modpackId) {
        return path.join(this.modsBasePath, modpackId);
    }

    /**
     * Get installed mods for a modpack
     * @param {string} modpackId - The modpack identifier
     * @returns {Array} List of installed mods with metadata
     */
    getInstalledMods(modpackId) {
        const modpackPath = this.getModpackPath(modpackId);
        const installedMods = [];

        if (!fs.existsSync(modpackPath)) {
            return installedMods;
        }

        try {
            const files = fs.readdirSync(modpackPath);

            for (const file of files) {
                if (file.endsWith('.jar')) {
                    const filePath = path.join(modpackPath, file);
                    const stats = fs.statSync(filePath);

                    installedMods.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        modified: stats.mtime,
                        hash: this.calculateFileHash(filePath)
                    });
                }
            }
        } catch (error) {
            console.error(`Error reading installed mods for ${modpackId}:`, error);
        }

        return installedMods;
    }

    /**
     * Calculate MD5 hash of a file
     * @param {string} filePath - Path to file
     * @returns {string} MD5 hash
     */
    calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('md5');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            console.error(`Error calculating hash for ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Compare installed mods with modpack configuration
     * @param {string} modpackId - The modpack identifier
     * @returns {Object} Comparison result with missing, outdated, and extra mods
     */
    compareModsWithConfig(modpackId) {
        const config = this.loadModpack(modpackId);
        if (!config) {
            return { missing: [], outdated: [], extra: [], upToDate: [] };
        }

        const installedMods = this.getInstalledMods(modpackId);
        const installedMap = new Map();

        // Create map of installed mods
        for (const mod of installedMods) {
            installedMap.set(mod.filename, mod);
        }

        const missing = [];
        const outdated = [];
        const upToDate = [];

        // Check each mod in config
        for (const configMod of config.mods) {
            const installed = installedMap.get(configMod.filename);

            if (!installed) {
                missing.push(configMod);
            } else if (configMod.hash && installed.hash !== configMod.hash) {
                outdated.push({
                    ...configMod,
                    currentHash: installed.hash
                });
            } else {
                upToDate.push(configMod);
            }

            // Remove from map to track extras
            installedMap.delete(configMod.filename);
        }

        // Remaining items in map are extra mods
        const extra = Array.from(installedMap.values());

        return { missing, outdated, extra, upToDate };
    }

    /**
     * Create a new modpack configuration
     * @param {Object} config - Modpack configuration
     * @returns {boolean} Success status
     */
    createModpack(config) {
        try {
            const configFile = path.join(this.configPath, `${config.id}.json`);
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.error('Error creating modpack:', error);
            return false;
        }
    }

    /**
     * Delete a mod file
     * @param {string} modpackId - The modpack identifier
     * @param {string} filename - Mod filename
     * @returns {boolean} Success status
     */
    deleteMod(modpackId, filename) {
        try {
            const modPath = path.join(this.getModpackPath(modpackId), filename);

            if (fs.existsSync(modPath)) {
                fs.unlinkSync(modPath);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`Error deleting mod ${filename}:`, error);
            return false;
        }
    }

    /**
     * Get modpack statistics
     * @param {string} modpackId - The modpack identifier
     * @returns {Object} Statistics
     */
    getModpackStats(modpackId) {
        const comparison = this.compareModsWithConfig(modpackId);
        const installedMods = this.getInstalledMods(modpackId);

        let totalSize = 0;
        for (const mod of installedMods) {
            totalSize += mod.size;
        }

        return {
            totalMods: installedMods.length,
            totalSize,
            missing: comparison.missing.length,
            outdated: comparison.outdated.length,
            extra: comparison.extra.length,
            upToDate: comparison.upToDate.length
        };
    }

    /**
     * Switch active modpack by copying/symlinking mods to Minecraft
     * @param {string} modpackId - The modpack identifier
     * @param {string} method - 'copy' or 'symlink'
     * @returns {Object} Result with success status
     */
    switchToModpack(modpackId, method = 'copy') {
        try {
            const modpackPath = this.getModpackPath(modpackId);
            const minecraftModsPath = path.join(this.minecraftPath, 'mods');

            if (!fs.existsSync(modpackPath)) {
                return { success: false, error: 'Modpack not found' };
            }

            // Backup current mods if they exist
            if (fs.existsSync(minecraftModsPath)) {
                const backupPath = path.join(this.kekBasePath, 'backups', `mods_${Date.now()}`);
                fs.mkdirSync(path.dirname(backupPath), { recursive: true });
                fs.renameSync(minecraftModsPath, backupPath);
            }

            // Create new mods directory
            fs.mkdirSync(minecraftModsPath, { recursive: true });

            // Copy or symlink mods
            const mods = fs.readdirSync(modpackPath);
            let copiedCount = 0;

            for (const mod of mods) {
                if (mod.endsWith('.jar')) {
                    const sourcePath = path.join(modpackPath, mod);
                    const targetPath = path.join(minecraftModsPath, mod);

                    if (method === 'symlink' && process.platform !== 'win32') {
                        // Symlink on Unix-like systems
                        fs.symlinkSync(sourcePath, targetPath);
                    } else {
                        // Copy files
                        fs.copyFileSync(sourcePath, targetPath);
                    }

                    copiedCount++;
                }
            }

            // Save active modpack info
            const activeFile = path.join(this.kekBasePath, 'active_modpack.json');
            fs.writeFileSync(activeFile, JSON.stringify({
                modpackId,
                switchedAt: new Date().toISOString(),
                method
            }, null, 2));

            return { success: true, copiedCount };
        } catch (error) {
            console.error('Error switching modpack:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get the currently active modpack
     * @returns {Object|null} Active modpack info
     */
    getActiveModpack() {
        try {
            const activeFile = path.join(this.kekBasePath, 'active_modpack.json');

            if (fs.existsSync(activeFile)) {
                return JSON.parse(fs.readFileSync(activeFile, 'utf8'));
            }

            return null;
        } catch (error) {
            console.error('Error getting active modpack:', error);
            return null;
        }
    }

    /**
     * Restore Minecraft mods from backup
     * @returns {Object} Result with success status
     */
    restoreMinecraftMods() {
        try {
            const backupsPath = path.join(this.kekBasePath, 'backups');
            const minecraftModsPath = path.join(this.minecraftPath, 'mods');

            if (!fs.existsSync(backupsPath)) {
                return { success: false, error: 'No backups found' };
            }

            // Get most recent backup
            const backups = fs.readdirSync(backupsPath)
                .filter(f => f.startsWith('mods_'))
                .sort()
                .reverse();

            if (backups.length === 0) {
                return { success: false, error: 'No backups found' };
            }

            const latestBackup = path.join(backupsPath, backups[0]);

            // Remove current mods
            if (fs.existsSync(minecraftModsPath)) {
                fs.rmSync(minecraftModsPath, { recursive: true, force: true });
            }

            // Restore backup
            fs.renameSync(latestBackup, minecraftModsPath);

            // Clear active modpack
            const activeFile = path.join(this.kekBasePath, 'active_modpack.json');
            if (fs.existsSync(activeFile)) {
                fs.unlinkSync(activeFile);
            }

            return { success: true };
        } catch (error) {
            console.error('Error restoring mods:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ModpackManager;
