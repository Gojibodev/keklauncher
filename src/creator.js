// Global state
let currentWorkspaceId = null;
let currentMetadata = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadWorkspaces();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Listen for download progress
    window.electron.onCreatorDownloadProgress((data) => {
        addStatus(`Downloading ${data.type}: ${data.percent}%`);
    });

    window.electron.onCreatorBatchProgress((data) => {
        const progress = document.getElementById('bulkProgress');
        if (progress) {
            progress.innerHTML = `
                <div>[MOD ${data.currentMod}/${data.totalMods}]</div>
                <div>Progress: ${data.percent}%</div>
            `;
        }
    });

    // Custom folder name toggle
    const folderSelect = document.getElementById('folderName');
    if (folderSelect) {
        folderSelect.addEventListener('change', (e) => {
            const customInput = document.getElementById('customFolderName');
            if (e.target.value === 'custom') {
                customInput.style.display = 'block';
            } else {
                customInput.style.display = 'none';
            }
        });
    }
}

// Navigate back to main launcher
function goBack() {
    window.location.href = '../index.html';
}

// Load all workspaces
async function loadWorkspaces() {
    const result = await window.electron.creatorListWorkspaces();
    if (result.success) {
        displayWorkspaces(result.workspaces);
    } else {
        addStatus(`Error loading workspaces: ${result.error}`, 'error');
    }
}

// Display workspaces in sidebar
function displayWorkspaces(workspaces) {
    const list = document.getElementById('workspacesList');
    if (workspaces.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No workspaces</div>';
        return;
    }

    list.innerHTML = workspaces.map(ws => `
        <div class="workspace-item ${ws.id === currentWorkspaceId ? 'active' : ''}"
             onclick="selectWorkspace('${ws.id}')">
            <span class="name">${ws.metadata.name}</span>
            <span class="info">v${ws.metadata.version} | MC ${ws.metadata.minecraftVersion}</span>
            <span class="info">${ws.metadata.mods.length} mods</span>
        </div>
    `).join('');
}

// Select a workspace
async function selectWorkspace(workspaceId) {
    currentWorkspaceId = workspaceId;

    // Update active state in sidebar
    document.querySelectorAll('.workspace-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget?.classList.add('active');

    // Load workspace data
    const workspaces = await window.electron.creatorListWorkspaces();
    const workspace = workspaces.workspaces.find(ws => ws.id === workspaceId);

    if (workspace) {
        currentMetadata = workspace.metadata;
        displayWorkspaceEditor(workspace);
    }
}

// Display workspace editor
function displayWorkspaceEditor(workspace) {
    const noWorkspaceMsg = document.getElementById('noWorkspaceMessage');
    const editor = document.getElementById('workspaceEditor');

    noWorkspaceMsg.style.display = 'none';
    editor.style.display = 'block';

    // Populate metadata fields
    document.getElementById('metaName').value = workspace.metadata.name || '';
    document.getElementById('metaVersion').value = workspace.metadata.version || '';
    document.getElementById('metaMcVersion').value = workspace.metadata.minecraftVersion || '';
    document.getElementById('metaModloader').value = workspace.metadata.modloader.type || 'forge';
    document.getElementById('metaAuthor').value = workspace.metadata.author || '';
    document.getElementById('metaRam').value = workspace.metadata.requiredRam || '4G';
    document.getElementById('metaDescription').value = workspace.metadata.description || '';

    // Display mods
    displayMods(workspace.metadata.mods);

    // Display folders
    displayFolders(workspace.metadata.folders);

    addStatus(`Loaded workspace: ${workspace.metadata.name}`);
}

// Display mods list
function displayMods(mods) {
    const modsList = document.getElementById('modsList');
    const modCount = document.getElementById('modCount');

    modCount.textContent = mods.length;

    if (mods.length === 0) {
        modsList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No mods added yet</div>';
        return;
    }

    modsList.innerHTML = mods.map(mod => `
        <div class="mod-item">
            <div>
                <div class="name">${mod.filename}</div>
                <div class="info">Size: ${formatBytes(mod.size)} | ${mod.required ? 'Required' : 'Optional'}</div>
            </div>
        </div>
    `).join('');
}

// Display folders
function displayFolders(folders) {
    const optionalContainer = document.getElementById('optionalFolders');

    if (folders.optional && folders.optional.length > 0) {
        optionalContainer.innerHTML = folders.optional.map(folder => `
            <div class="folder-item">
                <span class="folder-name">${folder}/</span>
                <span class="folder-badge optional">OPTIONAL</span>
            </div>
        `).join('');
    } else {
        optionalContainer.innerHTML = '';
    }
}

// Format bytes to readable size
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showNewModpackModal() {
    showModal('newModpackModal');
}

function showImportModal() {
    closeModal('newModpackModal');
    showModal('importModal');
}

function showAddModModal() {
    if (!currentWorkspaceId) {
        addStatus('Please select a workspace first', 'error');
        return;
    }
    showModal('addModModal');
}

function showBulkAddModal() {
    if (!currentWorkspaceId) {
        addStatus('Please select a workspace first', 'error');
        return;
    }
    showModal('bulkAddModal');
}

function showAddFolderModal() {
    if (!currentWorkspaceId) {
        addStatus('Please select a workspace first', 'error');
        return;
    }
    showModal('addFolderModal');
}

// Tab switching
function switchTab(tabId) {
    // Remove active from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activate selected tab
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// Create new modpack
async function createNewModpack() {
    const modpackId = document.getElementById('newModpackId').value.trim();
    const name = document.getElementById('newModpackName').value.trim();
    const mcVersion = document.getElementById('newModpackMcVersion').value.trim();

    if (!modpackId || !name || !mcVersion) {
        addStatus('Please fill all fields', 'error');
        return;
    }

    const metadata = {
        name: name,
        minecraftVersion: mcVersion
    };

    const result = await window.electron.creatorNewModpack(modpackId, metadata);

    if (result.success) {
        addStatus(`Created modpack: ${name}`, 'success');
        closeModal('newModpackModal');
        await loadWorkspaces();
        selectWorkspace(modpackId);
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Import from Minecraft
async function importFromMinecraft() {
    const mcPath = document.getElementById('importMcPath').value.trim();
    const modpackId = document.getElementById('importModpackId').value.trim();
    const name = document.getElementById('importModpackName').value.trim();

    if (!mcPath || !modpackId || !name) {
        addStatus('Please fill all fields', 'error');
        return;
    }

    addStatus('Importing from Minecraft... This may take a while', 'info');

    const metadata = { name: name };
    const result = await window.electron.creatorImportFromMinecraft(mcPath, modpackId, metadata);

    if (result.success) {
        addStatus(`Imported ${result.importedFolders.length} folders`, 'success');
        closeModal('importModal');
        await loadWorkspaces();
        selectWorkspace(modpackId);
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Save metadata
async function saveMetadata() {
    if (!currentWorkspaceId) return;

    const updates = {
        name: document.getElementById('metaName').value,
        version: document.getElementById('metaVersion').value,
        minecraftVersion: document.getElementById('metaMcVersion').value,
        modloader: {
            type: document.getElementById('metaModloader').value,
            version: currentMetadata.modloader.version
        },
        author: document.getElementById('metaAuthor').value,
        requiredRam: document.getElementById('metaRam').value,
        description: document.getElementById('metaDescription').value
    };

    const result = await window.electron.creatorUpdateMetadata(currentWorkspaceId, updates);

    if (result.success) {
        addStatus('Metadata saved', 'success');
        currentMetadata = result.metadata;
        await loadWorkspaces();
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Refresh mods list
async function refreshModsList() {
    if (!currentWorkspaceId) return;

    const workspaces = await window.electron.creatorListWorkspaces();
    const workspace = workspaces.workspaces.find(ws => ws.id === currentWorkspaceId);

    if (workspace) {
        displayMods(workspace.metadata.mods);
        addStatus('Mods list refreshed', 'success');
    }
}

// Add mod from URL
async function addModFromURL() {
    const url = document.getElementById('modUrl').value.trim();

    if (!url) {
        addStatus('Please enter a URL', 'error');
        return;
    }

    addStatus(`Downloading mod from URL...`, 'info');

    const result = await window.electron.creatorAddModFromURL(currentWorkspaceId, url);

    if (result.success) {
        addStatus(`Added mod: ${result.filename}`, 'success');
        closeModal('addModModal');
        await refreshModsList();
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Add mod from CurseForge
async function addModFromCurseForge() {
    const modId = document.getElementById('cfModId').value.trim();

    if (!modId) {
        addStatus('Please enter a mod ID', 'error');
        return;
    }

    addStatus(`Downloading mod from CurseForge...`, 'info');

    const result = await window.electron.creatorAddModFromCurseForge(
        currentWorkspaceId,
        parseInt(modId),
        currentMetadata.minecraftVersion
    );

    if (result.success) {
        addStatus(`Added mod: ${result.filename}`, 'success');
        closeModal('addModModal');
        await refreshModsList();
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Search CurseForge
async function searchCurseForge() {
    const query = document.getElementById('cfSearchQuery').value.trim();

    if (!query) {
        addStatus('Please enter a search query', 'error');
        return;
    }

    addStatus('Searching CurseForge...', 'info');

    const result = await window.electron.creatorSearchCurseForge(
        currentWorkspaceId,
        query,
        currentMetadata.minecraftVersion
    );

    if (result.success && result.results) {
        displaySearchResults(result.results);
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Display search results
function displaySearchResults(results) {
    const container = document.getElementById('cfSearchResults');

    if (!results || results.length === 0) {
        container.innerHTML = '<div style="color: #888; padding: 10px;">No results found</div>';
        return;
    }

    container.innerHTML = results.slice(0, 10).map(mod => `
        <div class="search-result-item" onclick="selectSearchResult(${mod.id})">
            <div class="mod-name">${mod.name}</div>
            <div class="mod-author">by ${mod.authors ? mod.authors[0]?.name : 'Unknown'}</div>
        </div>
    `).join('');
}

// Select search result
function selectSearchResult(modId) {
    document.getElementById('cfModId').value = modId;
    addStatus(`Selected mod ID: ${modId}`, 'info');
}

// Bulk add mods
async function bulkAddMods() {
    const text = document.getElementById('bulkModIds').value.trim();

    if (!text) {
        addStatus('Please enter mod IDs', 'error');
        return;
    }

    const modIds = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));

    if (modIds.length === 0) {
        addStatus('No valid mod IDs found', 'error');
        return;
    }

    addStatus(`Adding ${modIds.length} mods...`, 'info');

    const result = await window.electron.creatorAddModsFromCurseForge(
        currentWorkspaceId,
        modIds,
        currentMetadata.minecraftVersion
    );

    addStatus(`Added ${result.successful} mods, ${result.failed} failed`, result.failed > 0 ? 'error' : 'success');

    closeModal('bulkAddModal');
    await refreshModsList();
}

// Add folder
async function addFolder() {
    let folderName = document.getElementById('folderName').value;

    if (folderName === 'custom') {
        folderName = document.getElementById('customFolderName').value.trim();
        if (!folderName) {
            addStatus('Please enter a folder name', 'error');
            return;
        }
    }

    const result = await window.electron.creatorAddFolder(currentWorkspaceId, folderName);

    if (result.success) {
        addStatus(`Added folder: ${folderName}`, 'success');
        closeModal('addFolderModal');

        // Refresh workspace
        const workspaces = await window.electron.creatorListWorkspaces();
        const workspace = workspaces.workspaces.find(ws => ws.id === currentWorkspaceId);
        if (workspace) {
            displayFolders(workspace.metadata.folders);
        }
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Export modpack
async function exportModpack(asZip, exportType = 'appdata') {
    if (!currentWorkspaceId) return;

    addStatus(`Exporting modpack${asZip ? ' as ZIP' : ''}...`, 'info');

    let result;
    if (exportType === 'shareable') {
        result = await window.electron.creatorExportShareable(currentWorkspaceId, asZip);
    } else if (exportType === 'project') {
        result = await window.electron.creatorExportProject(currentWorkspaceId, asZip);
    } else {
        result = await window.electron.creatorExportModpack(currentWorkspaceId, asZip);
    }

    if (result.success) {
        addStatus(`Exported to: ${result.path}${asZip ? '\nZIP: ' + result.zipPath : ''}`, 'success');
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Open export folder
async function openExportFolder(folderType) {
    const result = await window.electron.creatorOpenExportFolder(folderType);
    if (result.success) {
        addStatus(`Opening folder: ${result.path}`, 'info');
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Open workspace folder
async function openWorkspaceFolder() {
    if (!currentWorkspaceId) return;

    const result = await window.electron.creatorOpenWorkspace(currentWorkspaceId);

    if (result.success) {
        addStatus('Opening workspace folder...', 'info');
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Delete workspace
async function deleteWorkspace() {
    if (!currentWorkspaceId) return;

    if (!confirm(`Are you sure you want to delete workspace "${currentMetadata.name}"?`)) {
        return;
    }

    const result = await window.electron.creatorDeleteWorkspace(currentWorkspaceId);

    if (result.success) {
        addStatus('Workspace deleted', 'success');
        currentWorkspaceId = null;
        currentMetadata = null;

        document.getElementById('noWorkspaceMessage').style.display = 'flex';
        document.getElementById('workspaceEditor').style.display = 'none';

        await loadWorkspaces();
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}

// Add status message
function addStatus(message, type = 'info') {
    const statusArea = document.getElementById('statusMessages');
    const timestamp = new Date().toLocaleTimeString();

    const prefix = type === 'error' ? '[ERROR]' :
                   type === 'success' ? '[OK]' :
                   '[INFO]';

    const line = `${timestamp} ${prefix} ${message}\n`;
    statusArea.textContent += line;

    // Auto-scroll to bottom
    statusArea.parentElement.scrollTop = statusArea.parentElement.scrollHeight;
}

// Show import from URL modal
function showImportURLModal() {
    showModal('importURLModal');
}

// Import modpack from URL
async function importFromURL() {
    const url = document.getElementById('modpackUrl').value.trim();
    const modpackId = document.getElementById('urlModpackId').value.trim() || null;

    if (!url) {
        addStatus('Please enter a modpack URL', 'error');
        return;
    }

    const progressDiv = document.getElementById('urlImportProgress');
    progressDiv.style.display = 'block';
    progressDiv.textContent = 'Downloading modpack.json...';

    addStatus(`Importing modpack from URL...`, 'info');

    try {
        const result = await window.electron.creatorInstallFromURL(url, modpackId);

        if (result.success) {
            progressDiv.textContent = `Imported ${result.results.successful} mods successfully, ${result.results.failed} failed`;
            addStatus(`Modpack imported! Workspace: ${result.workspaceId}`, 'success');
            addStatus(`Successful: ${result.results.successful}, Failed: ${result.results.failed}`, 'info');

            setTimeout(() => {
                closeModal('importURLModal');
                progressDiv.style.display = 'none';
                progressDiv.textContent = '';
                loadWorkspaces();
                selectWorkspace(result.workspaceId);
            }, 2000);
        } else {
            progressDiv.textContent = `Error: ${result.error}`;
            addStatus(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        progressDiv.textContent = `Error: ${error.message}`;
        addStatus(`Error: ${error.message}`, 'error');
    }
}

// Show public modpack modal
function showPublicModpackModal() {
    if (!currentWorkspaceId) {
        addStatus('Please select a workspace first', 'error');
        return;
    }
    showModal('publicModpackModal');
}

// Generate public modpack JSON
async function generatePublicModpack() {
    if (!currentWorkspaceId) return;

    const votingUrl = document.getElementById('votingUrl').value.trim();
    const issuesUrl = document.getElementById('issuesUrl').value.trim();
    const downloadUrl = document.getElementById('downloadUrl').value.trim();

    const options = {};
    if (votingUrl) options.votingUrl = votingUrl;
    if (issuesUrl) options.issuesUrl = issuesUrl;
    if (downloadUrl) options.downloadUrl = downloadUrl;

    addStatus('Generating public modpack JSON...', 'info');

    const result = await window.electron.creatorGeneratePublic(currentWorkspaceId, options);

    if (result.success) {
        const generatedDiv = document.getElementById('publicGenerated');
        generatedDiv.style.display = 'block';
        generatedDiv.innerHTML = `
            <div style="color: #0f0;">[SUCCESS] Generated public modpack JSON!</div>
            <div style="margin-top: 10px;">Path: ${result.path}</div>
            <div style="margin-top: 10px; color: #00d9ff;">
                <strong>Next Steps:</strong><br>
                1. Upload modpack.public.json to GitHub, Pastebin, or your website<br>
                2. Share the raw JSON URL with users<br>
                3. Users can import using "Import from URL" in KEK Launcher<br>
                <br>
                <strong>Example URLs:</strong><br>
                GitHub: https://raw.githubusercontent.com/user/repo/main/modpack.json<br>
                Pastebin: https://pastebin.com/raw/xxxxx<br>
            </div>
        `;
        addStatus('Public modpack JSON generated!', 'success');

        setTimeout(() => {
            // Open workspace folder to show the file
            openWorkspaceFolder();
        }, 1000);
    } else {
        addStatus(`Error: ${result.error}`, 'error');
    }
}
