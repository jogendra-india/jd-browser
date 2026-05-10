const fs = require('fs');
const packageData = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

// Use archiver to create zip
const archiver = require('archiver');

const outputFile = 'jd-browser-0.0.1.vsix';
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', function(err) {
  throw err;
});

output.on('close', function() {
  console.log(`✓ VSIX created successfully: ${outputFile}`);
  console.log(`  Size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
});

archive.pipe(output);

// Add [Content_Types].xml
const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="md" ContentType="text/plain"/>
  <Default Extension="js" ContentType="text/plain"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
</Types>`;
archive.append(contentTypes, { name: '[Content_Types].xml' });

// Add package.json
const packageJson = fs.readFileSync('package.json', 'utf-8');
archive.append(packageJson, { name: 'extension/package.json' });

// Add extension.js
const extensionJs = fs.readFileSync('extension.js', 'utf-8');
archive.append(extensionJs, { name: 'extension/extension.js' });

// Add README.md
const readme = fs.readFileSync('README.md', 'utf-8');
archive.append(readme, { name: 'extension/readme.md' });

// Add CHANGELOG.md
const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
archive.append(changelog, { name: 'extension/changelog.md' });

// Add media files
if (fs.existsSync('media/browser.svg')) {
  const svg = fs.readFileSync('media/browser.svg', 'utf-8');
  archive.append(svg, { name: 'extension/media/browser.svg' });
}

// Add manifest
const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="${packageData.publisher}.${packageData.name}" Version="${packageData.version}" Language="en-US"/>
    <DisplayName>JD Browser</DisplayName>
    <Description>A VS Code Activity Bar browser view for local and external web pages.</Description>
    <MoreInfo>https://github.com/jogendra-india/jd-browser</MoreInfo>
    <License>LICENSE</License>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${packageData.engines?.vscode || '^1.105.0'}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>`;
archive.append(manifest, { name: 'extension.vsixmanifest' });

archive.finalize();
