const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

class ModDownloader {
    constructor(targetDir) {
        this.targetDir = targetDir;
        this.activeDownloads = new Map();
    }

    /**
     * Download a mod from URL
     * @param {Object} modInfo - Mod information (url, filename, hash)
     * @param {Function} onProgress - Progress callback (bytesDownloaded, totalBytes, percent)
     * @returns {Promise<Object>} Download result
     */
    async downloadMod(modInfo, onProgress) {
        const { url, filename, hash } = modInfo;
        const outputPath = path.join(this.targetDir, filename);

        // Ensure target directory exists
        if (!fs.existsSync(this.targetDir)) {
            fs.mkdirSync(this.targetDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    console.log(`Redirecting to: ${redirectUrl}`);

                    this.downloadMod({ url: redirectUrl, filename, hash }, onProgress)
                        .then(resolve)
                        .catch(reject);

                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                    return;
                }

                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;

                const fileStream = fs.createWriteStream(outputPath);
                const hashSum = crypto.createHash('md5');

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    hashSum.update(chunk);

                    if (onProgress) {
                        const percent = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
                        onProgress(downloadedBytes, totalBytes, percent);
                    }
                });

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();

                    const calculatedHash = hashSum.digest('hex');

                    // Verify hash if provided
                    if (hash && calculatedHash !== hash) {
                        fs.unlinkSync(outputPath); // Delete corrupted file
                        reject(new Error(`Hash mismatch: expected ${hash}, got ${calculatedHash}`));
                        return;
                    }

                    resolve({
                        success: true,
                        filename,
                        path: outputPath,
                        size: downloadedBytes,
                        hash: calculatedHash
                    });
                });

                fileStream.on('error', (err) => {
                    fs.unlinkSync(outputPath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.setTimeout(30000, () => {
                request.abort();
                reject(new Error('Download timeout'));
            });

            // Store active download for cancellation
            this.activeDownloads.set(filename, request);
        });
    }

    /**
     * Download multiple mods
     * @param {Array} modsList - Array of mod info objects
     * @param {Function} onModProgress - Progress callback for individual mod
     * @param {Function} onOverallProgress - Overall progress callback
     * @param {boolean} onlyNew - Only download new mods (skip existing)
     * @returns {Promise<Object>} Download results
     */
    async downloadMods(modsList, onModProgress, onOverallProgress, onlyNew = false) {
        const results = {
            successful: [],
            failed: [],
            skipped: []
        };

        let completedCount = 0;
        const totalMods = modsList.length;

        for (const modInfo of modsList) {
            try {
                const outputPath = path.join(this.targetDir, modInfo.filename);

                // Skip if file exists and onlyNew is true
                if (onlyNew && fs.existsSync(outputPath)) {
                    console.log(`Skipping existing mod: ${modInfo.filename}`);
                    results.skipped.push(modInfo.filename);
                    completedCount++;

                    if (onOverallProgress) {
                        onOverallProgress(completedCount, totalMods);
                    }

                    continue;
                }

                console.log(`Downloading: ${modInfo.filename}`);

                const result = await this.downloadMod(modInfo, (downloaded, total, percent) => {
                    if (onModProgress) {
                        onModProgress(modInfo.filename, downloaded, total, percent);
                    }
                });

                results.successful.push(result);
                console.log(`✓ Downloaded: ${modInfo.filename}`);

            } catch (error) {
                console.error(`✗ Failed to download ${modInfo.filename}:`, error.message);
                results.failed.push({
                    filename: modInfo.filename,
                    error: error.message
                });
            }

            completedCount++;

            if (onOverallProgress) {
                onOverallProgress(completedCount, totalMods);
            }
        }

        return results;
    }

    /**
     * Cancel an active download
     * @param {string} filename - Filename of download to cancel
     * @returns {boolean} Success status
     */
    cancelDownload(filename) {
        const request = this.activeDownloads.get(filename);

        if (request) {
            request.abort();
            this.activeDownloads.delete(filename);
            return true;
        }

        return false;
    }

    /**
     * Cancel all active downloads
     */
    cancelAllDownloads() {
        for (const [filename, request] of this.activeDownloads) {
            request.abort();
        }

        this.activeDownloads.clear();
    }

    /**
     * Verify a downloaded mod's integrity
     * @param {string} filename - Mod filename
     * @param {string} expectedHash - Expected MD5 hash
     * @returns {Promise<boolean>} Verification result
     */
    async verifyMod(filename, expectedHash) {
        return new Promise((resolve) => {
            const filePath = path.join(this.targetDir, filename);

            if (!fs.existsSync(filePath)) {
                resolve(false);
                return;
            }

            try {
                const fileBuffer = fs.readFileSync(filePath);
                const hashSum = crypto.createHash('md5');
                hashSum.update(fileBuffer);
                const calculatedHash = hashSum.digest('hex');

                resolve(calculatedHash === expectedHash);
            } catch (error) {
                console.error(`Error verifying ${filename}:`, error);
                resolve(false);
            }
        });
    }
}

module.exports = ModDownloader;
