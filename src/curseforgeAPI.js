const https = require('https');

class CurseForgeAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'api.curseforge.com';
        this.minecraftGameId = 432; // Minecraft game ID on CurseForge
    }

    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @returns {Promise<Object>} API response
     */
    async makeRequest(endpoint, method = 'GET') {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: endpoint,
                method: method,
                headers: {
                    'Accept': 'application/json',
                    'x-api-key': this.apiKey
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);

                        if (res.statusCode === 200) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`API Error: ${res.statusCode} - ${parsed.message || data}`));
                        }
                    } catch (error) {
                        reject(new Error(`Parse Error: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(30000, () => {
                req.abort();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    /**
     * Search for mods
     * @param {string} searchFilter - Search query
     * @param {string} minecraftVersion - Minecraft version filter
     * @param {number} pageSize - Results per page
     * @returns {Promise<Array>} List of mods
     */
    async searchMods(searchFilter, minecraftVersion = null, pageSize = 20) {
        try {
            let endpoint = `/v1/mods/search?gameId=${this.minecraftGameId}&searchFilter=${encodeURIComponent(searchFilter)}&pageSize=${pageSize}`;

            if (minecraftVersion) {
                endpoint += `&gameVersion=${minecraftVersion}`;
            }

            const response = await this.makeRequest(endpoint);
            return response.data || [];
        } catch (error) {
            console.error('Error searching mods:', error);
            throw error;
        }
    }

    /**
     * Get mod details by ID
     * @param {number} modId - CurseForge mod ID
     * @returns {Promise<Object>} Mod details
     */
    async getModDetails(modId) {
        try {
            const response = await this.makeRequest(`/v1/mods/${modId}`);
            return response.data;
        } catch (error) {
            console.error(`Error getting mod ${modId}:`, error);
            throw error;
        }
    }

    /**
     * Get mod files
     * @param {number} modId - CurseForge mod ID
     * @param {string} minecraftVersion - Minecraft version filter
     * @returns {Promise<Array>} List of mod files
     */
    async getModFiles(modId, minecraftVersion = null) {
        try {
            let endpoint = `/v1/mods/${modId}/files`;

            if (minecraftVersion) {
                endpoint += `?gameVersion=${minecraftVersion}`;
            }

            const response = await this.makeRequest(endpoint);
            return response.data || [];
        } catch (error) {
            console.error(`Error getting files for mod ${modId}:`, error);
            throw error;
        }
    }

    /**
     * Get download URL for a mod file
     * @param {number} modId - CurseForge mod ID
     * @param {number} fileId - File ID
     * @returns {Promise<string>} Download URL
     */
    async getModDownloadUrl(modId, fileId) {
        try {
            const response = await this.makeRequest(`/v1/mods/${modId}/files/${fileId}/download-url`);
            return response.data;
        } catch (error) {
            console.error(`Error getting download URL for ${modId}/${fileId}:`, error);
            throw error;
        }
    }

    /**
     * Get latest file for a mod
     * @param {number} modId - CurseForge mod ID
     * @param {string} minecraftVersion - Minecraft version
     * @returns {Promise<Object>} Latest file info
     */
    async getLatestModFile(modId, minecraftVersion) {
        try {
            const files = await this.getModFiles(modId, minecraftVersion);

            if (files.length === 0) {
                throw new Error('No files found for this mod version');
            }

            // Sort by date and get latest
            const sortedFiles = files.sort((a, b) =>
                new Date(b.fileDate) - new Date(a.fileDate)
            );

            return sortedFiles[0];
        } catch (error) {
            console.error(`Error getting latest file for mod ${modId}:`, error);
            throw error;
        }
    }

    /**
     * Convert mod info to modpack format
     * @param {number} modId - CurseForge mod ID
     * @param {string} minecraftVersion - Minecraft version
     * @returns {Promise<Object>} Mod in modpack format
     */
    async getModForModpack(modId, minecraftVersion) {
        try {
            const modDetails = await this.getModDetails(modId);
            const latestFile = await this.getLatestModFile(modId, minecraftVersion);
            const downloadUrl = await this.getModDownloadUrl(modId, latestFile.id);

            return {
                filename: latestFile.fileName,
                url: downloadUrl,
                hash: latestFile.hashes.find(h => h.algo === 1)?.value || '', // MD5
                version: latestFile.displayName,
                required: true,
                description: modDetails.summary,
                curseForgeId: modId,
                fileId: latestFile.id
            };
        } catch (error) {
            console.error(`Error converting mod ${modId} to modpack format:`, error);
            throw error;
        }
    }

    /**
     * Batch get mods for modpack
     * @param {Array<number>} modIds - Array of CurseForge mod IDs
     * @param {string} minecraftVersion - Minecraft version
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Array of mods in modpack format
     */
    async batchGetModsForModpack(modIds, minecraftVersion, onProgress) {
        const mods = [];
        let completed = 0;

        for (const modId of modIds) {
            try {
                const mod = await this.getModForModpack(modId, minecraftVersion);
                mods.push(mod);
                completed++;

                if (onProgress) {
                    onProgress(completed, modIds.length, mod.filename);
                }
            } catch (error) {
                console.error(`Failed to fetch mod ${modId}:`, error.message);
                completed++;

                if (onProgress) {
                    onProgress(completed, modIds.length, null);
                }
            }
        }

        return mods;
    }

    /**
     * Get featured/popular mods
     * @param {string} minecraftVersion - Minecraft version
     * @param {number} pageSize - Number of results
     * @returns {Promise<Array>} List of mods
     */
    async getFeaturedMods(minecraftVersion = null, pageSize = 20) {
        try {
            let endpoint = `/v1/mods/featured?gameId=${this.minecraftGameId}`;

            const body = {
                gameId: this.minecraftGameId,
                excludedModIds: [],
                gameVersionTypeId: null
            };

            // For featured mods, we need to use POST
            // This is a simplified version - full implementation would require POST support
            return await this.searchMods('', minecraftVersion, pageSize);
        } catch (error) {
            console.error('Error getting featured mods:', error);
            throw error;
        }
    }
}

module.exports = CurseForgeAPI;
