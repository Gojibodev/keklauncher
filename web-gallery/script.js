// Configuration - List all your modpack JSON URLs here
const MODPACK_URLS = [
    'modpacks/example-modpack.json',
    'modpacks/another-modpack.json',
    // Add more modpack URLs here
    // Can be relative paths or full URLs like:
    // 'https://raw.githubusercontent.com/user/repo/main/modpack.json'
];

let allModpacks = [];
let filteredModpacks = [];

// Load all modpacks
async function loadModpacks() {
    const grid = document.getElementById('modpacksGrid');
    grid.innerHTML = '<div class="loading">Loading modpacks...</div>';

    try {
        const promises = MODPACK_URLS.map(url => fetchModpack(url));
        allModpacks = await Promise.all(promises);
        allModpacks = allModpacks.filter(mp => mp !== null);

        filteredModpacks = [...allModpacks];
        displayModpacks(filteredModpacks);
    } catch (error) {
        console.error('Error loading modpacks:', error);
        grid.innerHTML = '<div class="loading" style="color: #ff69b4;">Error loading modpacks</div>';
    }
}

// Fetch a single modpack JSON
async function fetchModpack(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        data._sourceUrl = url; // Store the source URL
        return data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
}

// Display modpacks in grid
function displayModpacks(modpacks) {
    const grid = document.getElementById('modpacksGrid');

    if (modpacks.length === 0) {
        grid.innerHTML = '<div class="loading">No modpacks found</div>';
        return;
    }

    grid.innerHTML = modpacks.map(modpack => `
        <div class="modpack-card" onclick="showModpackDetails('${modpack.id}')">
            <img src="${modpack.images?.thumbnail || modpack.images?.banner || 'https://via.placeholder.com/350x200/0a0a0a/00d9ff?text=No+Image'}"
                 alt="${modpack.name}"
                 class="modpack-image"
                 onerror="this.src='https://via.placeholder.com/350x200/0a0a0a/00d9ff?text=No+Image'">
            <div class="modpack-content">
                <div class="modpack-title">${modpack.name}</div>
                <div class="modpack-author">by ${modpack.author}</div>
                <div class="modpack-description">
                    ${modpack.description?.substring(0, 100) || 'No description'}...
                </div>
                <div class="modpack-stats">
                    <span><span class="stat-label">MC:</span> <span class="stat">${modpack.minecraftVersion}</span></span>
                    <span><span class="stat-label">Loader:</span> <span class="stat">${modpack.modloader.type}</span></span>
                    <span><span class="stat-label">Mods:</span> <span class="stat">${modpack.mods.length}</span></span>
                </div>
                <div class="modpack-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-install" onclick="installModpack('${modpack._sourceUrl}')">
                        INSTALL
                    </button>
                    <button class="btn btn-details" onclick="showModpackDetails('${modpack.id}')">
                        DETAILS
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Install modpack via custom URL scheme
function installModpack(modpackUrl) {
    const kekUrl = `keklauncher://install?url=${encodeURIComponent(modpackUrl)}`;

    // Try to open with custom protocol
    window.location.href = kekUrl;

    // Fallback: show install instructions
    setTimeout(() => {
        alert(`KEK Launcher not detected!\n\n` +
              `Manual Installation:\n` +
              `1. Open KEK Launcher\n` +
              `2. Go to Modpack Creator\n` +
              `3. Click "URL" button\n` +
              `4. Paste this URL:\n${modpackUrl}`);
    }, 1000);
}

// Show modpack details modal
function showModpackDetails(modpackId) {
    const modpack = allModpacks.find(mp => mp.id === modpackId);
    if (!modpack) return;

    const modal = document.getElementById('modpackModal');
    const modalBody = document.getElementById('modalBody');

    // Build gallery HTML
    let galleryHTML = '';
    if (modpack.images?.gallery && modpack.images.gallery.length > 0) {
        galleryHTML = `
            <div class="modal-gallery">
                ${modpack.images.gallery.map(img => `
                    <img src="${img}" class="gallery-image" onclick="window.open('${img}', '_blank')">
                `).join('')}
            </div>
        `;
    }

    // Build version history HTML
    let versionHistoryHTML = '';
    if (modpack.versionHistory && modpack.versionHistory.length > 0) {
        versionHistoryHTML = `
            <div class="modal-section">
                <h3>[VERSION HISTORY]</h3>
                <div class="version-history">
                    ${modpack.versionHistory.map(version => `
                        <div class="version-item">
                            <div class="version-header">
                                <span class="version-number">v${version.version}</span>
                                <span class="version-date">${new Date(version.date).toLocaleDateString()}</span>
                            </div>
                            <div class="version-changes">
                                ${version.changes.map(change => `
                                    <div>• ${change}</div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <h2 class="modal-title">${modpack.name}</h2>
        <div style="color: var(--cyan); margin-bottom: 20px;">
            by ${modpack.author} | v${modpack.version} | ${modpack.minecraftVersion}
        </div>

        ${galleryHTML}

        <div class="modal-section">
            <h3>[DESCRIPTION]</h3>
            <p style="color: #ccc; line-height: 1.8;">${modpack.description || 'No description provided'}</p>
        </div>

        <div class="modal-section">
            <h3>[SPECIFICATIONS]</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; color: #ccc;">
                <div><span style="color: var(--pink);">Modloader:</span> ${modpack.modloader.type} ${modpack.modloader.version || ''}</div>
                <div><span style="color: var(--pink);">Required RAM:</span> ${modpack.requiredRam}</div>
                <div><span style="color: var(--pink);">Java Version:</span> ${modpack.javaVersion}</div>
                <div><span style="color: var(--pink);">Total Mods:</span> ${modpack.mods.length}</div>
            </div>
        </div>

        ${versionHistoryHTML}

        <div class="modal-section">
            <h3>[MODS INCLUDED (${modpack.mods.length})]</h3>
            <div class="mod-list">
                ${modpack.mods.map(mod => `
                    <div class="mod-item">${mod.filename.replace('.jar', '')}</div>
                `).join('')}
            </div>
        </div>

        <div style="margin-top: 30px; display: flex; gap: 15px;">
            <button class="btn btn-install" style="flex: 1; padding: 20px; font-size: 1.1rem;"
                    onclick="installModpack('${modpack._sourceUrl}')">
                ⬇ INSTALL MODPACK
            </button>
            ${modpack.votingUrl ? `
                <button class="btn btn-details" style="padding: 20px;"
                        onclick="window.open('${modpack.votingUrl}', '_blank')">
                    🗳️ VOTE
                </button>
            ` : ''}
            ${modpack.issuesUrl ? `
                <button class="btn btn-details" style="padding: 20px;"
                        onclick="window.open('${modpack.issuesUrl}', '_blank')">
                    🐛 ISSUES
                </button>
            ` : ''}
        </div>
    `;

    modal.classList.add('active');
}

// Search and filter
function filterModpacks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const versionFilter = document.getElementById('versionFilter').value;
    const loaderFilter = document.getElementById('loaderFilter').value;

    filteredModpacks = allModpacks.filter(modpack => {
        const matchesSearch = !searchTerm ||
            modpack.name.toLowerCase().includes(searchTerm) ||
            modpack.author.toLowerCase().includes(searchTerm) ||
            (modpack.description && modpack.description.toLowerCase().includes(searchTerm));

        const matchesVersion = !versionFilter || modpack.minecraftVersion === versionFilter;
        const matchesLoader = !loaderFilter || modpack.modloader.type.toLowerCase() === loaderFilter.toLowerCase();

        return matchesSearch && matchesVersion && matchesLoader;
    });

    displayModpacks(filteredModpacks);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadModpacks();

    document.getElementById('searchInput').addEventListener('input', filterModpacks);
    document.getElementById('versionFilter').addEventListener('change', filterModpacks);
    document.getElementById('loaderFilter').addEventListener('change', filterModpacks);

    // Close modal
    document.querySelector('.modal-close').addEventListener('click', () => {
        document.getElementById('modpackModal').classList.remove('active');
    });

    // Close modal on outside click
    document.getElementById('modpackModal').addEventListener('click', (e) => {
        if (e.target.id === 'modpackModal') {
            e.target.classList.remove('active');
        }
    });
});
