const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

class ModpackCreator {
    constructor(curseForgeAPI = null) {
        this.kekBasePath = path.join(app.getPath('appData'), '.kek');
        this.workspacePath = path.join(this.kekBasePath, 'workspace');
        this.modpacksPath = path.join(this.kekBasePath, 'modpacks');
        this.curseForgeAPI = curseForgeAPI;

        // Essential and optional folders for a modpack
        this.folderStructure = {
            essential: ['mods', 'config'],
            optional: ['resourcepacks', 'shaderpacks', 'scripts', 'defaultconfigs',
                      'kubejs', 'openloader', 'schematics', 'journeymap', 'saves']
        };

        this.ensureDirectories();
    }

    ensureDirectories() {
        fs.ensureDirSync(this.workspacePath);
        fs.ensureDirSync(this.modpacksPath);
    }

    /**
     * Create a new modpack workspace
     */
    createNewModpack(modpackId, metadata = {}) {
        const workDir = path.join(this.workspacePath, modpackId);

        if (fs.existsSync(workDir)) {
            throw new Error(`Modpack workspace '${modpackId}' already exists`);
        }

        // Create folder structure
        fs.ensureDirSync(workDir);

        // Create essential folders
        this.folderStructure.essential.forEach(folder => {
            fs.ensureDirSync(path.join(workDir, folder));
        });

        // Create metadata file
        const defaultMetadata = {
            id: modpackId,
            name: metadata.name || modpackId,
            version: metadata.version || '1.0.0',
            minecraftVersion: metadata.minecraftVersion || '1.20.1',
            modloader: {
                type: metadata.modloaderType || 'forge',
                version: metadata.modloaderVersion || 'latest'
            },
            author: metadata.author || 'Unknown',
            description: metadata.description || '',
            requiredRam: metadata.requiredRam || '4G',
            javaVersion: metadata.javaVersion || '17',
            createdAt: new Date().toISOString(),
            folders: {
                essential: [...this.folderStructure.essential],
                optional: []
            },
            mods: [],
            installer: null
        };

        fs.writeFileSync(
            path.join(workDir, 'modpack.json'),
            JSON.stringify(defaultMetadata, null, 2)
        );

        return {
            success: true,
            path: workDir,
            metadata: defaultMetadata
        };
    }

    /**
     * Import from existing Minecraft installation
     */
    async importFromMinecraft(minecraftPath, modpackId, metadata = {}) {
        const workDir = path.join(this.workspacePath, modpackId);

        if (fs.existsSync(workDir)) {
            throw new Error(`Modpack workspace '${modpackId}' already exists`);
        }

        fs.ensureDirSync(workDir);

        const importedFolders = [];
        const allFolders = [...this.folderStructure.essential, ...this.folderStructure.optional];

        // Copy folders that exist
        for (const folder of allFolders) {
            const sourcePath = path.join(minecraftPath, folder);
            if (fs.existsSync(sourcePath)) {
                const destPath = path.join(workDir, folder);
                await fs.copy(sourcePath, destPath);
                importedFolders.push(folder);
            }
        }

        // Detect modloader from mods
        const modloaderInfo = await this.detectModloader(path.join(workDir, 'mods'));

        // Scan mods and create metadata
        const mods = await this.scanMods(path.join(workDir, 'mods'));

        const modpackMetadata = {
            id: modpackId,
            name: metadata.name || modpackId,
            version: metadata.version || '1.0.0',
            minecraftVersion: metadata.minecraftVersion || modloaderInfo.minecraftVersion || '1.20.1',
            modloader: modloaderInfo,
            author: metadata.author || 'Unknown',
            description: metadata.description || 'Imported from Minecraft installation',
            requiredRam: metadata.requiredRam || '4G',
            javaVersion: metadata.javaVersion || '17',
            createdAt: new Date().toISOString(),
            importedFrom: minecraftPath,
            folders: {
                essential: this.folderStructure.essential.filter(f => importedFolders.includes(f)),
                optional: this.folderStructure.optional.filter(f => importedFolders.includes(f))
            },
            mods: mods,
            installer: null
        };

        fs.writeFileSync(
            path.join(workDir, 'modpack.json'),
            JSON.stringify(modpackMetadata, null, 2)
        );

        return {
            success: true,
            path: workDir,
            metadata: modpackMetadata,
            importedFolders
        };
    }

    /**
     * Detect modloader type from mods folder
     */
    async detectModloader(modsPath) {
        if (!fs.existsSync(modsPath)) {
            return { type: 'forge', version: 'unknown' };
        }

        const files = fs.readdirSync(modsPath);
        let hasForgeMods = false;
        let hasFabricMods = false;

        // Simple detection based on mod file names and common patterns
        for (const file of files) {
            if (!file.endsWith('.jar')) continue;

            const lowerFile = file.toLowerCase();

            // Check for Fabric indicators
            if (lowerFile.includes('fabric') || lowerFile.includes('modmenu')) {
                hasFabricMods = true;
            }

            // Check for Forge indicators
            if (lowerFile.includes('forge') || lowerFile.includes('geckolib-forge')) {
                hasForgeMods = true;
            }
        }

        // Fabric takes priority if both are detected (hybrid packs usually use Fabric)
        if (hasFabricMods) {
            return { type: 'fabric', version: 'unknown' };
        } else if (hasForgeMods) {
            return { type: 'forge', version: 'unknown' };
        }

        return { type: 'forge', version: 'unknown' };
    }

    /**
     * Scan mods folder and create mod list
     */
    async scanMods(modsPath) {
        if (!fs.existsSync(modsPath)) {
            return [];
        }

        const mods = [];
        const files = fs.readdirSync(modsPath);

        for (const file of files) {
            if (!file.endsWith('.jar')) continue;

            const filePath = path.join(modsPath, file);
            const stats = fs.statSync(filePath);
            const hash = await this.calculateHash(filePath);

            mods.push({
                filename: file,
                hash: hash,
                size: stats.size,
                required: true,
                version: this.extractVersionFromFilename(file)
            });
        }

        return mods;
    }

    /**
     * Extract version from filename (best effort)
     */
    extractVersionFromFilename(filename) {
        // Common patterns: modname-1.20.1-1.0.0.jar, modname-1.0.0-forge.jar
        const versionMatch = filename.match(/[-_](\d+\.\d+(?:\.\d+)?)/);
        return versionMatch ? versionMatch[1] : 'unknown';
    }

    /**
     * Add folder to modpack
     */
    addFolder(modpackId, folderName) {
        const workDir = path.join(this.workspacePath, modpackId);
        const folderPath = path.join(workDir, folderName);

        if (!fs.existsSync(workDir)) {
            throw new Error('Modpack workspace not found');
        }

        fs.ensureDirSync(folderPath);

        // Update metadata
        const metadataPath = path.join(workDir, 'modpack.json');
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        if (!metadata.folders.essential.includes(folderName) &&
            !metadata.folders.optional.includes(folderName)) {
            metadata.folders.optional.push(folderName);
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        }

        return { success: true, folder: folderName };
    }

    /**
     * Add file to modpack folder
     */
    async addFile(modpackId, folderName, sourcePath) {
        const workDir = path.join(this.workspacePath, modpackId);
        const folderPath = path.join(workDir, folderName);

        if (!fs.existsSync(workDir)) {
            throw new Error('Modpack workspace not found');
        }

        fs.ensureDirSync(folderPath);

        const filename = path.basename(sourcePath);
        const destPath = path.join(folderPath, filename);

        await fs.copy(sourcePath, destPath);

        // If adding to mods folder, update metadata
        if (folderName === 'mods') {
            await this.updateModsList(modpackId);
        }

        return { success: true, file: filename, folder: folderName };
    }

    /**
     * Update mods list in metadata
     */
    async updateModsList(modpackId) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        const mods = await this.scanMods(path.join(workDir, 'mods'));
        metadata.mods = mods;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    /**
     * Set modloader installer
     */
    async setInstaller(modpackId, installerPath) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Modpack metadata not found');
        }

        const installerFilename = path.basename(installerPath);
        const destPath = path.join(workDir, installerFilename);

        await fs.copy(installerPath, destPath);

        // Update metadata
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        metadata.installer = {
            filename: installerFilename,
            type: installerFilename.includes('forge') ? 'forge' :
                  installerFilename.includes('fabric') ? 'fabric' : 'unknown',
            hash: await this.calculateHash(destPath)
        };

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return { success: true, installer: installerFilename };
    }

    /**
     * Export modpack to final location
     */
    async exportModpack(modpackId, exportAsZip = false, customPath = null) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Modpack metadata not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // Determine export path
        let finalPath;
        if (customPath) {
            finalPath = path.join(customPath, modpackId);
        } else {
            finalPath = path.join(this.modpacksPath, modpackId);
        }

        fs.ensureDirSync(finalPath);

        // Copy all folders
        const allFolders = [...metadata.folders.essential, ...metadata.folders.optional];
        for (const folder of allFolders) {
            const sourcePath = path.join(workDir, folder);
            if (fs.existsSync(sourcePath)) {
                await fs.copy(sourcePath, path.join(finalPath, folder));
            }
        }

        // Copy installer if exists
        if (metadata.installer) {
            const installerPath = path.join(workDir, metadata.installer.filename);
            if (fs.existsSync(installerPath)) {
                await fs.copy(installerPath, path.join(finalPath, metadata.installer.filename));
            }
        }

        // Copy metadata
        await fs.copy(metadataPath, path.join(finalPath, 'modpack.json'));

        // Create README for sharing
        await this.createReadme(finalPath, metadata);

        let zipPath = null;
        if (exportAsZip) {
            const zipDir = customPath || this.modpacksPath;
            zipPath = path.join(zipDir, `${modpackId}.zip`);
            await this.createZip(finalPath, zipPath);
        }

        return {
            success: true,
            path: finalPath,
            zipPath: zipPath,
            metadata: metadata
        };
    }

    /**
     * Export to shareable location (Documents/KEK Modpacks)
     */
    async exportToShareable(modpackId, exportAsZip = false) {
        const documentsPath = app.getPath('documents');
        const shareablePath = path.join(documentsPath, 'KEK Modpacks');
        fs.ensureDirSync(shareablePath);

        return await this.exportModpack(modpackId, exportAsZip, shareablePath);
    }

    /**
     * Export to project root modpacks folder (for development)
     */
    async exportToProjectRoot(modpackId, exportAsZip = false) {
        // Get project root (assuming src is one level down)
        const projectRoot = path.join(app.getAppPath(), '..');
        const projectModpacksPath = path.join(projectRoot, 'modpacks');
        fs.ensureDirSync(projectModpacksPath);

        return await this.exportModpack(modpackId, exportAsZip, projectModpacksPath);
    }

    /**
     * Load existing modpack into workspace for editing
     */
    async loadModpackToWorkspace(modpackPath, newWorkspaceId = null) {
        const metadataPath = path.join(modpackPath, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Invalid modpack: modpack.json not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const workspaceId = newWorkspaceId || metadata.id || path.basename(modpackPath);

        const workDir = path.join(this.workspacePath, workspaceId);

        if (fs.existsSync(workDir)) {
            throw new Error(`Workspace '${workspaceId}' already exists`);
        }

        // Copy entire modpack to workspace
        await fs.copy(modpackPath, workDir);

        return {
            success: true,
            path: workDir,
            workspaceId: workspaceId,
            metadata: metadata
        };
    }

    /**
     * Create README file for sharing
     */
    async createReadme(modpackPath, metadata) {
        const readmeContent = `# ${metadata.name}

**Version:** ${metadata.version}
**Minecraft Version:** ${metadata.minecraftVersion}
**Modloader:** ${metadata.modloader.type} (${metadata.modloader.version})
**Author:** ${metadata.author}
**Required RAM:** ${metadata.requiredRam}
**Java Version:** ${metadata.javaVersion}

## Description
${metadata.description || 'No description provided'}

## Installation

### Automatic (KEK Launcher) - From URL
1. Open KEK Launcher → Modpack Creator
2. Click "Import from URL"
3. Paste the modpack.json URL
4. Click "Download & Install"

### Automatic (KEK Launcher) - Manual
1. Open KEK Launcher
2. Place this modpack folder in: \`%AppData%/.kek/modpacks/\`
3. Restart KEK Launcher
4. Select the modpack and click Download/Launch

### Manual
1. Install ${metadata.modloader.type} ${metadata.modloader.version} for Minecraft ${metadata.minecraftVersion}
2. Copy the \`mods/\` folder to your \`.minecraft/mods/\`
3. Copy the \`config/\` folder to your \`.minecraft/config/\`
4. Copy any other folders (resourcepacks, shaderpacks, etc.) to their respective locations
5. Launch Minecraft with the ${metadata.modloader.type} profile

## Mods Included
This modpack contains ${metadata.mods.length} mods.

## Suggest Mods
Want a mod added? Open an issue or vote for existing suggestions!
${metadata.votingUrl ? `Vote here: ${metadata.votingUrl}` : ''}

## Created with KEK Launcher
Modpack created using KEK Launcher's Modpack Creator
Created: ${metadata.createdAt || 'Unknown'}
${metadata.updatedAt ? `Last Updated: ${metadata.updatedAt}` : ''}
`;

        const readmePath = path.join(modpackPath, 'README.md');
        await fs.writeFile(readmePath, readmeContent);
    }

    /**
     * Download and install modpack from public URL
     */
    async installFromURL(modpackUrl, modpackId = null) {
        try {
            // Download modpack.json
            const modpackData = await this.downloadJSON(modpackUrl);

            const workspaceId = modpackId || modpackData.id || `modpack_${Date.now()}`;
            const workDir = path.join(this.workspacePath, workspaceId);

            if (fs.existsSync(workDir)) {
                throw new Error(`Modpack '${workspaceId}' already exists`);
            }

            // Create workspace
            this.createNewModpack(workspaceId, modpackData);

            // Download all mods
            const results = {
                successful: 0,
                failed: 0,
                mods: []
            };

            for (const mod of modpackData.mods) {
                try {
                    if (mod.url) {
                        await this.addModFromURL(workspaceId, mod.url);
                        results.successful++;
                        results.mods.push({ ...mod, status: 'success' });
                    } else if (mod.curseForgeId && this.curseForgeAPI) {
                        await this.addModFromCurseForge(workspaceId, mod.curseForgeId, modpackData.minecraftVersion);
                        results.successful++;
                        results.mods.push({ ...mod, status: 'success' });
                    }
                } catch (error) {
                    results.failed++;
                    results.mods.push({ ...mod, status: 'failed', error: error.message });
                }
            }

            // Update metadata with source URL
            await this.updateMetadata(workspaceId, {
                sourceUrl: modpackUrl,
                installedFrom: 'url'
            });

            return {
                success: true,
                workspaceId: workspaceId,
                results: results
            };

        } catch (error) {
            throw new Error(`Failed to install from URL: ${error.message}`);
        }
    }

    /**
     * Download JSON from URL
     */
    async downloadJSON(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.downloadJSON(response.headers.location)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            request.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Generate public modpack JSON for hosting
     */
    async generatePublicModpack(modpackId, options = {}) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Modpack metadata not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // Create version history entry for this export
        const versionHistory = metadata.versionHistory || [];
        if (metadata.version) {
            const currentVersion = {
                version: metadata.version,
                date: new Date().toISOString(),
                changes: options.changes || [],
                modsAdded: options.modsAdded || [],
                modsRemoved: options.modsRemoved || [],
                modsUpdated: options.modsUpdated || []
            };

            // Only add if not already present
            if (!versionHistory.find(v => v.version === metadata.version)) {
                versionHistory.unshift(currentVersion);
            }
        }

        // Create public modpack JSON
        const publicModpack = {
            id: metadata.id,
            name: metadata.name,
            version: metadata.version,
            minecraftVersion: metadata.minecraftVersion,
            modloader: metadata.modloader,
            author: metadata.author,
            description: metadata.description,
            requiredRam: metadata.requiredRam,
            javaVersion: metadata.javaVersion,
            createdAt: metadata.createdAt,
            updatedAt: new Date().toISOString(),
            images: {
                thumbnail: options.thumbnail || metadata.images?.thumbnail || null,
                banner: options.banner || metadata.images?.banner || null,
                gallery: options.gallery || metadata.images?.gallery || []
            },
            mods: metadata.mods.map(mod => ({
                filename: mod.filename,
                url: mod.url || null,
                curseForgeId: mod.curseForgeId || null,
                hash: mod.hash,
                version: mod.version,
                required: mod.required !== false
            })),
            folders: metadata.folders,
            votingUrl: options.votingUrl || metadata.votingUrl || null,
            issuesUrl: options.issuesUrl || metadata.issuesUrl || null,
            downloadUrl: options.downloadUrl || null,
            versionHistory: versionHistory,
            tags: options.tags || metadata.tags || [],
            difficulty: options.difficulty || metadata.difficulty || 'normal',
            playstyle: options.playstyle || metadata.playstyle || null,
            votes: metadata.votes || {
                totalDownloads: 0,
                suggestedMods: []
            }
        };

        // Save public JSON
        const publicPath = path.join(workDir, 'modpack.public.json');
        await fs.writeFile(publicPath, JSON.stringify(publicModpack, null, 2));

        // Also update the metadata with new fields
        metadata.versionHistory = versionHistory;
        if (options.thumbnail) metadata.images = metadata.images || {};
        if (options.thumbnail) metadata.images.thumbnail = options.thumbnail;
        if (options.banner) metadata.images.banner = options.banner;
        if (options.gallery) metadata.images.gallery = options.gallery;
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return {
            success: true,
            path: publicPath,
            json: publicModpack
        };
    }

    /**
     * Add mod vote/suggestion
     */
    async addModSuggestion(modpackId, modInfo) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Modpack metadata not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        if (!metadata.votes) {
            metadata.votes = {
                totalDownloads: 0,
                suggestedMods: []
            };
        }

        // Check if mod already suggested
        const existing = metadata.votes.suggestedMods.find(
            m => m.name.toLowerCase() === modInfo.name.toLowerCase() ||
                 m.curseForgeId === modInfo.curseForgeId
        );

        if (existing) {
            existing.votes++;
            existing.lastVoted = new Date().toISOString();
        } else {
            metadata.votes.suggestedMods.push({
                name: modInfo.name,
                curseForgeId: modInfo.curseForgeId || null,
                url: modInfo.url || null,
                votes: 1,
                suggestedBy: modInfo.suggestedBy || 'Anonymous',
                suggestedAt: new Date().toISOString(),
                lastVoted: new Date().toISOString()
            });
        }

        // Sort by votes
        metadata.votes.suggestedMods.sort((a, b) => b.votes - a.votes);

        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return {
            success: true,
            suggestions: metadata.votes.suggestedMods
        };
    }

    /**
     * Create zip archive
     */
    async createZip(sourceDir, outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve());
            archive.on('error', (err) => reject(err));

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    /**
     * Get list of workspaces
     */
    listWorkspaces() {
        if (!fs.existsSync(this.workspacePath)) {
            return [];
        }

        const workspaces = [];
        const dirs = fs.readdirSync(this.workspacePath);

        for (const dir of dirs) {
            const metadataPath = path.join(this.workspacePath, dir, 'modpack.json');
            if (fs.existsSync(metadataPath)) {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                workspaces.push({
                    id: dir,
                    metadata: metadata,
                    path: path.join(this.workspacePath, dir)
                });
            }
        }

        return workspaces;
    }

    /**
     * Update modpack metadata
     */
    updateMetadata(modpackId, updates) {
        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(metadataPath)) {
            throw new Error('Modpack metadata not found');
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        Object.assign(metadata, updates);
        metadata.updatedAt = new Date().toISOString();

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return { success: true, metadata: metadata };
    }

    /**
     * Delete workspace
     */
    deleteWorkspace(modpackId) {
        const workDir = path.join(this.workspacePath, modpackId);

        if (fs.existsSync(workDir)) {
            fs.removeSync(workDir);
            return { success: true };
        }

        return { success: false, error: 'Workspace not found' };
    }

    /**
     * Add mod from direct URL
     */
    async addModFromURL(modpackId, url, onProgress = null) {
        const workDir = path.join(this.workspacePath, modpackId);
        const modsPath = path.join(workDir, 'mods');

        if (!fs.existsSync(workDir)) {
            throw new Error('Modpack workspace not found');
        }

        fs.ensureDirSync(modsPath);

        // Extract filename from URL or generate one
        let filename = path.basename(new URL(url).pathname);
        if (!filename.endsWith('.jar')) {
            filename = `mod_${Date.now()}.jar`;
        }

        const outputPath = path.join(modsPath, filename);

        // Download the mod
        await this.downloadFile(url, outputPath, onProgress);

        // Update mods list
        await this.updateModsList(modpackId);

        return {
            success: true,
            filename: filename,
            path: outputPath
        };
    }

    /**
     * Add mod from CurseForge
     */
    async addModFromCurseForge(modpackId, modId, minecraftVersion = null, onProgress = null) {
        if (!this.curseForgeAPI) {
            throw new Error('CurseForge API not configured');
        }

        const workDir = path.join(this.workspacePath, modpackId);
        const modsPath = path.join(workDir, 'mods');
        const metadataPath = path.join(workDir, 'modpack.json');

        if (!fs.existsSync(workDir)) {
            throw new Error('Modpack workspace not found');
        }

        fs.ensureDirSync(modsPath);

        // Get Minecraft version from metadata if not provided
        if (!minecraftVersion && fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            minecraftVersion = metadata.minecraftVersion;
        }

        // Get mod info from CurseForge
        const modInfo = await this.curseForgeAPI.getModForModpack(modId, minecraftVersion);

        // Download the mod
        const outputPath = path.join(modsPath, modInfo.filename);
        await this.downloadFile(modInfo.url, outputPath, onProgress);

        // Verify hash if provided
        if (modInfo.hash) {
            const calculatedHash = await this.calculateHash(outputPath);
            if (calculatedHash !== modInfo.hash) {
                fs.unlinkSync(outputPath);
                throw new Error(`Hash mismatch for ${modInfo.filename}`);
            }
        }

        // Update mods list
        await this.updateModsList(modpackId);

        return {
            success: true,
            filename: modInfo.filename,
            path: outputPath,
            curseForgeId: modId
        };
    }

    /**
     * Add multiple mods from CurseForge
     */
    async addModsFromCurseForge(modpackId, modIds, minecraftVersion = null, onProgress = null) {
        const results = [];
        let successful = 0;
        let failed = 0;

        for (let i = 0; i < modIds.length; i++) {
            try {
                const result = await this.addModFromCurseForge(
                    modpackId,
                    modIds[i],
                    minecraftVersion,
                    (downloaded, total, percent) => {
                        if (onProgress) {
                            onProgress({
                                currentMod: i + 1,
                                totalMods: modIds.length,
                                modId: modIds[i],
                                downloaded,
                                total,
                                percent
                            });
                        }
                    }
                );
                results.push({ modId: modIds[i], ...result });
                successful++;
            } catch (error) {
                results.push({
                    modId: modIds[i],
                    success: false,
                    error: error.message
                });
                failed++;
            }
        }

        return {
            successful,
            failed,
            results
        };
    }

    /**
     * Search CurseForge and add mod
     */
    async searchAndAddMod(modpackId, searchQuery, minecraftVersion = null) {
        if (!this.curseForgeAPI) {
            throw new Error('CurseForge API not configured');
        }

        const workDir = path.join(this.workspacePath, modpackId);
        const metadataPath = path.join(workDir, 'modpack.json');

        // Get Minecraft version from metadata if not provided
        if (!minecraftVersion && fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            minecraftVersion = metadata.minecraftVersion;
        }

        // Search for mods
        const searchResults = await this.curseForgeAPI.searchMods(searchQuery, minecraftVersion);

        return searchResults;
    }

    /**
     * Download file from URL
     */
    async downloadFile(url, outputPath, onProgress = null) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.downloadFile(response.headers.location, outputPath, onProgress)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;

                const fileStream = fs.createWriteStream(outputPath);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (onProgress && totalBytes) {
                        const percent = (downloadedBytes / totalBytes * 100).toFixed(2);
                        onProgress(downloadedBytes, totalBytes, percent);
                    }
                });

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (err) => {
                    fs.unlinkSync(outputPath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
                reject(err);
            });
        });
    }

    /**
     * Calculate MD5 hash of file
     */
    async calculateHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
}

module.exports = ModpackCreator;
