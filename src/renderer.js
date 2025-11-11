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
});