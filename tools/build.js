// Builds store packages: dist/owned-elsewhere-<version>-chrome.zip (Chrome Web Store, Edge Add-ons, Opera)
// and dist/owned-elsewhere-<version>-firefox.zip (addons.mozilla.org). Usage: node tools/build.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const src = path.join(root, 'extension');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const v = manifest.version;

execFileSync(process.execPath, [path.join(__dirname, 'locales.js')], { stdio: 'inherit' });

const variants = {
  // Chrome / Edge stores reject background.scripts in MV3: keep only the service worker.
  chrome: m => Object.assign({}, m, m.background ? { background: { service_worker: m.background.service_worker } } : {}),
  // Firefox runs background.scripts; service_worker is Chrome-only.
  firefox: m => Object.assign({}, m, m.background ? { background: { scripts: m.background.scripts } } : {}, {
    browser_specific_settings: {
      gecko: {
        id: 'owned-elsewhere@extensions',
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] }
      }
    }
  })
};

fs.mkdirSync(dist, { recursive: true });
for (const [name, transform] of Object.entries(variants)) {
  const out = path.join(dist, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(src, out, { recursive: true });
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(transform(manifest), null, 2) + '\n');
  const zip = path.join(dist, `owned-elsewhere-${v}-${name}.zip`);
  fs.rmSync(zip, { force: true });
  // bsdtar (Windows 10+, macOS) writes zip entries with forward slashes, as the stores require.
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
  execFileSync(tar, ['-a', '-c', '-f', zip, '*'], { cwd: out, shell: process.platform !== 'win32' });
  console.log('built', path.relative(root, zip), (fs.statSync(zip).size / 1024).toFixed(0) + ' KB');
}

// Source archive for AMO review (third-party libraries are unmodified npm releases, see README).
const srcZip = path.join(dist, `owned-elsewhere-${v}-source.zip`);
fs.rmSync(srcZip, { force: true });
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
execFileSync(tar, ['-a', '-c', '-f', srcZip, 'extension', 'tools/locales.js', 'tools/build.js', 'README.md', 'LICENSE', 'package.json'], { cwd: root });
console.log('built', path.relative(root, srcZip));
