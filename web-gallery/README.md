# KEK Launcher Web Gallery

A beautiful, retro-cyberpunk web gallery for showcasing and distributing your Minecraft modpacks.

## Features

✨ **Retro Cyberpunk Design** - CRT scanlines, glitch effects, cyan/pink color scheme
🔗 **Deep Linking** - Click "Install" → Opens KEK Launcher automatically
🖼️ **Image Galleries** - Showcase your modpacks with screenshots
📜 **Version History** - Track changes across modpack versions
🗳️ **Voting System** - Let users suggest mods
🔍 **Search & Filter** - By Minecraft version, modloader, or keywords

## Quick Start

### 1. Host the Gallery

**Option A: GitHub Pages (Free)**
```bash
git add web-gallery/
git commit -m "Add web gallery"
git push
# Enable GitHub Pages in repo settings → Source: main → /web-gallery
```

**Option B: Netlify (Free)**
1. Drag the `web-gallery` folder to [Netlify Drop](https://app.netlify.com/drop)
2. Done! Get your URL

**Option C: Vercel (Free)**
```bash
cd web-gallery
vercel deploy
```

### 2. Upload Your Modpack JSONs

Place your `modpack.public.json` files in the `modpacks/` folder.

**OR** host them elsewhere and add URLs to `script.js`:
```javascript
const MODPACK_URLS = [
    'https://raw.githubusercontent.com/user/repo/main/modpack.json',
    'https://pastebin.com/raw/xxxxxxx',
    'modpacks/local-modpack.json'
];
```

### 3. Add Images

Upload screenshots to:
- **Imgur** (Free, no account needed)
- **ImgBB** (Free)
- **Your hosting** (Include in repository)

Add URLs to your modpack JSON:
```json
{
  "images": {
    "thumbnail": "https://i.imgur.com/thumb.png",
    "banner": "https://i.imgur.com/banner.png",
    "gallery": [
      "https://i.imgur.com/screenshot1.png",
      "https://i.imgur.com/screenshot2.png"
    ]
  }
}
```

## Modpack JSON Format

Full format with all optional fields:

```json
{
  "id": "my-modpack",
  "name": "My Awesome Modpack",
  "version": "1.2.0",
  "minecraftVersion": "1.20.1",
  "modloader": {
    "type": "forge",
    "version": "47.2.0"
  },
  "author": "YourName",
  "description": "A detailed description of your modpack...",
  "requiredRam": "6G",
  "javaVersion": "17",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-20T15:30:00Z",

  "images": {
    "thumbnail": "https://i.imgur.com/thumb.png",
    "banner": "https://i.imgur.com/banner.png",
    "gallery": [
      "https://i.imgur.com/screenshot1.png",
      "https://i.imgur.com/screenshot2.png"
    ]
  },

  "mods": [
    {
      "filename": "create-1.20.1-0.5.1.jar",
      "url": "https://example.com/mods/create.jar",
      "curseForgeId": 328085,
      "hash": "abc123",
      "version": "0.5.1",
      "required": true
    }
  ],

  "folders": {
    "essential": ["mods", "config"],
    "optional": ["resourcepacks", "shaderpacks"]
  },

  "votingUrl": "https://github.com/user/repo/issues",
  "issuesUrl": "https://github.com/user/repo/issues",
  "downloadUrl": "https://example.com/modpack.zip",

  "versionHistory": [
    {
      "version": "1.2.0",
      "date": "2025-01-20T15:30:00Z",
      "changes": [
        "Added Create: Steam & Rails",
        "Updated Mekanism",
        "Performance improvements"
      ],
      "modsAdded": [
        { "name": "Create: Steam & Rails", "version": "1.5.2" }
      ],
      "modsRemoved": [],
      "modsUpdated": [
        { "name": "Mekanism", "oldVersion": "10.4.0", "newVersion": "10.4.5" }
      ]
    }
  ],

  "tags": ["tech", "automation", "create"],
  "difficulty": "intermediate",
  "playstyle": "automation-focused",

  "votes": {
    "totalDownloads": 1523,
    "suggestedMods": []
  }
}
```

## Image Guidelines

**Thumbnail (350x200px)**
- Shown in modpack grid
- Should be eye-catching
- PNG or JPG

**Banner (1920x400px)**
- Shown in detail modal
- Can include logo/text
- PNG or JPG

**Gallery (Any size)**
- In-game screenshots
- Show off your builds
- 3-6 images recommended

## Hosting Recommendations

### Free Hosting for Site

1. **GitHub Pages**: Best for static sites with version control
2. **Netlify**: Easy drag-and-drop, automatic HTTPS
3. **Vercel**: Great performance, CLI deployment
4. **Cloudflare Pages**: Free, fast CDN

### Free Image Hosting

1. **Imgur**: No account needed, unlimited uploads
2. **ImgBB**: Free, simple upload
3. **GitHub**: Include in repo (< 1MB per image)

### Mod File Storage

**Don't store .jar files in repo!** Instead:
- Link to CurseForge (use `curseForgeId` in JSON)
- Link to direct download URLs
- Use Cloudflare R2 (10GB free)
- Use Backblaze B2 ($0.005/GB)

## Custom Protocol Setup

The `keklauncher://` protocol is automatically registered when KEK Launcher is installed.

Users click "Install" → Browser tries to open `keklauncher://install?url=...` → Launches KEK Launcher

## Customization

### Change Colors

Edit `style.css`:
```css
:root {
    --cyan: #00d9ff;    /* Change to your primary color */
    --pink: #ff69b4;    /* Change to your accent color */
    --dark: #0a0a0a;
}
```

### Add More Filters

Edit `index.html` to add more filter options:
```html
<select id="difficultyFilter">
    <option value="">All Difficulties</option>
    <option value="easy">Easy</option>
    <option value="intermediate">Intermediate</option>
    <option value="expert">Expert</option>
</select>
```

### Analytics

Add Google Analytics or similar:
```html
<!-- Add to index.html before </body> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-ID');
</script>
```

## Troubleshooting

**Deep linking not working?**
- Ensure KEK Launcher is installed
- On first use, browser may ask permission
- Fallback: Users can manually copy URL

**Images not loading?**
- Check CORS settings
- Use direct image URLs (not HTML pages)
- Imgur: Use `i.imgur.com`, not `imgur.com`

**Modpacks not appearing?**
- Check browser console for errors
- Verify JSON is valid (use JSONLint.com)
- Check file paths in `MODPACK_URLS`

## Example Workflow

1. Create modpack in KEK Launcher
2. Click "Generate Public JSON"
3. Add image URLs (Imgur)
4. Upload JSON to your GitHub repo
5. Add URL to `script.js`
6. Deploy to GitHub Pages
7. Share your URL!
8. Users click "Install" → Modpack auto-downloads

## License

This web gallery is part of KEK Launcher and follows the same MIT license.
