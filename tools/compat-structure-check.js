const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
/* 2.0.86：兼容样式表分了明暗两份，结构断言跑白天那份，
   夜间那份只校验存在且规则数一致（两份出自同一个生成器、同一套区域清单）。 */
const cssPath = path.join(root, 'styles', 'compat-day.css');
const nightCssPath = path.join(root, 'styles', 'compat-night.css');
const fixturePath = path.join(root, '_dev', 'fixture.html');
const runtimePath = path.join(root, 'index.js');
const css = fs.readFileSync(cssPath, 'utf8');
const nightCss = fs.readFileSync(nightCssPath, 'utf8');
const fixture = fs.readFileSync(fixturePath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const ast = csstree.parse(css);
const errors = [];
const rules = [];
const normalize = value => String(value).replace(/\s+/g, '');
const welcomeException = normalize(
  'html[data-claude-mode="compat"] body.clawd-welcome #chat>:is(.welcomePanel,.mes[type="assistant_message"],.mes[type="welcome_prompt"])',
);

csstree.walk(ast, {
  visit: 'Rule',
  enter(node) {
    if (node.prelude?.type !== 'SelectorList') return;
    const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
    const declarations = node.block.children.toArray()
      .filter(child => child.type === 'Declaration')
      .map(child => ({ property: child.property.toLowerCase(), value: csstree.generate(child.value), important: child.important }));
    rules.push({ selectors, declarations });
    for (const selector of selectors) {
      if (!/\.mes(?:_|\b)/.test(selector)) continue;
      /* 已经限定在外壳容器里的选择器不算消息选择器：侧栏和输入区不是 #chat 的祖先，
         写着 .mes_stop / .mesAvatarWrapper 也选不到任何消息。
         注意 .clawd-welcome 要带横杠匹配，body.clawd-welcome 是状态类不算作用域。 */
      if (/\.clawd-(?:rail|user|pc-top-actions|welcome-|fake-mic)|#top-bar\b|#top-settings-holder\b|#form_sheld\b|#send_form\b|#qr--bar\b|#nonQRFormItems\b|#leftSendForm\b|#rightSendForm\b|#send_textarea\b|\.recentChatList\b|\.recentChat\b/.test(selector)) continue;
      if (normalize(selector) !== welcomeException) {
        errors.push(`forbidden message selector: ${selector}`);
        continue;
      }
      if (declarations.length !== 1
        || declarations[0].property !== 'display'
        || declarations[0].value !== 'none'
        || !declarations[0].important) {
        errors.push('welcome message exception may contain only display:none!important');
      }
    }
  },
});

const topLevelLayers = ast.children.toArray().filter(node => node.type === 'Atrule' && node.name === 'layer');
if (topLevelLayers.length !== 1 || normalize(csstree.generate(topLevelLayers[0].prelude)) !== 'cw-frame'
  || !topLevelLayers[0].block) {
  errors.push('compat-day.css must contain one top-level @layer cw-frame block');
}

const resetRules = rules.filter(rule => rule.declarations.some(declaration =>
  declaration.property === 'all' && declaration.value === 'revert-layer' && declaration.important));
if (resetRules.length !== 2) errors.push(`expected owned-subtree and welcome-container reset rules, found ${resetRules.length}`);
const resetSelectors = resetRules.flatMap(rule => rule.selectors);
if (!resetSelectors.every(selector => selector.includes(':where('))) {
  errors.push('owned-subtree reset must use low-specificity :where()');
}
/* 归零可以覆盖 .drawer-content 这个盒子本身（面板整块归框架，2.0.86 定的边界），
   但绝不能覆盖它的后代：那些是酒馆原生控件，归零会把酒馆自己的基础样式一起断掉。 */
if (resetSelectors.some(selector => /\.drawer-content\s*[\s>+~*]/.test(selector))) {
  errors.push('owned-subtree reset must not reach .drawer-content descendants');
}
if (resetSelectors.some(selector => selector.includes('#chat') && !selector.includes('body.clawd-welcome'))) {
  errors.push('owned-subtree reset may include #chat only as the welcome-state container');
}
/* 归零范围只能是框架自己创建的节点。
   原生节点不许进：day-pc.css 有大量地方直接吃酒馆 style.css 的默认值
   （最典型的是 #send_form 的 display:flex，桌面端 day-pc.css 里根本没写），
   归零等于清空，那些默认值会一起没掉。2.0.87 输入框按钮竖排就是这么来的。 */
for (const requiredOwned of [
  '.clawd-rail-brand', '.clawd-rail-recents', '.recentChat', '.clawd-user-face',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
]) {
  if (!resetSelectors.some(selector => normalize(selector).includes(normalize(requiredOwned)))) {
    errors.push(`owned-subtree reset missing ${requiredOwned}`);
  }
}
for (const forbiddenOwned of [
  '#send_form', '#form_sheld', '#nonQRFormItems', '#leftSendForm', '#rightSendForm',
  '#send_textarea', '#qr--bar', '#top-bar', '#top-settings-holder', '.drawer-toggle', '.drawer-content',
]) {
  const welcomeContainerReset = selector => selector.includes('body.clawd-welcome');
  if (resetSelectors.some(selector => !welcomeContainerReset(selector)
    && normalize(selector).includes(normalize(forbiddenOwned)))) {
    errors.push(`owned-subtree reset must not include native node ${forbiddenOwned}`);
  }
}

function hasDeclaration(selectorPart, property, expected) {
  return rules.some(rule => rule.selectors.some(selector => selector.includes(selectorPart))
    && rule.declarations.some(declaration => declaration.property === property
      && (expected === undefined || declaration.value === expected)));
}

const required = [
  ['#persona-management-button', 'order', '5'],
  ['#leftSendForm', 'order', '1'],
  ['#send_textarea', 'order', '2'],
  ['#rightSendForm', 'order', '3'],
  ['.chatName', 'white-space', 'nowrap'],
  ['.chatName', 'text-overflow', 'ellipsis'],
  /* .chatDate / .chatPreview / .chatActions 的显隐和定位不再单独断言：
     2.0.86 起兼容模式的验收标准是「和完整模式一致」，完整模式怎么画就怎么画，
     由 tools/compat-vs-full-check.js 统一对拍。这里只留框架必须拥有的几何。 */
  ['.chatMeta', 'display', 'none'],
  ['#qr--bar:empty', 'display', 'none'],
  ['body.clawd-welcome #send_form', 'display', 'grid'],
];
for (const [selector, property, value] of required) {
  if (!hasDeclaration(selector, property, value)) errors.push(`missing ${selector} { ${property}:${value} }`);
}

for (const rule of rules) {
  for (const selector of rule.selectors) {
    const directStop = /#mes_stop$/.test(normalize(selector));
    if (directStop && rule.declarations.some(declaration => declaration.property === 'display')) {
      errors.push(`#mes_stop visibility must remain native: ${selector}`);
    }
  }
}

if (/@media\s*\(max-width\s*:\s*0px\)/.test(css)) errors.push('legacy max-width:0px block still exists');

/* 2.0.86 拆掉的东西不许回来：手写结构补丁、背板机制。
   它们都是「属性过滤器筛掉了外壳的外观」这个前提下的产物，前提没了就不该再出现。 */
if (fs.existsSync(path.join(root, '_dev', 'compat-structure-patch.css'))) {
  errors.push('compat-structure-patch.css should be gone: 外壳规则一律写进 day-pc.css，由生成器搬运');
}
if (/clawd-surface-backing|clawd-surface-host/.test(css)) {
  errors.push('compat CSS still contains the surface backing hack');
}
if (/backing\.setAttribute\(/.test(runtime)) {
  errors.push('runtime still injects surface backing elements');
}

/* 外壳整块归框架的直接体现：这三处必须有真实背景色，不再靠背板顶。 */
for (const [selectorPart, property] of [
  ['#top-settings-holder', 'background'],
  ['.drawer-content', 'background'],
  ['#send_form', 'background'],
]) {
  if (!hasDeclaration(selectorPart, property)) {
    errors.push(`compat CSS missing real ${property} on ${selectorPart}`);
  }
}

for (const runtimeFragment of [
  "const LAYER_ORDER_ID = 'claude-layer-order'",
  "layerOrder.textContent = '@layer cw-frame;'",
  'hostDocument.head.prepend(layerOrder)',
  'unwrapCompatibilityCustomStyle(',
  /* 运行时注入的交互样式表必须经过消息守卫改写，否则它会绕过所有生成期边界检查。 */
  'function guardMessageRulesForCompatibility(',
  'style.textContent = guardMessageRulesForCompatibility(',
  "new hostWindow.MutationObserver(() =>",
  "'styles/compat-' + (CLAUDE_LAYOUT === 'mobile' ? 'mobile-' : '') + CLAUDE_THEME_VARIANT + '.css'",
]) {
  if (!runtime.includes(runtimeFragment)) errors.push(`runtime missing ${runtimeFragment}`);
}

/* 2.0.99：断言反过来了。2.0.98 这里断言手机端「不许出现」侧栏选择器，
   现在手机和桌面同一套边界，外壳结构必须都在，缺一个就是范围又缩回去了。 */
for (const mobileName of ['compat-mobile-day.css', 'compat-mobile-night.css']) {
  const mobilePath = path.join(root, 'styles', mobileName);
  if (!fs.existsSync(mobilePath)) {
    errors.push(`${mobileName} missing: 手机端兼容样式表没生成`);
    continue;
  }
  const mobileCss = fs.readFileSync(mobilePath, 'utf8');
  for (const required of ['#top-settings-holder', '#top-bar', '.clawd-rail', '.recentChat', '.drawer-toggle', '#form_sheld']) {
    if (!mobileCss.includes(required)) {
      errors.push(`${mobileName} 范围不足：手机端应与桌面同一套边界，却没有 ${required}`);
    }
  }
  /* 手机端的规则必须落在 max-width:700px 里，否则等于在桌面上又叠了一份。 */
  if (!mobileCss.includes('@media (max-width:700px)')) {
    errors.push(`${mobileName} 缺少 @media (max-width:700px) 包裹`);
  }
}

const nightRuleCount = (nightCss.match(/\{/g) || []).length;
const dayRuleCount = (css.match(/\{/g) || []).length;
if (nightRuleCount !== dayRuleCount) {
  errors.push(`compat-night.css 与 compat-day.css 规则数不一致 (${nightRuleCount} vs ${dayRuleCount})`);
}
for (const fragment of ['id="qr--bar"', 'id="nonQRFormItems"', 'recentList.className = "recentChatList"', 'id="persona-management-button"']) {
  if (!fixture.includes(fragment)) errors.push(`fixture missing ${fragment}`);
}

/* ================================================================
   图标可见性回归测试（这一轮的直接回归目标）。
   2.0.84 的教训：外框全对、图标全没——图标可见性必须是断言，不能靠看截图。

   做法：对 cw-frame（compat-day.css）+ 每份主题的 custom_css（视作 st-theme 层）
   做一次简化的层叠裁决，只看会决定图标观感的五个属性
   （background-image / mask-image / -webkit-mask-image / content / color），
   判定每个 .drawer-icon（含 ::before）最终是"主题画了图标"还是
   "什么都没画、留给 Font Awesome 字形"——两者都算通过；
   只有"主题清空了内容但没补图"（比如只写 content:'' 不补 background-image）
   这种两头落空的情况才算失败。
   几何属性（width/height/position）不需要跑六主题分别验证：cw-frame 的声明
   经 forceImportant 后处于最早层的 !important，层叠优先级天然高于主题的任何
   声明（无论主题是否也写 !important），这里只做一次静态断言防回归。 ================================================================ */
const themesDir = path.resolve(root, '..', '..', '其他酒馆美化json');

function specificity(sel) {
  let s = sel;
  let a = 0, b = 0, c = 0;
  s = s.replace(/:(is|not|has|matches)\(([^()]*)\)/g, (_, fn, inner) => {
    if (fn === 'where') return '';
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
  c += (s.match(/::[a-z-]+/gi) || []).length;
  s = s.replace(/::?[a-z-]+(\([^)]*\))?/gi, '');
  c += (s.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
  return [a, b, c];
}

const ICON_WATCHED_PROPERTIES = new Set(['background-image', 'mask-image', '-webkit-mask-image', 'content', 'color']);

function collectIconDeclarations(cssText, tierNormal, tierImportant) {
  const items = [];
  let iconAst;
  try {
    iconAst = csstree.parse(cssText, { onParseError: () => {} });
  } catch {
    return items;
  }
  let order = 0;
  csstree.walk(iconAst, {
    visit: 'Rule',
    enter(node) {
      if (node.prelude?.type !== 'SelectorList') return;
      const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
      const declarations = node.block.children.toArray().filter(child => child.type === 'Declaration');
      for (const selectorText of selectors) {
        order += 1;
        if (!/\.drawer-icon\b/.test(selectorText)) continue;
        const pseudoMatch = selectorText.match(/::(before|after)\b/);
        const pseudo = pseudoMatch ? pseudoMatch[1] : null;
        const probe = selectorText.replace(/::(before|after|placeholder|selection|marker|first-line|first-letter|-webkit-[\w-]+)/g, '').trim();
        if (!probe) continue;
        const spec = specificity(selectorText);
        for (const declaration of declarations) {
          const property = declaration.property.toLowerCase();
          if (!ICON_WATCHED_PROPERTIES.has(property)) continue;
          items.push({
            probe,
            pseudo,
            property,
            value: csstree.generate(declaration.value).trim(),
            tier: declaration.important ? tierImportant : tierNormal,
            spec,
            order,
          });
        }
      }
    },
  });
  return items;
}

function compareHits(x, y) {
  if (x.tier !== y.tier) return x.tier - y.tier;
  for (let i = 0; i < 3; i += 1) if (x.spec[i] !== y.spec[i]) return x.spec[i] - y.spec[i];
  return x.order - y.order;
}

function pickWinners(items, el) {
  const hits = items.filter(item => {
    try { return el.matches(item.probe); } catch { return false; }
  });
  const byKey = new Map();
  for (const hit of hits) {
    const key = `${hit.pseudo || ''}:${hit.property}`;
    const current = byKey.get(key);
    if (!current || compareHits(hit, current) > 0) byKey.set(key, hit);
  }
  return byKey;
}

function isEmptyContent(value) {
  return value === undefined || /^(?:none|""|'')$/i.test(value.trim());
}
function isEmptyImage(value) {
  return value === undefined || /^none$/i.test(value.trim());
}

if (!fs.existsSync(themesDir)) {
  errors.push(`theme fixtures directory not found: ${path.relative(root, themesDir)}`);
} else {
  const themeFiles = fs.readdirSync(themesDir).filter(file => file.endsWith('.json'));
  if (themeFiles.length < 6) {
    errors.push(`expected at least 6 theme fixtures under ${path.relative(root, themesDir)}, found ${themeFiles.length}`);
  }

  // cw-frame 的图标相关声明：tier 3（最高，代表最早层的 !important 恒赢）。
  // 构建期断言 4 已经保证这里不会命中 background-image/mask-image/content/color——
  // 这里再算一遍纯粹是防止有人绕过 build 脚本手改 compat-day.css。
  const frameIconItems = collectIconDeclarations(css, 0, 3);
  const frameForbiddenHit = frameIconItems.find(item => item.tier === 3);
  if (frameForbiddenHit) {
    errors.push(`compat-day.css 在 .drawer-icon 上仍有换皮通道声明（应交给主题）: ${frameForbiddenHit.property}`);
  }

  const dom = new JSDOM(fixture);
  const doc = dom.window.document;
  doc.documentElement.setAttribute('data-claude-mode', 'compat');
  const iconEls = Array.from(doc.querySelectorAll('#top-settings-holder .drawer-icon'));
  if (iconEls.length < 9) errors.push(`fixture 里 .drawer-icon 少于 9 个（找到 ${iconEls.length} 个）`);

  for (const file of themeFiles) {
    let themeCss = '';
    try {
      const themeJson = JSON.parse(fs.readFileSync(path.join(themesDir, file), 'utf8'));
      themeCss = themeJson.custom_css || '';
    } catch (error) {
      errors.push(`无法解析主题 ${file}: ${error.message}`);
      continue;
    }
    // st-theme 层：normal tier 1，important tier 2 —— 恒低于 cw-frame 的 tier 3。
    const themeIconItems = collectIconDeclarations(themeCss, 1, 2);
    const allItems = [...frameIconItems, ...themeIconItems];

    for (const el of iconEls) {
      const winners = pickWinners(allItems, el);
      const bgImage = winners.get(':background-image')?.value;
      const maskImage = winners.get(':mask-image')?.value || winners.get(':-webkit-mask-image')?.value;
      const beforeContent = winners.get('before:content')?.value;
      const beforeBgImage = winners.get('before:background-image')?.value;

      const themeDrewIcon = !isEmptyImage(bgImage) || !isEmptyImage(maskImage) || !isEmptyImage(beforeBgImage);
      const themeBlockedGlyph = isEmptyContent(beforeContent) && beforeContent !== undefined;

      // 通过条件：主题画了图标；或者主题什么都没声明，字形留给 Font Awesome 默认值。
      // 失败条件：主题把 ::before 的 content 清空了，却没有配一张背景图/mask 顶上——两头落空。
      if (!themeDrewIcon && themeBlockedGlyph) {
        const iconClass = [...el.classList].find(cls => cls.startsWith('fa-')) || el.id || '(unknown icon)';
        errors.push(`主题 ${file} 清空了 ${iconClass} 的 content 但没有提供 background-image/mask-image，图标会消失`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.map(error => `FAIL ${error}`).join('\n'));
  process.exit(1);
}
console.log(`compat structure static checks passed (${rules.length} rules)`);
