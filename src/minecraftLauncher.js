const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class MinecraftLauncher {
    constructor() {
        this.minecraftPath = this.getMinecraftPath();
        this.javaPath = 'java'; // Default to system Java
    }

    /**
     * Get the Minecraft installation path
     * @returns {string} Minecraft path
     */
    getMinecraftPath() {
        const appDataPath = app.getPath('appData');

        if (process.platform === 'win32') {
            return path.join(appDataPath, '.minecraft');
        } else if (process.platform === 'darwin') {
            return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
        } else {
            return path.join(app.getPath('home'), '.minecraft');
        }
    }

    /**
     * Find Java installation
     * @returns {Promise<string>} Path to Java executable
     */
    async findJava() {
        const possiblePaths = [];

        if (process.platform === 'win32') {
            possiblePaths.push(
                'C:\\Program Files\\Java\\jre1.8.0_XXX\\bin\\java.exe',
                'C:\\Program Files (x86)\\Java\\jre1.8.0_XXX\\bin\\java.exe',
                'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
                path.join(this.minecraftPath, 'runtime', 'java-runtime-gamma', 'windows', 'java-runtime-gamma', 'bin', 'java.exe')
            );
        } else if (process.platform === 'darwin') {
            possiblePaths.push(
                '/usr/bin/java',
                path.join(this.minecraftPath, 'runtime', 'java-runtime-gamma', 'mac-os', 'java-runtime-gamma', 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
            );
        } else {
            possiblePaths.push(
                '/usr/bin/java',
                path.join(this.minecraftPath, 'runtime', 'java-runtime-gamma', 'linux', 'java-runtime-gamma', 'bin', 'java')
            );
        }

        // Check which Java exists
        for (const javaPath of possiblePaths) {
            if (fs.existsSync(javaPath)) {
                this.javaPath = javaPath;
                return javaPath;
            }
        }

        // Fallback to system Java
        return 'java';
    }

    /**
     * Launch Minecraft with specific profile
     * @param {string} profileName - Minecraft profile name
     * @param {Object} options - Launch options
     * @returns {Promise<Object>} Launch result
     */
    async launchMinecraft(profileName = null, options = {}) {
        try {
            await this.findJava();

            // Use official Minecraft launcher with profile
            const launcherPath = this.getOfficialLauncherPath();

            if (!launcherPath) {
                return { success: false, error: 'Minecraft launcher not found' };
            }

            // Launch Minecraft launcher
            const args = [];

            if (profileName) {
                args.push('--workDir', this.minecraftPath);
                // Note: The official launcher doesn't support command-line profile selection
                // Users will need to select the profile manually
            }

            const process = spawn(launcherPath, args, {
                detached: true,
                stdio: 'ignore'
            });

            process.unref();

            return {
                success: true,
                message: 'Minecraft launcher started',
                note: profileName ? `Please select the "${profileName}" profile` : null
            };
        } catch (error) {
            console.error('Error launching Minecraft:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get official Minecraft launcher path
     * @returns {string|null} Launcher path
     */
    getOfficialLauncherPath() {
        if (process.platform === 'win32') {
            const possiblePaths = [
                'C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe',
                'C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe',
                path.join(app.getPath('home'), 'AppData', 'Local', 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'Minecraft Launcher', 'MinecraftLauncher.exe')
            ];

            for (const launcherPath of possiblePaths) {
                if (fs.existsSync(launcherPath)) {
                    return launcherPath;
                }
            }
        } else if (process.platform === 'darwin') {
            return '/Applications/Minecraft.app/Contents/MacOS/launcher';
        } else {
            // Linux - check multiple locations
            const possiblePaths = [
                '/usr/bin/minecraft-launcher',
                path.join(app.getPath('home'), '.local', 'share', 'applications', 'minecraft-launcher.desktop')
            ];

            for (const launcherPath of possiblePaths) {
                if (fs.existsSync(launcherPath)) {
                    return launcherPath;
                }
            }
        }

        return null;
    }

    /**
     * Create or update Minecraft profile for modpack
     * @param {string} modpackName - Name of the modpack
     * @param {string} minecraftVersion - Minecraft version
     * @returns {Object} Result with success status
     */
    createProfile(modpackName, minecraftVersion) {
        try {
            const launcherProfilesPath = path.join(this.minecraftPath, 'launcher_profiles.json');

            if (!fs.existsSync(launcherProfilesPath)) {
                return { success: false, error: 'launcher_profiles.json not found' };
            }

            const profiles = JSON.parse(fs.readFileSync(launcherProfilesPath, 'utf8'));

            // Create profile ID
            const profileId = `kek_${modpackName.toLowerCase().replace(/\s+/g, '_')}`;

            // Add or update profile
            profiles.profiles[profileId] = {
                name: `KEK - ${modpackName}`,
                type: 'custom',
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                icon: 'Furnace',
                lastVersionId: minecraftVersion || '1.19.2',
                gameDir: this.minecraftPath
            };

            // Save profiles
            fs.writeFileSync(launcherProfilesPath, JSON.stringify(profiles, null, 2));

            return { success: true, profileId };
        } catch (error) {
            console.error('Error creating profile:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if Minecraft is installed
     * @returns {boolean} Installation status
     */
    isMinecraftInstalled() {
        const versionsPath = path.join(this.minecraftPath, 'versions');
        return fs.existsSync(this.minecraftPath) && fs.existsSync(versionsPath);
    }
}

module.exports = MinecraftLauncher;
