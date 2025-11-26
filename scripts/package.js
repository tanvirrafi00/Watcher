const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const PACKAGE_DIR = path.join(__dirname, '..', 'package');
const ZIP_NAME = 'proxy-server-extension.zip';

console.log('📦 Starting extension packaging...\n');

// Step 1: Clean package directory
console.log('🧹 Cleaning package directory...');
if (fs.existsSync(PACKAGE_DIR)) {
    fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(PACKAGE_DIR, { recursive: true });

// Step 2: Copy dist files to package directory
console.log('📋 Copying build files...');
copyDirectory(DIST_DIR, PACKAGE_DIR);

// Step 3: Copy manifest.json
console.log('📄 Copying manifest.json...');
const manifestSrc = path.join(__dirname, '..', 'public', 'manifest.json');
const manifestDest = path.join(PACKAGE_DIR, 'manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);

// Step 4: Copy icons
console.log('🎨 Copying icons...');
const iconsSrc = path.join(__dirname, '..', 'public', 'icons');
const iconsDest = path.join(PACKAGE_DIR, 'icons');
if (fs.existsSync(iconsSrc)) {
    copyDirectory(iconsSrc, iconsDest);
}

// Step 5: Create README for the package
console.log('📝 Creating README...');
const readme = `# Proxy Server Extension

Version: 1.0.0

## Installation Instructions

1. Open Chrome and navigate to \`chrome://extensions/\`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this directory

## Features

- Network traffic monitoring and logging
- Request/response modification with custom rules
- WebSocket connection monitoring
- Traffic export (JSON and HAR formats)
- Real-time bandwidth tracking
- Tab-specific traffic filtering
- Comprehensive error handling

## Support

For issues and questions, please visit the project repository.
`;
fs.writeFileSync(path.join(PACKAGE_DIR, 'README.md'), readme);

// Step 6: Create zip file
console.log('🗜️  Creating zip file...');
try {
    const zipPath = path.join(__dirname, '..', ZIP_NAME);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    // Use platform-specific zip command
    if (process.platform === 'win32') {
        // Windows: use PowerShell
        execSync(`powershell Compress-Archive -Path "${PACKAGE_DIR}\\*" -DestinationPath "${zipPath}"`, { stdio: 'inherit' });
    } else {
        // Unix-like: use zip command
        execSync(`cd "${PACKAGE_DIR}" && zip -r "../${ZIP_NAME}" .`, { stdio: 'inherit' });
    }

    console.log(`\n✅ Package created successfully: ${ZIP_NAME}`);

    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Package size: ${fileSizeInMB} MB`);

} catch (error) {
    console.error('❌ Error creating zip file:', error.message);
    console.log('\n💡 Tip: Make sure zip command is available on your system');
    process.exit(1);
}

// Step 7: Verify package contents
console.log('\n📋 Package contents:');
listDirectory(PACKAGE_DIR, '');

console.log('\n🎉 Packaging complete!');
console.log(`\n📦 Package location: ${path.join(__dirname, '..', ZIP_NAME)}`);
console.log('📁 Unpacked location:', PACKAGE_DIR);

// Helper functions
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function listDirectory(dir, indent) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        console.log(`${indent}├── ${entry.name}`);

        if (entry.isDirectory()) {
            listDirectory(path.join(dir, entry.name), indent + '│   ');
        }
    }
}
