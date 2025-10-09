# CDN Files for Agent Extension

These files need to be uploaded to your Vercel blob storage.

## Files:

1. **extensions.json** - BrowserOS extension configuration
   - Upload to: `https://opsl2ghblbw964xx.public.blob.vercel-storage.com/extensions.json`

2. **update-manifest.xml** - Chrome extension update manifest
   - Upload to: `https://opsl2ghblbw964xx.public.blob.vercel-storage.com/update-manifest.xml`

3. **agent-50.0.3.10.crx** - Packaged extension (you need to create this)
   - Upload to: `https://opsl2ghblbw964xx.public.blob.vercel-storage.com/agent-50.0.3.10.crx`

## How to create the CRX file:

### Option 1: Using Chrome (Manual)
1. Build the extension: `npm run build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Pack extension"
5. Select the `dist` folder
6. Use your private key if you have one
7. Rename the generated .crx file to `agent-50.0.3.10.crx`

### Option 2: Using command line
```bash
# Build first
npm run build

# Pack (you need chrome installed and your private key)
chrome --pack-extension=./dist --pack-extension-key=./path/to/private-key.pem
```

## Upload to Vercel:

You can use the Vercel CLI or web interface to upload these files to your blob storage.

## Version Updates:

When you release a new version (e.g., 50.0.3.11):
1. Update manifest.json version
2. Build: `npm run build`
3. Pack new CRX: `agent-50.0.3.11.crx`
4. Update update-manifest.xml with new version and codebase URL
5. Upload new CRX and updated XML to Vercel
6. extensions.json stays the same (it points to update-manifest.xml)
