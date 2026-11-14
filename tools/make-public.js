/* Build the public V2 tree from the tested workspace.
 *
 * This script deliberately does not run git. It copies runtime files, removes
 * test-only visual experiments, writes the public manifest/loader, then fails
 * closed if parsing or residue checks find anything suspicious.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const destArg = option('--dest');
const version = option('--version');
if (!destArg || !/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: node tools/make-public.js --dest "..\\claude-web-v2-public" --version 2.0.114');
  process.exit(2);
}
const dest = path.resolve(root, destArg);
if (dest === root || !fs.existsSync(dest) || !fs.statSync(dest).isDirectory()) {
  throw new Error(`Invalid destination: ${dest}`);
}

const STYLE_FILES = [
  'day-pc.css', 'night-pc.css', 'day-mobile.css', 'night-mobile.css',
  'compat-day.css', 'compat-night.css', 'compat-mobile-day.css', 'compat-mobile-night.css',
];
const BANNED_SELECTOR_PARTS = [
  '[data-claude-skin="playbill"]',
  '[data-claude-skin="arena"]',
  '[data-claude-structure="linear"]',
];
const BANNED_TEXT = /playbill|arena|are\.na|kbdprobe|data-claude-structure=["']linear["']/i;
const BANNED_COMMENT = /playbill|arena|are\.na|kbdprobe|ensureAside|stampMessages|第四列|四栏|三轨|剧场主题/i;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}
function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Missing JS anchor: ${label}`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous JS anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}
function removeBetween(text, start, end, label) {
  const a = text.indexOf(start);
  if (a < 0) throw new Error(`Missing JS range start: ${label}`);
  const b = text.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`Missing JS range end: ${label}`);
  return text.slice(0, a) + text.slice(b);
}
function stripBannedComments(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, comment => BANNED_COMMENT.test(comment) ? '' : comment);
  text = text.replace(/^[\t ]*\/\/[^\r\n]*(?:\r?\n|$)/gm, comment => BANNED_COMMENT.test(comment) ? '' : comment);
  return text;
}

function publicIndex(source) {
  source = replaceOnce(
    source,
    "const CLAUDE_EXTENSION_REPO = 'https://github.com/claudenoshujin/claude-web-test2';",
    "const CLAUDE_EXTENSION_REPO = 'https://github.com/claudenoshujin/claude-web';",
    'public repository URL',
  );
  source = replaceOnce(
    source,
    "    : 'https://github.com/claudenoshujin/claude-web-test2';",
    "    : 'https://github.com/claudenoshujin/claude-web';",
    'public repository fallback',
  );
  source = replaceOnce(source, "      return 'claude-web-test2';", "      return 'claude-web';", 'public folder fallback');
  source = removeBetween(
    source,
    "  /* `?kbdprobe=1`",
    "  function applyMobileViewportMetrics() {",
    'keyboard probe implementation',
  );
  source = replaceOnce(
    source,
    "    /* 诊断器一律排在核心启动之后，并且自己吃掉异常。\n       2.0.108/109 里它排在 scheduleRefresh() 前面 —— 一旦 installKeyboardProbe 抛异常，\n       刷新循环就整个起不来，症状是「加了诊断参数之后界面大面积失灵」，\n       而真正的故障点看起来却像在别处。诊断器永远不能挡在主线路上。 */\n    try {\n      installKeyboardProbe();\n    } catch (error) {\n      hostWindow.console?.warn?.('[Claude Web] kbdprobe 安装失败（不影响其余功能）', error);\n    }\n",
    '',
    'keyboard probe startup call',
  );

  source = source.replace(
    /id: '2\.0\.\d+-[^']*-' \+ \(CLAUDE_COMPAT_MODE \? 'compat' : 'full'\)/,
    `id: '${version}-public-compat-framework-' + (CLAUDE_COMPAT_MODE ? 'compat' : 'full')`,
  );
  if (!source.includes(`${version}-public-compat-framework-`)) throw new Error('Failed to rewrite public build id');

  source = stripBannedComments(source);
  if (BANNED_TEXT.test(source)) {
    const hit = source.match(BANNED_TEXT)?.[0];
    throw new Error(`Banned JS residue after transformation: ${hit}`);
  }
  return source;
}

function publicCss(source, file) {
  const ast = csstree.parse(source, { positions: true, filename: file });
  const ranges = [];
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node) {
      if (!node.prelude || !node.loc) return;
      const selector = csstree.generate(node.prelude);
      if (BANNED_SELECTOR_PARTS.some(part => selector.includes(part))) {
        ranges.push([node.loc.start.offset, node.loc.end.offset]);
      }
    },
  });
  ranges.sort((a, b) => b[0] - a[0]);
  for (const [start, end] of ranges) source = source.slice(0, start) + source.slice(end);
  source = stripBannedComments(source);
  source = source.replace(/@media[^{}]+\{\s*\}/g, '');
  csstree.parse(source, { positions: true, filename: file });
  if (BANNED_TEXT.test(source)) throw new Error(`Banned CSS residue in ${file}`);
  return { source, removed: ranges.length };
}

const indexOut = publicIndex(read(path.join(root, 'index.js')));
write(path.join(dest, 'index.js'), indexOut);
fs.copyFileSync(path.join(root, 'keyboard-diagnostics.js'), path.join(dest, 'keyboard-diagnostics.js'));

let cssRemoved = 0;
for (const file of STYLE_FILES) {
  const from = path.join(root, 'styles', file);
  const result = publicCss(read(from), file);
  cssRemoved += result.removed;
  write(path.join(dest, 'styles', file), result.source);
  console.log(`CSS ${file}: removed ${result.removed} experimental rules`);
}

const destFonts = path.join(dest, 'fonts');
fs.mkdirSync(destFonts, { recursive: true });
for (const file of fs.readdirSync(path.join(root, 'fonts'))) {
  if (!/\.(?:woff2|txt)$/i.test(file)) continue;
  fs.copyFileSync(path.join(root, 'fonts', file), path.join(destFonts, file));
}
fs.copyFileSync(path.join(root, 'styles', 'local-fonts.css'), path.join(dest, 'styles', 'local-fonts.css'));

const sourceIcons = path.join(root, 'icons');
if (fs.existsSync(sourceIcons)) fs.cpSync(sourceIcons, path.join(dest, 'icons'), { recursive: true, force: true });

const manifestPath = path.join(dest, 'manifest.json');
const manifest = JSON.parse(read(manifestPath));
manifest.display_name = 'Claude Web 2.0';
manifest.version = version;
manifest.js = `loader-${version}.js`;
manifest.homePage = 'https://github.com/claudenoshujin/claude-web';
write(manifestPath, JSON.stringify(manifest, null, 4) + '\n');
write(path.join(dest, manifest.js), `// Versioned loader: changing the manifest entry defeats WebView/module cache after updates.\nimport \"./index.js?v=${version}\";\n`);

const trash = path.join(dest, '__delete_test__.tmp');
if (fs.existsSync(trash)) fs.rmSync(trash);

function fail(message) {
  console.error(`SELF-CHECK FAILED: ${message}`);
  process.exit(1);
}
const syntax = spawnSync(process.execPath, ['--check', path.join(dest, 'index.js')], { encoding: 'utf8' });
if (syntax.status !== 0) fail(syntax.stderr || syntax.stdout || 'node --check index.js');
if (indexOut.includes('claude-web-test2')) fail('test repository identity leaked into public index');
if (!indexOut.includes("const CLAUDE_EXTENSION_REPO = 'https://github.com/claudenoshujin/claude-web';")) fail('public reinstall repository mismatch');
for (const [label, pattern] of [
  ['LAYOUTS', /const LAYOUTS = \[/],
  ['read', /function read\(key, allowed, fallback\)/],
  ['write', /function write\(key, value\)/],
  ['readClock', /function readClock\(key, fallback\)/],
  ['readNumber', /function readNumber\(key, fallback, min, max\)/],
]) {
  if (!pattern.test(indexOut)) fail(`shared runtime helper missing: ${label}`);
}
for (const file of STYLE_FILES) {
  const target = path.join(dest, 'styles', file);
  if (!fs.existsSync(target)) fail(`missing styles/${file}`);
  try { csstree.parse(read(target), { filename: file }); } catch (error) { fail(`${file}: ${error.message}`); }
}
if (!fs.existsSync(path.join(dest, 'keyboard-diagnostics.js'))) fail('keyboard-diagnostics.js missing');
if (manifest.version !== version || manifest.js !== `loader-${version}.js`) fail('manifest version/loader mismatch');
if (!fs.existsSync(path.join(dest, manifest.js))) fail(`${manifest.js} missing`);
if (manifest.homePage !== 'https://github.com/claudenoshujin/claude-web') fail('manifest homePage is not public');

const residue = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (/\.(?:js|css|json|md|txt)$/i.test(entry.name)) {
      const text = read(full);
      const hit = text.match(BANNED_TEXT);
      if (hit) residue.push(`${path.relative(dest, full)}: ${hit[0]}`);
    }
  }
}
scan(dest);
if (residue.length) fail(`banned residue:\n${residue.join('\n')}`);

console.log(`Public ${version} written to ${dest}`);
console.log(`SELF-CHECK OK: index syntax, 8 CSS parses, zero banned residue, manifest/loader/diagnostics complete`);
console.log(`Removed ${cssRemoved} experimental CSS rules in total.`);
