const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const translationsPath = path.join(root, 'src', 'i18n', 'translations.ts')
const languagesPath = path.join(root, 'src', 'i18n', 'languages.ts')
const appPath = path.join(root, 'src', 'App.tsx')

const translations = fs.readFileSync(translationsPath, 'utf8')
const languages = fs.readFileSync(languagesPath, 'utf8')
const app = fs.readFileSync(appPath, 'utf8')

function objectBlock(name, source) {
  const match = source.match(new RegExp(`export const ${name}: TranslationMap = \\{([\\s\\S]*?)\\n\\}`))
  if (!match) throw new Error(`Missing ${name} translation block`)
  return match[1]
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

const en = objectBlock('en', translations)
const ja = objectBlock('ja', translations)
const cjkOrKana = /[\u3040-\u30ff\u3400-\u9fff]/

const mixedEnglishLines = en
  .split(/\r?\n/)
  .map((line, index) => ({ line, lineNumber: index + 1 }))
  .filter((item) => cjkOrKana.test(item.line))

if (mixedEnglishLines.length) {
  fail(`English translation block contains Japanese/CJK text:\n${mixedEnglishLines.map((item) => `${item.lineNumber}: ${item.line.trim()}`).join('\n')}`)
}

for (let i = 1; i <= 15; i += 1) {
  for (const key of [`tutorial.step.${i}.title`, `tutorial.step.${i}.body`]) {
    if (!en.includes(`'${key}'`)) fail(`English translation missing ${key}`)
    if (!ja.includes(`'${key}'`)) fail(`Japanese translation missing ${key}`)
  }
}

for (const key of ['button.save', 'folder.invalidName', 'folder.duplicate', 'tutorial.button.cancel']) {
  if (!en.includes(`'${key}'`)) fail(`English translation missing ${key}`)
  if (!ja.includes(`'${key}'`)) fail(`Japanese translation missing ${key}`)
}

const languageCodes = Array.from(languages.matchAll(/\{\s*code:\s*'([^']+)'/g), (match) => match[1])
const englishNameBlock = app.match(/const englishLanguageNames: Record<string, string> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
for (const code of languageCodes) {
  if (!englishNameBlock.includes(`${code.includes('-') ? `'${code}'` : code}:`)) {
    fail(`English UI language selector name missing for ${code}`)
  }
}

if (!process.exitCode) {
  console.log('translation verification passed')
}
