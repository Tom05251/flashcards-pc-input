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
if (manifest.id !== undefined) fail('Keep the legacy start_url-derived identity; relative explicit IDs can resolve to the origin root')

const languagesSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/i18n/languages.ts'), 'utf8')
const languages = [...languagesSource.matchAll(/\{ code: '([^']+)'/g)].map(match => match[1])
if (languages.length !== 39) fail('Expected 39 install manifest locales')
for (const code of languages) {
  const name = `manifest-${code}.webmanifest`
  const localized = JSON.parse(fs.readFileSync(path.join(dist, name), 'utf8'))
  if (!sw.includes(name)) fail(`Localized manifest not precached: ${code}`)
  if (localized.id !== manifest.id || localized.scope !== manifest.scope || localized.start_url !== manifest.start_url) fail(`Installed app identity changed by language: ${code}`)
  if (!localized.name || !localized.short_name || !localized.description || localized.lang !== code) fail(`Incomplete localized install manifest: ${code}`)
  if (localized.dir !== (['ar', 'ur', 'fa'].includes(code) ? 'rtl' : 'ltr')) fail(`Incorrect install manifest direction: ${code}`)
  if (JSON.stringify(localized.icons) !== JSON.stringify(manifest.icons)) fail(`Localized manifest icons differ: ${code}`)
}

console.log('offline build verification passed: 39 localized manifests, stable app identity, icons, and precache')
