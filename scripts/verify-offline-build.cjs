const fs = require('node:fs')
const path = require('node:path')

const dist = path.resolve(__dirname, '..', 'dist')
const swPath = path.join(dist, 'sw.js')
const manifestPath = path.join(dist, 'manifest.webmanifest')
const indexPath = path.join(dist, 'index.html')

function fail(message) {
  console.error(message)
  process.exit(1)
}

for (const file of [swPath, manifestPath, indexPath]) {
  if (!fs.existsSync(file)) fail(`Offline build artifact missing: ${path.relative(dist, file)}`)
}

const sw = fs.readFileSync(swPath, 'utf8')
const index = fs.readFileSync(indexPath, 'utf8')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

for (const required of ['index.html', 'manifest.webmanifest', '.js', '.css']) {
  if (!sw.includes(required)) fail(`Service worker precache does not include ${required}`)
}

if (!index.includes('manifest.webmanifest')) fail('index.html does not link manifest.webmanifest')
if (manifest.display !== 'standalone') fail('manifest display must be standalone')
if (!manifest.start_url) fail('manifest start_url is missing')

console.log('offline build verification passed')
