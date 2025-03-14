const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    //main btns
    const updateButton = document.getElementById('update-button');
    const statusMessage = document.getElementById('status-message');
    //title bar btns
    const minimizeButton = document.getElementById('minimize-button');
    const closeButton = document.getElementById('close-button');
    //sidebar btns
    const sidebar = document.getElementById('sidebar');
    const burgerMenu = document.getElementById('burger-menu');

    //gallery shid
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const carouselContainer = document.querySelector('.carousel-container');
    const carouselImages = document.querySelectorAll('.carousel-image');
    let currentIndex = 0;
    updateButton.addEventListener('click', () => {
        console.log('Update button clicked');
        statusMessage.textContent = 'Checking for updates...';
        ipcRenderer.send('check-for-updates');
    });
    // updateButton.addEventListener('click', () => {
    //     console.log('Update button clicked');
    //     statusMessage.textContent = 'Updating modpack...';
    //     // Simulate file update process
    //     setTimeout(() => {
    //         statusMessage.textContent = 'Modpack updated successfully!';
    //     }, 2000);
    // });

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
    
    ipcRenderer.on('update-available', () => {
        statusMessage.textContent = 'Update available. Downloading...';
    });

    ipcRenderer.on('update-not-available', () => {
        statusMessage.textContent = 'No updates available.';
    });

    ipcRenderer.on('download-progress', (event, progressObj) => {
        statusMessage.textContent = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    });

    ipcRenderer.on('update-downloaded', () => {
        statusMessage.textContent = 'Update downloaded. It will be installed on restart.';
    });
});