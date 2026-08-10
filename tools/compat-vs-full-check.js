/* 兼容模式 vs 完整模式 覆盖对拍。
 *
 * 2.0.86 换了验收标准：兼容模式的外壳必须和完整模式长得一样，
 * 对话区必须交给外部主题。所以断言也换了 ——
 * 以前问的是「六个主题之间是否一致」，现在问的是
 * 「完整模式画到的每一条，兼容模式是不是也画到了」。
 *
 * 做法：拿 _dev/fixture.html 当 DOM，分别用
 *   完整模式 = styles/<variant>-pc.css
 *   兼容模式 = styles/compat-<variant>.css（@layer cw-frame 里的内容）
 * 对每个外壳节点做一次层叠裁决（[!important, 特异性, 出现顺序]），
 * 比较两边每个属性有没有赢家。完整模式有、兼容模式没有 = 覆盖缺口，报错。
 *
 * 它只裁作者样式表，不算继承、不算浏览器默认值，也不做真实布局。
 * 「量出来是多少 px」仍然必须去真机量（见 必读-仓库与安卓测试环境.md §8）。
 * 这个脚本回答的是另一个问题：生成器有没有把该搬的规则漏掉。
 *
 * 用法：node tools/compat-vs-full-check.js
 */
const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fixturePath = path.join(root, '_dev', 'fixture.html');
const VARIANTS = ['day', 'night'];
const VIEWPORT_WIDTH = 1602;

/* 对话区归主题，不参与对拍。 */
const CHAT_SCOPE = '#chat';
const WELCOME_OWNED = /clawd-welcome/;

/* jsdom 匹配不了状态伪类和伪元素，两边一起跳过，不影响可比性。 */
const UNMATCHABLE = /::|:(?:hover|focus|focus-within|focus-visible|active|target|visited|checked|disabled|placeholder-shown|autofill|-webkit-[\w-]+)\b/;

function specificity(sel) {
  let s = String(sel);
  let a = 0, b = 0, c = 0;
  s = s.replace(/:(is|not|has|matches)\(([^()]*)\)/g, (_match, _fn, inner) => {
    const best = inner.split(',').map(part => specificity(part.trim()))
      .sort((x, y) => (y[0] - x[0]) || (y[1] - x[1]) || (y[2] - x[2]))[0] || [0, 0, 0];
    a += best[0]; b += best[1]; c += best[2];
    return '';
  });
  s = s.replace(/:where\([^()]*\)/g, '');
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length;
  b += (s.match(/\[[^\]]+\]/g) || []).length;
  b += (s.match(/:[a-z-]+(\([^)]*\))?/gi) || []).length;
  s = s.replace(/::?[a-z-]+(\([^)]*\))?/gi, '');
  c += (s.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
  return [a, b, c];
}

/* 只保留在 1602px 宽视口下会命中的 @media。两边用同一把尺子。 */
function mediaApplies(prelude) {
  if (!prelude) return true;
  const text = String(prelude).toLowerCase();
  if (/print|speech/.test(text)) return false;
  if (/hover\s*:\s*none|pointer\s*:\s*coarse/.test(text)) return false;
  for (const [, value] of text.matchAll(/min-width\s*:\s*(\d+)px/g)) {
    if (Number(value) > VIEWPORT_WIDTH) return false;
  }
  for (const [, value] of text.matchAll(/max-width\s*:\s*(\d+)px/g)) {
    if (Number(value) < VIEWPORT_WIDTH) return false;
  }
  return true;
}

function collectRules(cssText, { stripScope } = {}) {
  const ast = csstree.parse(cssText, { onParseError: () => {} });
  const rules = [];
  let order = 0;
  const walk = (node, mediaOk) => {
    if (node.type === 'Rule') {
      if (!mediaOk || node.prelude?.type !== 'SelectorList') return;
      const declarations = node.block.children.toArray()
        .filter(child => child.type === 'Declaration')
        .map(child => ({
          property: String(child.property).toLowerCase(),
          value: csstree.generate(child.value),
          important: Boolean(child.important),
        }));
      if (!declarations.length) return;
      for (const selectorNode of node.prelude.children.toArray()) {
        let selector = csstree.generate(selectorNode);
        if (stripScope) selector = selector.replace(/html\[data-claude-mode="compat"\]\s*/g, '');
        rules.push({ selector: selector.trim(), declarations, order: order++ });
      }
      return;
    }
    if (node.type !== 'Atrule' || !node.block?.children) return;
    const name = String(node.name || '').toLowerCase();
    if (name.endsWith('keyframes') || name === 'font-face') return;
    const ok = name === 'media' ? mediaApplies(node.prelude && csstree.generate(node.prelude)) : mediaOk;
    for (const child of node.block.children.toArray()) walk(child, ok);
  };
  for (const node of ast.children.toArray()) walk(node, true);
  return rules;
}

function winners(element, rules) {
  const matched = [];
  for (const rule of rules) {
    if (UNMATCHABLE.test(rule.selector)) continue;
    let hit = false;
    try { hit = element.matches(rule.selector); } catch { continue; }
    if (hit) matched.push(rule);
  }
  const best = new Map();
  for (const rule of matched) {
    const spec = specificity(rule.selector);
    for (const declaration of rule.declarations) {
      const previous = best.get(declaration.property);
      const rank = [declaration.important ? 1 : 0, ...spec, rule.order];
      if (!previous || compareRank(rank, previous.rank) > 0) {
        best.set(declaration.property, { rank, value: declaration.value, selector: rule.selector });
      }
    }
  }
  return best;
}

function compareRank(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/* 对拍范围就是框架声明自己拥有的那几块，不是「除对话区以外的一切」。
   外壳容器之外的元素（fixture 里的裸 button、#clawd-aside 之类）在完整模式下
   靠 day-pc.css 的通用规则上色，兼容模式里那些通用规则被限定进外壳作用域，
   自然就没有 —— 那不是缺口，是边界。 */
const SHELL_ROOTS = '#top-bar, #top-settings-holder, #form_sheld';
const OWN_NODES = '[class*="clawd-"], .recentChat, .recentChatList';

function shellElements(document) {
  const chat = document.querySelector(CHAT_SCOPE);
  return [...document.querySelectorAll('*')].filter(element => {
    if (element === document.documentElement || element.tagName === 'HEAD') return false;
    if (element.closest('head, script, style')) return false;
    if (chat && chat.contains(element) && !WELCOME_OWNED.test(element.className || '')) return false;
    return Boolean(element.closest(SHELL_ROOTS) || element.matches(OWN_NODES));
  });
}

/* 两处故意不搬的缺口，也只有这两处。生成器里同名的两条例外就是它们：
 *   1. html / body 的上色会继承或透进对话区，页面底色归主题；
 *   2. .drawer-icon 是换皮插槽，主题画图标就用主题的。
 * 新增第三处之前先想清楚：多一条例外，就多一处「看起来像被主题破坏、
 * 其实是框架自己没画」的地方，2.0.85 之前踩的就是这个。 */
const ROOT_PAINT = new Set([
  'background', 'background-image', 'background-color', 'color', 'color-scheme',
  'font-family', 'text-shadow', 'transition', '-webkit-tap-highlight-color',
]);
const SKIN_CHANNEL = new Set([
  'background-image', 'mask-image', '-webkit-mask-image', 'content', 'color',
]);

function isExpectedGap(element, property) {
  const tag = element.tagName.toLowerCase();
  if ((tag === 'body' || tag === 'html') && ROOT_PAINT.has(property)) return true;
  if (element.classList.contains('drawer-icon') && SKIN_CHANNEL.has(property)) return true;
  return false;
}

function describe(element) {
  const id = element.id ? `#${element.id}` : '';
  const cls = String(element.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)
    .map(name => `.${name}`).join('');
  return `${element.tagName.toLowerCase()}${id}${cls}`;
}

const fixture = fs.readFileSync(fixturePath, 'utf8');
const failures = [];
const summary = [];

for (const variant of VARIANTS) {
  const fullCss = fs.readFileSync(path.join(root, 'styles', `${variant}-pc.css`), 'utf8');
  const compatCss = fs.readFileSync(path.join(root, 'styles', `compat-${variant}.css`), 'utf8');
  const fullRules = collectRules(fullCss);
  const compatRules = collectRules(compatCss, { stripScope: true });

  const dom = new JSDOM(fixture);
  const { document } = dom.window;
  document.documentElement.setAttribute('data-claude-mode', 'compat');

  let checked = 0;
  let gaps = 0;
  for (const element of shellElements(document)) {
    const full = winners(element, fullRules);
    if (!full.size) continue;
    checked += 1;
    const compat = winners(element, compatRules);
    const missing = [...full.keys()]
      .filter(property => !compat.has(property))
      .filter(property => !isExpectedGap(element, property));
    if (!missing.length) continue;
    gaps += 1;
    failures.push(`[${variant}] ${describe(element)} 缺 ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` (共 ${missing.length} 条)` : ''}`);
  }
  summary.push(`${variant}: 对拍节点 ${checked}，覆盖缺口 ${gaps}`);
}

console.log(summary.join('\n'));
if (failures.length) {
  console.error('\n兼容模式相对完整模式存在覆盖缺口：');
  for (const line of failures.slice(0, 40)) console.error('  ' + line);
  if (failures.length > 40) console.error(`  ...另有 ${failures.length - 40} 条`);
  process.exit(1);
}
console.log('外壳区域覆盖对拍通过：完整模式画到的属性，兼容模式全部画到。');
