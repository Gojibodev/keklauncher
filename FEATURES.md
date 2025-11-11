# KEK Launcher Features Documentation

## 📦 Modpack Management System

### Storage Location
All modpacks are stored in `%AppData%/.kek/modpacks/` (Windows) or equivalent on other platforms. This keeps your modpacks organized and separate from Minecraft's default mods folder.

### Directory Structure
```
%AppData%/
└── .kek/
    ├── modpacks/
    │   ├── piss-and-horror/          # Your first modpack
    │   └── another-modpack/          # Additional modpacks
    ├── backups/                      # Automatic backups of mods
    │   └── mods_timestamp/
    └── active_modpack.json           # Tracks currently active modpack
```

### Features
- ✅ Download mods from direct URLs
- ✅ MD5 hash verification for integrity
- ✅ Detect missing, outdated, and extra mods
- ✅ "Install only new" option to skip existing mods
- ✅ Real-time download progress tracking
- ✅ Multiple modpack support
- ✅ Automatic backups before switching

---

## 🚀 Minecraft Integration

### Launching Minecraft
1. Select a modpack from the sidebar
2. Download/update mods if needed
3. Click the **"Launch"** button
4. KEK Launcher will:
   - Backup your current mods
   - Copy the selected modpack's mods to `.minecraft/mods/`
   - Create/update a Minecraft profile
   - Launch the Minecraft launcher

### Modpack Switching
The launcher automatically:
- **Backs up** your current mods before switching
- **Copies** all mods from the selected modpack to Minecraft
- **Tracks** which modpack is currently active
- **Creates** a custom Minecraft profile for the modpack

### Minecraft Profile Management
Each modpack gets its own Minecraft profile:
- Profile name: `KEK - {Modpack Name}`
- Configured with correct Minecraft version
- Easy to identify in the Minecraft launcher

---

## 🔮 CurseForge Integration

### Setup (Optional)
1. Get an API key from [CurseForge Console](https://console.curseforge.com/)
2. Create a `.env` file in the project root:
   ```env
   CURSEFORGE_API_KEY=your_api_key_here
   ```
3. Restart the launcher

### Features
With CurseForge API configured, you can:
- **Search** for mods directly from CurseForge
- **Download** mods automatically with correct versions
- **Browse** popular and featured mods
- **Verify** mod compatibility with Minecraft versions
- **Get** automatic hash verification

### Without API Key
The launcher still works fully without a CurseForge API key. You can:
- Use direct download URLs in modpack configurations
- Download from other sources (Modrinth, GitHub, direct links)
- Manually add mods to modpack folders

---

## 📝 Modpack Configuration

### JSON Format
Create modpack configurations in the `/modpacks/` directory:

```json
{
  "id": "my-awesome-pack",
  "name": "My Awesome Modpack",
  "version": "1.0.0",
  "description": "An awesome modpack for adventure",
  "minecraftVersion": "1.19.2",
  "author": "YourName",
  "mods": [
    {
      "filename": "sodium-fabric-0.4.10.jar",
      "url": "https://cdn.modrinth.com/data/.../sodium.jar",
      "hash": "a1b2c3d4e5f6...",
      "version": "0.4.10",
      "required": true,
      "description": "Performance optimization mod"
    }
  ],
  "settings": {
    "installOnlyNew": true,
    "downloadShaders": false
  }
}
```

### Fields Explanation

| Field | Description | Required |
|-------|-------------|----------|
| `id` | Unique identifier (used for folder names) | Yes |
| `name` | Display name in the launcher | Yes |
| `version` | Modpack version | Yes |
| `minecraftVersion` | Target Minecraft version | Yes |
| `mods` | Array of mod objects | Yes |
| `mods.filename` | Mod JAR filename | Yes |
| `mods.url` | Download URL | Yes |
| `mods.hash` | MD5 hash for verification | Recommended |
| `mods.version` | Mod version | No |
| `mods.required` | Whether mod is required | No |

---

## ⚙️ Settings

### Install Only New Mods
When enabled, the launcher will:
- Skip downloading mods that already exist
- Only download missing mods
- Save bandwidth and time

### Shaderdownload (Coming Soon)
Future feature to automatically download shaders.

---

## 🎮 Workflow Example

### Creating and Using a Modpack

1. **Create Modpack JSON**
   ```bash
   # Create /modpacks/survival-plus.json
   ```

2. **Add Mods to Configuration**
   - List all mods with URLs and hashes
   - Specify Minecraft version

3. **Launch KEK Launcher**
   - Modpack appears in sidebar automatically

4. **Download Mods**
   - Select modpack
   - Click "Update Modpack"
   - Mods download to `%AppData%/.kek/modpacks/survival-plus/`

5. **Launch Minecraft**
   - Click "Launch" button
   - Mods copied to `.minecraft/mods/`
   - Minecraft launcher opens

6. **Switch Modpacks**
   - Select different modpack
   - Click "Launch"
   - Previous mods backed up automatically
   - New mods copied to Minecraft

---

## 🛠️ Advanced Features

### Manual Mod Management
You can manually manage mods:
```bash
# Open modpack folder
Click "Browse" button in launcher

# Add mods manually
Copy .jar files to the modpack folder

# Remove mods
Delete .jar files from the modpack folder
```

### Backup System
Automatic backups are created in `%AppData%/.kek/backups/`:
- Timestamped backup folders
- Created before each modpack switch
- Can be restored manually if needed

### Symlinks (Linux/Mac Only)
On Unix-like systems, you can use symlinks instead of copying:
- Saves disk space
- Instant switching
- Automatically used on Linux/Mac

---

## 📊 UI Features

### Status Messages
Terminal-style status messages with color coding:
- `[INFO]` - Cyan: Information messages
- `[OK]` - Green: Success messages
- `[WARNING]` - Cyan: Warning messages
- `[ERROR]` - Red: Error messages

### Real-time Progress
- Download progress with MB/total
- Overall progress (X/Y mods)
- Individual file progress
- Success/failure counts

### Modpack Statistics
Displays for each modpack:
- Total mods installed
- Missing mods count
- Outdated mods count
- Extra mods (not in config)
- Total size

---

## 🔧 Troubleshooting

### Minecraft Not Found
**Error:** `Minecraft not found. Please install Minecraft first.`

**Solution:**
- Install official Minecraft launcher
- Run Minecraft at least once
- Ensure `.minecraft` folder exists in AppData

### CurseForge API Errors
**Error:** `CurseForge API key not configured`

**Solution:**
- Get API key from https://console.curseforge.com/
- Add to `.env` file
- Restart launcher

### Download Failures
**Error:** `Failed to download mod`

**Possible causes:**
- Invalid URL
- Network issues
- Hash mismatch (corrupted download)

**Solutions:**
- Check mod URL is valid
- Verify internet connection
- Try re-downloading
- Check MD5 hash is correct

### Modpack Won't Launch
**Error:** `Failed to switch modpack`

**Solutions:**
- Check mods are downloaded
- Verify Minecraft is installed
- Check `.kek` folder has write permissions
- Try "Browse" button to verify mods exist

---

## 🎨 Retro Cyberpunk UI

The launcher features a unique retro hacker aesthetic:
- **Monospace font** (Courier New) throughout
- **Cyan/Pink color scheme** for cyberpunk feel
- **CRT monitor effects** (scanlines, flicker)
- **ASCII art borders** and decorations
- **Terminal-style messages** with prefixes
- **Glowing text effects** and shadows

---

## 📦 Supported Download Sources

1. **Direct URLs**
   - Any direct link to `.jar` files
   - No authentication required

2. **CurseForge** (with API key)
   - Automatic mod search
   - Version selection
   - Hash verification

3. **Modrinth**
   - Direct download URLs
   - No API key needed

4. **GitHub Releases**
   - Direct links to release assets
   - Works with public repositories

5. **Custom Hosting**
   - Any HTTP/HTTPS server
   - Must be direct download link

---

## 🚀 Future Features

Planned enhancements:
- [ ] Modrinth API integration
- [ ] Automatic mod updates
- [ ] Modpack import/export
- [ ] Shader pack management
- [ ] Resource pack management
- [ ] Config file sync
- [ ] Multiplayer server integration
- [ ] Mod conflict detection
- [ ] Dependency resolution
- [ ] One-click modpack sharing

---

## 💡 Tips & Best Practices

1. **Always include MD5 hashes** in modpack configs for verification
2. **Test modpacks** before sharing with others
3. **Keep backups** of important mods
4. **Use descriptive names** for modpacks
5. **Document dependencies** in mod descriptions
6. **Version control** your modpack JSONs with git
7. **Check Minecraft version** compatibility before adding mods
8. **Use "Install only new"** to save bandwidth on updates
9. **Browse folder** to verify mods downloaded correctly
10. **Check status messages** for detailed information

---

## 📞 Support

For issues or questions:
- Check the `modpacks/README.md` for configuration help
- Review error messages in the status bar
- Check console logs for detailed errors
- Verify all file paths are correct
- Ensure Minecraft and mods are compatible versions

---

**Happy Modding! 🎮✨**
