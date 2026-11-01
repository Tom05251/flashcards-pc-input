// Package the existing build; do not rebuild or alter its bytes.
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const JSZip = require('jszip')

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/package-local-preview.cjs <new-output.zip>')
  const repo = path.resolve(__dirname, '..')
  const destination = path.resolve(process.argv[2])
  const zip = new JSZip()
  const hashes = {}
  await fs.access(path.join(repo, 'dist', 'index.html'))
  async function addBuild(directory, prefix = '') {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix + entry.name
      if (entry.isDirectory()) await addBuild(path.join(directory, entry.name), relative + '/')
      else if (entry.isFile()) {
        const bytes = await fs.readFile(path.join(directory, entry.name))
        zip.file('app/' + relative, bytes)
        hashes[relative] = createHash('sha256').update(bytes).digest('hex')
      } else throw new Error(`Unsupported build entry: ${relative}`)
    }
  }
  await addBuild(path.join(repo, 'dist'))
  for (const name of ['start-local.cjs', '起動.cmd', 'はじめに.txt']) {
    let bytes = await fs.readFile(path.join(repo, 'local-preview', name))
    if (name.endsWith('.cmd') || name.endsWith('.txt')) bytes = Buffer.from(bytes.toString('utf8').replace(/\r?\n/g, '\r\n'))
    zip.file(name, bytes)
  }
  zip.file('build-sha256.json', JSON.stringify(hashes, null, 2) + '\n')
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  await fs.writeFile(destination, bytes, { flag: 'wx' })
  console.log(JSON.stringify({ destination, buildFiles: Object.keys(hashes).length, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
