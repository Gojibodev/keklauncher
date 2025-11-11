# Modpack Configuration Format

Each modpack is defined by a JSON file with the following structure:

```json
{
  "id": "unique-modpack-id",
  "name": "Display Name",
  "version": "1.0.0",
  "description": "Modpack description",
  "minecraftVersion": "1.19.2",
  "author": "Author Name",
  "mods": [
    {
      "filename": "mod-name-v1.0.jar",
      "url": "https://download-url.com/mod.jar",
      "hash": "md5-hash-of-file",
      "version": "1.0",
      "required": true,
      "description": "Mod description"
    }
  ],
  "installPath": "mods/modpack-id",
  "settings": {
    "installOnlyNew": true,
    "downloadShaders": false
  }
}
```

## Fields Explanation:

- **id**: Unique identifier for the modpack (used for folder names)
- **name**: Display name shown in the UI
- **version**: Modpack version
- **description**: Brief description
- **minecraftVersion**: Target Minecraft version
- **author**: Modpack creator
- **mods**: Array of mod objects:
  - **filename**: Local filename for the mod
  - **url**: Download URL (supports direct downloads, CurseForge, Modrinth, etc.)
  - **hash**: MD5 hash for verification (optional but recommended)
  - **version**: Mod version
  - **required**: Whether the mod is required or optional
  - **description**: Mod description
- **installPath**: Where mods should be installed
- **settings**: Modpack-specific settings

## Supported Download Sources:

- Direct download URLs
- CurseForge API (requires API key)
- Modrinth API
- GitHub releases
- Custom hosting

## Hash Calculation:

To calculate the MD5 hash of a file:
```bash
md5sum mod-file.jar
```

Or in Node.js:
```javascript
const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('md5').update(fs.readFileSync('mod-file.jar')).digest('hex');
```
