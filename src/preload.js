const { contextBridge, ipcRenderer } = require('electron');
require('dotenv').config();

contextBridge.exposeInMainWorld('electron', {
    minimizeWindow: () => {
        console.log('Sending minimize-window event');
        ipcRenderer.send('minimize-window');
    },
    closeWindow: () => {
        console.log('Sending close-window event');
        ipcRenderer.send('close-window');
    }
});