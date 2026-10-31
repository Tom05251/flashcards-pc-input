const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function walk(node, action) { action(node); ts.forEachChild(node, child => walk(child, action)) }
const declarations = new Map()
for (const relative of ['src/i18n/translations.ts', 'src/i18n/languages.ts']) {
  const source = ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true)
  walk(source, node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer) })
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) {
    const pairs = node.properties.map(property => {
      assert(ts.isPropertyAssignment(property), 'Dictionary members must be explicit')
      return [property.name.text, literal(property.initializer)]
    })
    assert.equal(new Set(pairs.map(([key]) => key)).size, pairs.length, 'Duplicate dictionary key')
    return Object.fromEntries(pairs)
  }
  throw Error(`Expected a literal: ${node.getText()}`)
}
const en = literal(declarations.get('en')), ja = literal(declarations.get('ja'))
const languages = literal(declarations.get('supportedLanguages')).map(language => language.code)
const effective = { ...JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/generated.json'), 'utf8')), en, ja }
const slots = value => [...value.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])).sort((a, b) => a - b)
assert.equal(languages.length, 39); assert.equal(new Set(languages).size, 39)
for (const code of languages) for (const [key, reference] of Object.entries(en)) {
  const value = effective[code]?.[key]
  assert(Object.hasOwn(effective[code] ?? {}, key), `${code}/${key}: English fallback is not accepted`)
  assert.equal(typeof value, 'string', `${code}/${key}: not text`)
  assert(value.trim(), `${code}/${key}: empty`)
  assert(!/\b(?:A?ARG\d+|BAR\s+ARG\d+|translatedText|translation_engine)\b|@\s*info:\s*tooltip|\uFFFD/i.test(value), `${code}/${key}: translation residue`)
  assert(!/[{}]/.test(value.replace(/\{\d+\}/g, '')), `${code}/${key}: malformed placeholder`)
  assert.deepEqual(slots(value), slots(reference), `${code}/${key}: placeholder numbers/multiplicity changed`)
  assert(!/[\u202a-\u202e]/.test(value), `${code}/${key}: directional override`)
  let isolates = 0
  for (const character of value) {
    if (/[\u2066-\u2068]/.test(character)) isolates++
    if (character === '\u2069') assert(--isolates >= 0, `${code}/${key}: unmatched isolate`)
  }
  assert.equal(isolates, 0, `${code}/${key}: unclosed isolate`)
}
assert(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(Object.values(en).join('')), 'CJK in English UI')
function finite(node) {
  if (ts.isStringLiteral(node)) return [node.text]
  if (ts.isConditionalExpression(node)) return [...finite(node.whenTrue), ...finite(node.whenFalse)]
  const text = node.getText()
  if (/^`tutorial\.step\.\$\{index \+ 1\}\.(title|body)`$/.test(text)) return Array.from({ length: 15 }, (_, i) => `tutorial.step.${i + 1}.${text.endsWith('title`') ? 'title' : 'body'}`)
  if (text === '`help.term.${key}.title`' || text === '`help.term.${key}.body`') return ['uncategorized', 'addChild', 'addSibling', 'addIndependent', 'folderItems', 'fastEdit', 'media', 'highlight'].map(key => `help.term.${key}.${text.endsWith('title`') ? 'title' : 'body'}`)
  if (text === '`highlight.field.${fieldNameKey(field)}`') return ['cardQuestion', 'cardAnswer', 'cardHint', 'cardHint2', 'noteTitle', 'noteBody'].map(key => `highlight.field.${key}`)
  if (text === '`color.${color.toLowerCase()}`' || text === '`color.${item.color.toLowerCase()}`') return ['blue', 'red', 'yellow', 'green'].map(key => `color.${key}`)
  throw Error(`Unresolved UI key: ${text}`)
}
const config = ts.readConfigFile(path.join(root, 'tsconfig.app.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true }), checker = program.getTypeChecker()
const numeric = new Set(['media.count', 'media.size', 'status.count', 'highlight.selectionSummary', 'import.summary', 'import.changes'])
const used = new Set(); let calls = 0
const usage = []
for (const source of program.getSourceFiles().filter(file => file.fileName.replaceAll('\\', '/').startsWith(path.join(root, 'src').replaceAll('\\', '/')) && !file.isDeclarationFile)) walk(source, node => {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 't') return
  calls++
  const types = node.arguments.slice(1).flatMap(argument => {
    const type = checker.getTypeAtLocation(ts.isSpreadElement(argument) ? argument.expression : argument)
    if (!ts.isSpreadElement(argument)) return [type]
    assert(checker.isTupleType(type), `Arguments need a fixed tuple type: ${argument.getText()}`)
    return checker.getTypeArguments(type)
  })
  for (const key of finite(node.arguments[0])) {
    used.add(key); assert(Object.hasOwn(en, key), `Missing English UI key: ${key}`)
    usage.push({ key, file: path.relative(root, source.fileName).replaceAll('\\', '/'), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, arguments: types.map(type => checker.typeToString(type)), expected: numeric.has(key) ? 'number' : 'string' })
    const indices = slots(en[key]), count = indices.length ? Math.max(...indices) + 1 : 0
    assert.equal(types.length, count, `${key}: call argument count`)
    types.forEach((type, index) => assert(type.flags & (numeric.has(key) ? ts.TypeFlags.NumberLike : ts.TypeFlags.StringLike), `${key}/${index}: call argument type`))
  }
})
assert(used.size > 150 && calls > 100, 'Effective UI usage inventory is empty')
assert.deepEqual(slots('{1} then {0}'), slots('{0} then {1}'))
assert.notDeepEqual(slots('{0} {0}'), slots('{0}'))
assert.notDeepEqual(slots('ARG0'), slots('{0}'))
console.log(`translation structure passed: ${languages.length} languages, ${Object.keys(en).length} own keys each, ${used.size} UI keys, ${calls} calls; semantic/browser acceptance is separate`)
const reportIndex = process.argv.indexOf('--report')
if (reportIndex >= 0) fs.writeFileSync(process.argv[reportIndex + 1], JSON.stringify({ status: 'STRUCTURE_VERIFIED_MEANING_AND_UI_SEPARATE', languages, baselineKeys: Object.keys(en), usedKeys: [...used].sort(), calls, usage }, null, 2))
