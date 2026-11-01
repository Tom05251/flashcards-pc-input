/* Local launcher for the already-built app. No npm packages or writes required. */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')

const host = '127.0.0.1'
const port = 5185
const base = '/flashcards-pc-input/'
const appUrl = `http://${host}:${port}${base}`
const root = fs.existsSync(path.join(__dirname, 'app', 'index.html'))
  ? path.join(__dirname, 'app')
  : path.join(__dirname, '..', 'dist')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

if (Number(process.versions.node.split('.')[0]) < 22) {
  fail('Node.js 22以降が必要です。Node.jsを更新してから、もう一度「起動.cmd」を開いてください。')
} else if (!fs.existsSync(path.join(root, 'index.html'))) {
  fail('アプリのファイルが見つかりません。ZIPを「すべて展開」してから「起動.cmd」を開いてください。\n開発用フォルダーでは先に npm run build を実行してください。')
} else {
  // Read the current build on each request. Keeping startup bytes in memory
  // would keep serving the old app and worker after an on-disk update.
  const realRoot = fs.realpathSync(root)

  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    let pathname
    try { pathname = decodeURIComponent(request.url.split('?')[0]) }
    catch { response.writeHead(400).end(); return }
    if (!pathname.startsWith('/') || /[\\\0]/.test(pathname) || pathname.split('/').some(part => part === '.' || part === '..')) {
      response.writeHead(400).end()
      return
    }
    if (pathname === '/' || pathname === base.slice(0, -1)) {
      response.writeHead(302, { Location: base }).end()
      return
    }
    const relative = pathname.startsWith(base) ? pathname.slice(base.length) || 'index.html' : null
    if (relative === null) { response.writeHead(404).end(); return }
    let bytes
    try {
      const file = fs.realpathSync(path.join(realRoot, relative))
      const inside = path.relative(realRoot, file)
      if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end()
        return
      }
      bytes = fs.readFileSync(file)
    } catch { response.writeHead(404).end(); return }
    response.writeHead(200, {
      'Content-Type': types[path.extname(relative)] || 'application/octet-stream',
      'Content-Length': bytes.length,
    })
    response.end(request.method === 'HEAD' ? undefined : bytes)
  })
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      fail(`起動できません。ポート${port}は使用中です。\n既に起動したアプリのウィンドウを確認してください。別の処理は停止しません。\nこのアプリのURL: ${appUrl}`)
    } else fail(`起動できません: ${error.message}`)
  })
  function stop() {
    console.log('\nローカル配信を終了します。保存済みデータはブラウザーに残ります。')
    server.close()
    const timer = setTimeout(() => server.closeAllConnections(), 2000)
    timer.unref()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  server.listen(port, host, () => {
    console.log(`Flashcards & Notes Deluxe PC Input PWA\n\n${appUrl}\n\nこのウィンドウは開いたまま使ってください。終了するときは Ctrl+C を押してください。\nブラウザーが開かない場合は、上のURLをブラウザーに貼り付けてください。`)
    if (!process.argv.includes('--no-open') && process.platform === 'win32') {
      execFile('rundll32.exe', ['url.dll,FileProtocolHandler', appUrl], { windowsHide: true }, error => {
        if (error) console.error(`ブラウザーを自動で開けませんでした。上のURLを開いてください。\n${error.message}`)
      })
    }
  })
}
