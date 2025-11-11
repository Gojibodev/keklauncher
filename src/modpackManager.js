const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ModpackManager {
    constructor(configPath, modsBasePath) {
        this.configPath = configPath || path.join(__dirname, '../modpacks');
        this.modsBasePath = modsBasePath || path.join(__dirname, '../mods');
        this.currentModpack = null;

        // Ensure directories exist
        this.ensureDirectories();
    }

    ensureDirectories() {
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
}

module.exports = ModpackManager;
