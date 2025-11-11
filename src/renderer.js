const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    // Main buttons
    const checkUpdateButton = document.getElementById('check-update-button');
    const updateButton = document.getElementById('update-button');
    const statusMessage = document.getElementById('status-message');

    // Title bar buttons
    const minimizeButton = document.getElementById('minimize-button');
    const closeButton = document.getElementById('close-button');

    // Sidebar buttons
    const sidebar = document.getElementById('sidebar');
    const burgerMenu = document.getElementById('burger-menu');

    // Track update state
    let updateDownloaded = false;

    //gallery shid
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const carouselContainer = document.querySelector('.carousel-container');
    const carouselImages = document.querySelectorAll('.carousel-image');
    let currentIndex = 0;

    // Check for updates button
    checkUpdateButton.addEventListener('click', () => {
        console.log('Check update button clicked');
        statusMessage.textContent = 'Checking for updates...';
        checkUpdateButton.disabled = true;
        ipcRenderer.send('check-for-updates');
    });

    // Update/Install button (multi-purpose)
    updateButton.addEventListener('click', () => {
        console.log('Update button clicked');
        if (updateDownloaded) {
            statusMessage.textContent = 'Installing update and restarting...';
            ipcRenderer.send('install-update');
        } else {
            statusMessage.textContent = 'Updating modpack...';
            // TODO: Add modpack update logic here
        }
    });

    minimizeButton.addEventListener('click', () => {
        console.log('Minimize button clicked');
        window.electron.minimizeWindow();
    });

    closeButton.addEventListener('click', () => {
        console.log('Close button clicked');
        window.electron.closeWindow();
    });

    burgerMenu.addEventListener('click', () => {
        console.log('Burger menu clicked');
        sidebar.classList.toggle('hidden');
        document.querySelector('.main-content').classList.toggle('sidebar-hidden');
    });

    prevButton.addEventListener('click', () => {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : carouselImages.length - 1;
        updateCarousel();
    });

    nextButton.addEventListener('click', () => {
        currentIndex = (currentIndex < carouselImages.length - 1) ? currentIndex + 1 : 0;
        updateCarousel();
    });

    function updateCarousel() {
        const offset = -currentIndex * 100;
        carouselImages.forEach((image, index) => {
            image.style.transform = `translateX(${offset}%)`;
        });
    }

    // Auto-updater IPC event listeners
    ipcRenderer.on('checking-for-update', () => {
        statusMessage.textContent = 'Checking for updates...';
        statusMessage.className = 'status-message info';
    });

    ipcRenderer.on('update-available', (event, info) => {
        statusMessage.textContent = `Update available (v${info.version}). Downloading...`;
        statusMessage.className = 'status-message info';
        checkUpdateButton.disabled = false;
        // Automatically start download
        ipcRenderer.send('download-update');
    });

    ipcRenderer.on('update-not-available', () => {
        statusMessage.textContent = 'You are running the latest version!';
        statusMessage.className = 'status-message success';
        checkUpdateButton.disabled = false;
        // Clear message after 3 seconds
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    });

    ipcRenderer.on('download-progress', (event, progressObj) => {
        const percent = Math.round(progressObj.percent);
        const downloaded = (progressObj.transferred / 1024 / 1024).toFixed(2);
        const total = (progressObj.total / 1024 / 1024).toFixed(2);
        statusMessage.textContent = `Downloading update: ${percent}% (${downloaded}MB / ${total}MB)`;
        statusMessage.className = 'status-message info';
    });

    ipcRenderer.on('update-downloaded', (event, info) => {
        updateDownloaded = true;
        statusMessage.textContent = 'Update downloaded! Restart the app to install.';
        statusMessage.className = 'status-message success';
        checkUpdateButton.disabled = false;

        // Show install button or notification
        const installBtn = document.createElement('button');
        installBtn.textContent = 'Restart & Install';
        installBtn.className = 'install-update-btn';
        installBtn.addEventListener('click', () => {
            ipcRenderer.send('install-update');
        });

        if (!document.querySelector('.install-update-btn')) {
            statusMessage.parentElement.appendChild(installBtn);
        }
    });

    ipcRenderer.on('update-error', (event, error) => {
        console.error('Update error:', error);
        statusMessage.textContent = `Update error: ${error.message || 'Failed to check for updates'}`;
        statusMessage.className = 'status-message error';
        checkUpdateButton.disabled = false;

        // Clear error message after 5 seconds
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 5000);
    });

    // ============ MODPACK MANAGEMENT ============

    let currentModpackId = null;
    const modpackList = document.getElementById('modpack-list');
    const modpackDesc = document.getElementById('modpack-desc');

    // Load modpacks on startup
    async function loadModpacks() {
        try {
            const result = await window.electron.getModpacks();

            if (result.success && result.modpacks.length > 0) {
                modpackList.innerHTML = '';

                result.modpacks.forEach(modpack => {
                    const li = document.createElement('li');
                    li.textContent = modpack.name;
                    li.dataset.modpackId = modpack.id;
                    li.addEventListener('click', () => selectModpack(modpack.id));
                    modpackList.appendChild(li);
                });

                // Select first modpack by default
                selectModpack(result.modpacks[0].id);
            }
        } catch (error) {
            console.error('Error loading modpacks:', error);
            statusMessage.textContent = 'Error loading modpacks';
            statusMessage.className = 'status-message error';
        }
    }

    // Select a modpack
    async function selectModpack(modpackId) {
        try {
            currentModpackId = modpackId;

            // Update UI selection
            document.querySelectorAll('#modpack-list li').forEach(li => {
                li.classList.remove('selected');
                if (li.dataset.modpackId === modpackId) {
                    li.classList.add('selected');
                }
            });

            // Load modpack details
            const result = await window.electron.loadModpack(modpackId);

            if (result.success) {
                const modpack = result.modpack;

                // Update description
                const descH2 = modpackDesc.querySelector('h2');
                const descP = modpackDesc.querySelector('p');

                if (descH2) descH2.textContent = modpack.name;
                if (descP) {
                    descP.textContent = `${modpack.description}\nMinecraft ${modpack.minecraftVersion} | Version ${modpack.version}`;
                }

                // Get stats
                await updateModpackStats(modpackId);
            }
        } catch (error) {
            console.error('Error selecting modpack:', error);
            statusMessage.textContent = 'Error loading modpack';
            statusMessage.className = 'status-message error';
        }
    }

    // Update modpack statistics
    async function updateModpackStats(modpackId) {
        try {
            const statsResult = await window.electron.getModpackStats(modpackId);
            const compResult = await window.electron.compareMods(modpackId);

            if (statsResult.success && compResult.success) {
                const stats = statsResult.stats;
                const comparison = compResult.comparison;

                let statusText = `Mods: ${stats.totalMods} installed`;

                if (stats.missing > 0) {
                    statusText += ` | ${stats.missing} missing`;
                }
                if (stats.outdated > 0) {
                    statusText += ` | ${stats.outdated} outdated`;
                }
                if (stats.extra > 0) {
                    statusText += ` | ${stats.extra} extra`;
                }

                // Show in status message
                if (stats.missing > 0 || stats.outdated > 0) {
                    statusMessage.textContent = `[WARNING] ${statusText}`;
                    statusMessage.className = 'status-message info';
                } else if (stats.totalMods === 0) {
                    statusMessage.textContent = '[INFO] No mods installed. Click "Update Modpack" to download';
                    statusMessage.className = 'status-message info';
                } else {
                    statusMessage.textContent = `[OK] ${statusText} - Up to date!`;
                    statusMessage.className = 'status-message success';
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Update modpack button - now handles mod downloads
    updateButton.removeEventListener('click', updateButton.onclick);
    updateButton.addEventListener('click', async () => {
        if (!currentModpackId) {
            statusMessage.textContent = '[ERROR] No modpack selected';
            statusMessage.className = 'status-message error';
            return;
        }

        if (updateDownloaded) {
            statusMessage.textContent = 'Installing update and restarting...';
            ipcRenderer.send('install-update');
            return;
        }

        // Check settings
        const installOnlyNew = document.getElementById('install-onlynew').checked;

        try {
            statusMessage.textContent = `[INFO] Downloading mods for ${currentModpackId}...`;
            statusMessage.className = 'status-message info';
            updateButton.disabled = true;

            const result = await window.electron.downloadMods(currentModpackId, installOnlyNew);

            if (result.success) {
                const { successful, failed, skipped } = result.results;

                let message = `[OK] Download complete! `;
                message += `${successful.length} successful`;

                if (skipped.length > 0) {
                    message += `, ${skipped.length} skipped`;
                }
                if (failed.length > 0) {
                    message += `, ${failed.length} failed`;
                }

                statusMessage.textContent = message;
                statusMessage.className = failed.length > 0 ? 'status-message error' : 'status-message success';

                // Update stats
                await updateModpackStats(currentModpackId);
            } else {
                statusMessage.textContent = `[ERROR] ${result.error}`;
                statusMessage.className = 'status-message error';
            }

            updateButton.disabled = false;
        } catch (error) {
            console.error('Error downloading mods:', error);
            statusMessage.textContent = `[ERROR] ${error.message}`;
            statusMessage.className = 'status-message error';
            updateButton.disabled = false;
        }
    });

    // Browse local files button
    const browseButton = document.getElementById('browse-local-files-button');
    if (browseButton) {
        browseButton.addEventListener('click', async () => {
            if (currentModpackId) {
                await window.electron.openModpackFolder(currentModpackId);
            }
        });
    }

    // Listen for download progress events
    window.electron.onModDownloadProgress((data) => {
        const { filename, downloaded, total, percent } = data;
        const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
        const totalMB = (total / 1024 / 1024).toFixed(2);

        statusMessage.textContent = `[INFO] Downloading ${filename}: ${percent.toFixed(1)}% (${downloadedMB}MB / ${totalMB}MB)`;
        statusMessage.className = 'status-message info';
    });

    window.electron.onModDownloadOverall((data) => {
        const { completed, total, percent } = data;
        console.log(`Overall progress: ${completed}/${total} (${percent.toFixed(1)}%)`);
    });

    // Launch button
    const launchButton = document.getElementById('launch-button');
    if (launchButton) {
        launchButton.addEventListener('click', async () => {
            if (!currentModpackId) {
                statusMessage.textContent = '[ERROR] No modpack selected';
                statusMessage.className = 'status-message error';
                return;
            }

            try {
                // First, check if Minecraft is installed
                const checkResult = await window.electron.checkMinecraft();

                if (!checkResult.isInstalled) {
                    statusMessage.textContent = '[ERROR] Minecraft not found. Please install Minecraft first.';
                    statusMessage.className = 'status-message error';
                    return;
                }

                // Switch to this modpack
                statusMessage.textContent = `[INFO] Switching to ${currentModpackId}...`;
                statusMessage.className = 'status-message info';
                launchButton.disabled = true;

                const switchResult = await window.electron.switchModpack(currentModpackId);

                if (!switchResult.success) {
                    statusMessage.textContent = `[ERROR] Failed to switch modpack: ${switchResult.error}`;
                    statusMessage.className = 'status-message error';
                    launchButton.disabled = false;
                    return;
                }

                // Create or update profile
                const modpack = await window.electron.loadModpack(currentModpackId);
                if (modpack.success) {
                    await window.electron.createMinecraftProfile(
                        modpack.modpack.name,
                        modpack.modpack.minecraftVersion
                    );
                }

                // Launch Minecraft
                statusMessage.textContent = '[INFO] Launching Minecraft...';
                const launchResult = await window.electron.launchMinecraft();

                if (launchResult.success) {
                    statusMessage.textContent = `[OK] Minecraft launched! ${switchResult.copiedCount} mods copied`;
                    statusMessage.className = 'status-message success';
                } else {
                    statusMessage.textContent = `[ERROR] Failed to launch: ${launchResult.error}`;
                    statusMessage.className = 'status-message error';
                }

                launchButton.disabled = false;
            } catch (error) {
                console.error('Error launching:', error);
                statusMessage.textContent = `[ERROR] ${error.message}`;
                statusMessage.className = 'status-message error';
                launchButton.disabled = false;
            }
        });
    }

    // Check for active modpack on startup
    async function checkActiveModpack() {
        try {
            const result = await window.electron.getActiveModpack();

            if (result.success && result.activeModpack) {
                const { modpackId, switchedAt } = result.activeModpack;
                const date = new Date(switchedAt).toLocaleString();
                console.log(`Active modpack: ${modpackId} (switched at ${date})`);
            }
        } catch (error) {
            console.error('Error checking active modpack:', error);
        }
    }

    // Initialize modpacks
    loadModpacks();
    checkActiveModpack();
});