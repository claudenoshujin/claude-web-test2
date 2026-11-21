'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const name = 'Claude Web 2.0';
const homePage = 'https://github.com/claudenoshujin/claude-web';
const loaderPattern = /^loader-2\.0\.\d+\.js$/;
const safetyModules = new Set(['emergency.js', 'native-theme.js', 'theme-restore.js']);
const legal = /^(?:README\.md|LICENSE(?:\.[a-z]+)?|fonts\/(?:OFL|[a-z-]+-OFL)\.txt)$/i;
const banned = /playbill|\barena\b|are\.na|kbdprobe|data-claude-structure=["']linear["']|claude-web-test2|\(Test\)|claudekbddiag|keyboard-diagnostics|claude-clawd-debug-menu|Clawd 动作调试|cw-halloween-effects-menu|cw-hw-preview|a2Trace/i;
const bannedComment = /ensureAside|stampMessages|第四列|四栏|三轨|剧场主题/;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(text, old, replacement = '') {
  const at = text.indexOf(old);
  check(at >= 0 && text.indexOf(old, at + old.length) < 0, 'Review changed source anchor: ' + old);
  return text.slice(0, at) + replacement + text.slice(at + old.length);
}

function cut(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first + start.length);
  check(first >= 0 && last > first, 'Review changed source section: ' + start);
  return text.slice(0, first) + text.slice(last);
}

function formalRuntime(file, text, sourceVersion, version, parse) {
  text = text.replaceAll(sourceVersion, version);
  if (file === 'index.js') {
    const localEnabled = "claudeReadSetting('enabled', ['on', 'off'], 'on') !== 'off'";
    text = replaceOnce(text, `let CLAUDE_ENABLED = ${localEnabled};`,
      `let CLAUDE_ENABLED = window.__claudeSafety?.state?.enabled ?? (${localEnabled});`);
    const master = "    box.addEventListener('change', async () => {\n      if (!write('enabled', box.checked ? 'on' : 'off')) {";
    text = replaceOnce(text, master, `    box.addEventListener('change', async () => {
      const safety = window.__claudeSafety;
      if (safety) {
        if (safety.busy) {
          box.checked = safety.state?.enabled ?? enabled;
          hint.textContent = '安全操作正在进行，请等待当前操作结束。';
          return;
        }
        try { await (box.checked ? safety.enable() : safety.disable()); }
        catch (error) {
          hint.textContent = '操作尚未完成：' + error.message;
          safety.notify(hint.textContent);
        }
        box.checked = safety.state?.enabled ?? enabled;
        return;
      }
      if (!write('enabled', box.checked ? 'on' : 'off')) {`);
    check(text.match(/claude-web-test2/g)?.length === 3, 'Review test installation identity');
    text = text.replaceAll('claude-web-test2', 'claude-web');
    text = cut(text, '/* Via 输入框几何诊断器', 'const CLAUDE_DECORATIONS_ENABLED');
    text = cut(text, '  /* ===== 临时：Clawd 动作调试菜单', '  /* 打断：B 轨');
    text = replaceOnce(text, '        suspended: () => clawdDebugTimers.length > 0,\n');
    text = cut(text, '  /* ===== A2 诊断埋点', '  function a2Locked()');
    text = text.replace(/^\s*a2Trace(?:Mark\(|Frame\(|Start,|Stop,|:)[^\n]*\n/gm, '');
    text = cut(text, '  /* \x60?kbdprobe=1', '  function scheduleMobileViewportMetrics()');
    text = cut(text, '    keyboardDiagnostics = !CLAUDE_KBD_DIAG_ENABLED', '    startMobileKeyboardPoll();');
    text = cut(text, '    /* 诊断器一律排在核心启动之后', '\n  }\n\n  function destroy()');
    text = replaceOnce(text, ' || diagnosticRefreshPaused');
    text = replaceOnce(text, ' && now >= clawdDebugUntil');
    text = replaceOnce(text, 'isTypingActive()\n      || (clawdDebugNoAmbient && clawdDebugOpen)\n      || now < clawdDebugUntil;', 'isTypingActive();');
    text = text.replace(/^.*(?:installKeyboardDiagnostics|claudekbddiag|keyboardDiagnostics|diagnosticRefreshPaused|diagnosticIsolationMode|DIAGNOSTIC_COMPOSITOR_STYLE_ID|clawd-keyboard-diagnostics|mountClawdDebugMenu)\b.*\n/gmi, '');
  }
  if (file === 'official-web.js') {
    // The safety gate may finish after the rail CSS is mounted.
    text = replaceOnce(text, 'doc.head.append(link);',
      "doc.head.insertBefore(link, doc.getElementById('cw-rail-layout-style'));");
  }
  if (file === 'halloween.js') {
    text = cut(text, '  async function preview(effect)', '  function subscribe()');
    text = text.replace(/^.*(?:const buildVersion=|const testBuild=|if\(testBuild\)).*\n/gm, '');
    text = replaceOnce(text, "let previewMessage='', stopCopies=null;", 'let stopCopies=null;');
    text = replaceOnce(text, 'message=previewMessage||', 'message=');
    text = replaceOnce(text, '{sync,preview,get enabled()', '{sync,get enabled()');
  }
  if (file === 'halloween-scene.js') {
    text = cut(text, '  function preview(effect,delay=0)', '  function activity()');
    text = replaceOnce(text, 'finishDelete,reset,preview,positionClawd', 'finishDelete,reset,positionClawd');
    text = text.replace(/^.*getElementById\('claude-clawd-debug-menu'\).*\n/gm, '');
  }
  const eraseComment = comment => banned.test(comment) || bannedComment.test(comment)
    ? comment.replace(/[^\r\n]/g, ' ') : comment;
  if (file.endsWith('.css')) return text.replace(/\/\*[\s\S]*?\*\//g, eraseComment);
  const comments = [];
  parse(text, file, comments);
  for (const { start, end } of comments.reverse()) {
    text = text.slice(0, start) + eraseComment(text.slice(start, end)) + text.slice(end);
  }
  return text;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
  } else if (typeof node.type === 'string') {
    visit(node);
    for (const value of Object.values(node)) walk(value, visit);
  }
}

function literal(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
}

function isURL(node) {
  return node?.type === 'NewExpression' && (node.callee.name === 'URL'
    || (node.callee.object?.name === 'win' && node.callee.property?.name === 'URL' && !node.callee.computed));
}

const themes = ['day', 'night'].flatMap(theme => [
  'styles/' + theme + '-pc.css', 'styles/' + theme + '-mobile.css',
  'styles/compat-' + theme + '.css', 'styles/compat-mobile-' + theme + '.css',
]);
const themeSources = [
  "CLAUDE_COMPAT_MODE ? 'styles/compat-' + (CLAUDE_LAYOUT === 'mobile' ? 'mobile-' : '') + CLAUDE_THEME_VARIANT + '.css' : 'styles/' + CLAUDE_THEME_VARIANT + '-' + CLAUDE_LAYOUT + '.css'",
  "compatNow ? \x60styles/compat-\x24{layout === 'mobile' ? 'mobile-' : ''}\x24{variant}.css\x60 : \x60styles/\x24{variant}-\x24{layout}.css\x60",
];

function jsReferences(file, text, ast, add) {
  const excerpt = node => node ? text.slice(node.start, node.end).replace(/\s+/g, ' ') : '';
  const moduleBase = base => base === 'import.meta.url' || (file === 'index.js' && ['CLAUDE_EXTENSION_BASE', 'base'].includes(base))
    || (file === 'official-drawers.js' && base === 'versionBase');
  function inspectURL(node, required) {
    const [target, base] = node.arguments;
    const value = literal(target);
    const local = moduleBase(excerpt(base));
    if (file === 'index.js' && value === 'style.css' && excerpt(base) === 'hostDocument.baseURI') {
      add('/style.css', 'url');
    } else if (value !== undefined && (local || required)) {
      if (value !== '.') add(value, 'url');
    } else if (local && file === 'index.js' && themeSources.includes(excerpt(target))) {
      for (const theme of themes) add(theme, 'url');
    } else if (required || local) {
      throw new Error(file + ': unresolved ' + excerpt(node));
    } else if (value && /\.(?:css|js|woff2?|svg|png|webp)(?:[?#]|$)/i.test(value)) {
      add(value, 'url');
    } else if (target?.type === 'TemplateLiteral' && /(?:styles\/|fonts\/|icons\/|\.(?:css|woff2?|svg|png|webp))/.test(excerpt(target))) {
      throw new Error(file + ': unresolved asset ' + excerpt(node));
    }
  }

  walk(ast, node => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      add(node.source.value, 'import');
    } else if (node.type === 'ImportExpression') {
      const expression = node.source;
      const value = literal(expression);
      if (value !== undefined) add(value, 'import');
      else if (expression.type === 'MemberExpression' && expression.property.name === 'href' && isURL(expression.object)) inspectURL(expression.object, true);
      else if (file === 'emergency.js' && expression.operator === '+' && expression.right?.name === 'VERSION'
        && /^\.\/(?:native-theme|theme-restore)\.js\?v=$/.test(literal(expression.left))
        && /const VERSION\s*=\s*['"]2\.0\.\d+['"]/.test(text)) add(literal(expression.left), 'import');
      else if (file === 'index.js' && excerpt(expression) === 'moduleUrl' && /const moduleUrl = resolveHostModule\('scripts\/autocomplete\/AutoComplete\.js\?v=\d+\.\d+\.\d+'\);/.test(text)) add('/scripts/autocomplete/AutoComplete.js', 'import');
      else if (file === 'official-world.js' && excerpt(expression) === 'WI_URL()' && text.includes("const WI_URL=()=>new URL('/scripts/world-info.js',win.location.href).href;")) add('/scripts/world-info.js', 'import');
      else throw new Error(file + ': unresolved import(' + excerpt(expression) + ')');
    } else if (isURL(node)) {
      inspectURL(node, false);
    }
  });
}

function cssReferences(file, text, parser, add) {
  try { parser.parse(text, { source: file }); }
  catch (error) { throw new Error(file + ': ' + error.message); }
  // Inspect URL tokens even inside nested @layer and @supports rules.
  const tokens = /\/\*[\s\S]*?\*\/|@import\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(?!\s|url\()(?<badImport>[^;]+))|(?<![-\w])url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^"'()\\\s])*))\s*\)|(?<badUrl>(?<![-\w])url\()|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi;
  for (const match of text.matchAll(tokens)) {
    check(!match.groups.badImport && !match.groups.badUrl, file + ': unresolved CSS reference ' + text.slice(Math.max(0, match.index - 22), match.index + 95));
    const value = [match[1], match[2], match[4], match[5], match[6]].find(part => part !== undefined);
    if (value !== undefined) add(value, 'url');
  }
}

function build(options) {
  const project = path.resolve(options.source);
  const dest = path.resolve(options.dest);
  const requireDeps = options['node-modules']
    ? createRequire(path.join(path.resolve(options['node-modules']), '..', 'package.json')) : require;
  const acorn = requireDeps('acorn');
  const css = requireDeps('@adobe/css-tools');
  const parse = (text, file, comments) => {
    try { return acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', onComment: comments }); }
    catch (error) { throw new Error(file + ': ' + error.message); }
  };
  const git = (...args) => execFileSync('git', ['-C', options['formal-repo'], ...args], { maxBuffer: 16 * 1024 * 1024 });
  const ref = git('rev-parse', '--verify', options['formal-ref'] + '^{commit}').toString().trim();
  const oldFiles = new Set(git('ls-tree', '-r', '--name-only', '-z', ref).toString().split('\0').filter(Boolean));
  const blob = file => git('show', ref + ':' + file);
  const baseline = JSON.parse(blob('manifest.json'));
  const current = JSON.parse(fs.readFileSync(path.join(project, 'manifest.json')));
  const version = options.version;
  check(/^2\.0\.[1-9]\d*$/.test(version), 'Expected a version like 2.0.165');
  check(baseline.display_name === name && baseline.homePage === homePage, 'Incorrect formal reference identity');
  check(Number(version.split('.')[2]) > Number(baseline.version.split('.')[2]), 'Version must follow the formal baseline');
  check(!fs.existsSync(dest), 'Destination already exists: ' + dest);
  const manifest = { ...current, display_name: name, loading_order: baseline.loading_order, js: 'loader-' + version + '.js', version, homePage };
  const testEntry = parse(fs.readFileSync(path.join(project, current.js), 'utf8'), current.js);
  const testImports = testEntry.body.filter(node => node.type === 'ImportDeclaration').map(node => node.source.value);
  const mainImport = "./index.js?v=" + version;
  const webImport = "./official-web.js?v=" + version;
  check(testImports.join('\n') === ['./index.js?v=' + current.version, './official-web.js?v=' + current.version].join('\n'),
    'Review the current test entry modules');
  const loader = replaceOnce(blob(baseline.js).toString('utf8').replaceAll(baseline.version, version),
    "await import('" + mainImport + "');",
    "await import('" + mainImport + "');\n    await import('" + webImport + "');");
  const historical = new Set([...oldFiles].filter(file => loaderPattern.test(file)));
  check(historical.has(baseline.js) && !historical.has(manifest.js), 'Unexpected formal loader set');
  const legalFiles = new Set([...oldFiles, ...fs.readdirSync(project), ...fs.readdirSync(path.join(project, 'fonts')).map(file => 'fonts/' + file)].filter(file => legal.test(file)));
  // An older cached index.js can still import this compatibility entry directly.
  const roots = [manifest.js, 'manifest.json', 'recent-favorites.js', ...(manifest.css ? [manifest.css] : []), ...historical, ...legalFiles];
  const host = new Set();

  function graph(read) {
    const files = new Map();
    function visit(file, origin) {
      if (files.has(file)) return;
      check(!loaderPattern.test(file) || file === manifest.js || historical.has(file), 'Test loader in the graph: ' + file);
      const data = read(file, origin);
      files.set(file, data);
      if (!/\.(?:js|css|json|md)$/.test(file)) return;
      const text = data.toString('utf8');
      check(historical.has(file) || !banned.test(text), 'Forbidden runtime content in ' + file + ': ' + text.match(banned)?.[0]);
      const add = (reference, kind) => {
        if (reference.startsWith('data:') || reference.startsWith('#')) return;
        check(reference && !reference.includes('\\'), file + ': invalid reference ' + reference);
        const target = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
        if (['script.js', '/script.js', '../../../../script.js', '/style.css'].includes(target) || /^\/(?:scripts|img)\//.test(target)
            || (kind === 'url' && /^https:\/\//.test(target))) {
          host.add(target);
          return;
        }
        check(!target.startsWith('/') && !/^[\w-]+:/.test(target) && (kind !== 'import' || target.startsWith('.')), file + ': unclassified ' + kind + ' ' + reference);
        const next = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
        check(next !== '..' && !next.startsWith('../'), file + ': reference escapes extension ' + reference);
        visit(next, file);
      };
      if (file.endsWith('.js')) jsReferences(file, text, parse(text, file), add);
      if (file.endsWith('.css')) cssReferences(file, text, css, add);
    }
    for (const file of roots) visit(file, 'entry');
    const result = JSON.parse(files.get('manifest.json'));
    check(JSON.stringify(result) === JSON.stringify(manifest) && files.has('index.js'), 'Manifest or entry mismatch');
    const entry = files.get(result.js).toString('utf8');
    const ordered = [`import('./emergency.js?v=${version}')`, 'await installSafety()',
      'if (!await safety.shouldStart()) return;', "await import('" + mainImport + "')",
      "await import('" + webImport + "')", 'safety.notify('];
    let cursor = -1;
    for (const stage of ordered) {
      cursor = entry.indexOf(stage, cursor + 1);
      check(cursor >= 0, 'Formal entry does not use the safety gate: ' + stage);
    }
    for (const file of safetyModules) check(files.has(file), 'Missing formal safety module: ' + file);
    return files;
  }

  const files = graph((file, origin) => {
    if (file === 'manifest.json') return Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    if (file === manifest.js) return Buffer.from(loader);
    if (file === 'README.md' && oldFiles.has(file)) return blob(file);
    if (historical.has(file)) return blob(file);
    if (safetyModules.has(file)) return Buffer.from(blob(file).toString('utf8').replaceAll(baseline.version, version));
    const local = path.join(project, file);
    if (fs.existsSync(local) && fs.statSync(local).isFile()) {
      const data = fs.readFileSync(local);
      return /\.(?:js|css)$/.test(file)
        ? Buffer.from(formalRuntime(file, data.toString('utf8').replace(/\r\n/g, '\n'), current.version, version, parse))
        : data;
    }
    if (legalFiles.has(file) && oldFiles.has(file)) return blob(file);
    throw new Error(origin + ': missing extension dependency ' + file);
  });

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(dest), '.formal-build-'));
  try {
    for (const [file, data] of files) {
      const target = path.join(stage, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data, { flag: 'wx' });
    }
    const staged = graph(file => fs.readFileSync(path.join(stage, file)));
    const actual = fs.readdirSync(stage, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile());
    check(actual.length === staged.size && actual.every(entry =>
      staged.has(path.relative(stage, path.join(entry.parentPath ?? entry.path, entry.name)).replaceAll('\\', '/'))), 'Unreachable file in output');
    for (const file of historical) check(staged.get(file).equals(blob(file)), 'Changed historical loader: ' + file);
    check(!fs.existsSync(dest), 'Destination already exists: ' + dest);
    fs.renameSync(stage, dest);
    console.log(JSON.stringify({ dest, version, formalRef: ref, files: files.size, historicalLoaders: historical.size,
      safetyEntry: true, safetyModules: [...safetyModules], hostReferences: [...host].sort() }, null, 2));
  } finally {
    if (fs.existsSync(stage)) {
      check(path.dirname(path.resolve(stage)) === path.dirname(dest) && path.basename(stage).startsWith('.formal-build-'), 'Unexpected staging path');
      fs.rmSync(stage, { recursive: true });
    }
  }
}

try {
  const { values } = parseArgs({ options: {
    source: { type: 'string', default: path.join(__dirname, '..') },
    'formal-repo': { type: 'string' },
    'formal-ref': { type: 'string', default: 'cb481a0' },
    version: { type: 'string' },
    dest: { type: 'string' },
    'node-modules': { type: 'string' },
  } });
  check(values['formal-repo'] && values.version && values.dest,
    'Usage: node tools/build-formal.js --formal-repo <path> --version 2.0.165 --dest <new path> [--formal-ref cb481a0] [--node-modules <path>] (requires acorn and @adobe/css-tools)');
  build(values);
} catch (error) {
  console.error('Formal build failed: ' + error.message);
  process.exitCode = 1;
}
