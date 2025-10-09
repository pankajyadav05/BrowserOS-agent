# 🔢 Version Management Guide

## Current Version: 1.0.0

## 📋 Version Files (Keep these in sync!)

| File | Line | Purpose |
|------|------|---------|
| `manifest.json` | 4 | **MAIN** - Extension version shown in browser |
| `update-manifest.xml` | 3 | Auto-update check - MUST match manifest.json |
| `package.json` | 3 | NPM only - can be different |

## 🚀 How to Release a New Version

### Step 1: Update Version Numbers
```bash
# Edit these files:
1. manifest.json         → "version": "1.1.0"
2. update-manifest.xml   → version="1.1.0"
3. package.json          → "version": "1.1.0" (optional but recommended)
```

### Step 2: Build New Version
```bash
cd B:\projects\codifyit\browseros-agent
npm run build
```

### Step 3: Package as CRX
```
1. Open Chrome
2. Go to chrome://extensions
3. Click "Pack extension"
4. Extension root: B:\projects\codifyit\browseros-agent\dist
5. Private key: B:\projects\codifyit\browseros-agent\dist.pem
6. Creates: dist.crx
```

### Step 4: Upload to Vercel
```
Upload to Vercel storage:
- dist.crx (overwrites old version)
- update-manifest.xml (with new version number)
- extensions.json (no change needed)
```

### Step 5: Users Get Update
```
Browser checks every 15 minutes
Sees new version in update-manifest.xml
Downloads new dist.crx automatically
```

## 📊 Version Numbering (Semantic Versioning)

Format: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x): Breaking changes, major redesign
- **MINOR** (x.1.x): New features, non-breaking changes
- **PATCH** (x.x.1): Bug fixes, small tweaks

### Examples:
- `1.0.0` → Initial release
- `1.0.1` → Fixed a bug
- `1.1.0` → Added new feature
- `2.0.0` → Complete redesign

## ⚠️ Important Rules

1. **ALWAYS match**: `manifest.json` version = `update-manifest.xml` version
2. **Version must increase**: Can't go from 1.1.0 back to 1.0.0
3. **Use 3 numbers**: Not "1.0" or "1" - must be "1.0.0"
4. **Rebuild after version change**: Run `npm run build` again

## 🔍 How to Check Current Version

### In Browser:
```
1. Go to chrome://extensions
2. Find "Mitria"
3. Version shown below name
```

### In Code:
```bash
# Check manifest
cat manifest.json | grep version

# Check update manifest
cat update-manifest.xml | grep version
```

## 🐛 Troubleshooting

**Problem**: Extension won't update
**Cause**: Version in update-manifest.xml is same or older
**Fix**: Increase version number, rebuild, re-upload

**Problem**: Browser says "version mismatch"
**Cause**: manifest.json and dist.crx have different versions
**Fix**: Delete dist/, run `npm run build`, repackage CRX

**Problem**: Two different versions shown
**Cause**: Old extension still loaded in browser
**Fix**: Remove extension, reload from new CRX

## 📝 Version History Template

```markdown
## [1.1.0] - 2025-10-09
### Added
- New feature X
- Improved Y

### Fixed
- Bug with Z

## [1.0.0] - 2025-10-08
### Added
- Initial release
- Custom new tab page
- AI sidepanel
```
