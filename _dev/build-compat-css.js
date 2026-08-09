const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'styles', 'day-pc.css');
const basePath = path.join(__dirname, 'compat-framework-base.css');
const patchPath = path.join(__dirname, 'compat-structure-patch.css');
const outputPath = path.join(root, 'styles', 'compat.css');
const sourceAst = csstree.parse(fs.readFileSync(sourcePath, 'utf8'));

const WELCOME_PLACEHOLDER_SELECTOR =
  'html[data-claude-mode="compat"] body.clawd-welcome #chat>:is(.welcomePanel,.mes[type="assistant_message"],.mes[type="welcome_prompt"])';

const OWNED_ROOTS = [
  '.clawd-rail-brand', '.clawd-rail-recents', '.clawd-rail-recents-label', '.clawd-pc-top-actions',
  '.recentChatList', '.recentChat',
  '.clawd-user-face', '.clawd-user-meta', '.clawd-user-name', '.clawd-user-plan', '.clawd-user-more',
  '#top-settings-holder>.drawer>.drawer-toggle',
  '#send_form', '#qr--bar', '#nonQRFormItems', '#leftSendForm', '#rightSendForm',
  '#send_textarea',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
  '.clawd-surface-backing',
];

const OWNED_SUBTREES = [
  '.clawd-rail-brand', '.clawd-rail-recents', '.clawd-pc-top-actions',
  '.recentChatList', '.recentChat', '.clawd-user-face', '.clawd-user-meta',
  '#top-settings-holder>.drawer>.drawer-toggle', '#qr--bar',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
];

const exactProperties = new Set([
  'display', 'position', 'top', 'right', 'bottom', 'left', 'inset', 'order', 'float', 'clear',
  'gap', 'row-gap', 'column-gap', 'width', 'height', 'min-width', 'min-height', 'max-width',
  'max-height', 'box-sizing', 'aspect-ratio', 'contain', 'visibility', 'transform', 'translate',
  'scale', 'rotate', 'align-items', 'align-self', 'align-content', 'justify-content',
  'justify-items', 'justify-self', 'white-space', 'text-overflow', '-webkit-line-clamp',
  '-webkit-box-orient', 'font-size', 'line-height', 'pointer-events', 'z-index',
]);

function keepProperty(property) {
  const name = String(property || '').toLowerCase();
  return exactProperties.has(name)
    || /^(?:flex|grid|margin|padding|overflow)(?:-|$)/.test(name)
    || /^(?:inset)-(?:block|inline)(?:-|$)/.test(name);
}

function isForbiddenSelector(selector) {
  return /#chat\s*>\s*\.mes(?:\b|\[)|\.mes(?:_|\b)|\.claude-user-message-actions|\.clawd-signoff-button|reasoning/i.test(selector);
}

function isLegacyRecentSelector(selector) {
  return /\.clawd-rail-recents/.test(selector)
    && /:(?:first|nth)-of-type|\[class\*=["']?(?:delete|rename|export|avatar)/i.test(selector);
}

function isFrameworkSelector(selector) {
  if (isForbiddenSelector(selector) || isLegacyRecentSelector(selector)) return false;
  if (/#chat\s*(?:>|\s)/.test(selector)
    && !/\.(?:clawd-welcome-hero|clawd-welcome-shortcuts)\b/.test(selector)) return false;
  if (/\.(?:avatar|recentChatInfo|chatNameContainer|chatName|chatDate|chatMeta|chatPreview|chatActions)\b/.test(selector)
    && !/\.(?:clawd-rail-recents|recentChat)\b/.test(selector)) return false;
  if (/#top-settings-holder/.test(selector) && /\.(?:drawer|drawer-toggle|drawer-icon|drawer-content)\b/.test(selector)) return true;
  return /#(?:top-bar|top-settings-holder|sheld|chat|form_sheld|send_form|qr--bar|nonQRFormItems|leftSendForm|send_textarea|rightSendForm|send_but|mes_stop|options_button|extensionsMenuButton)\b/.test(selector)
    || /\.(?:clawd-rail-brand|clawd-rail-recents|clawd-rail-recents-label|clawd-rail-grip|clawd-pc-top-actions|recentChatList|recentChat|avatar|recentChatInfo|chatNameContainer|chatName|chatDate|chatMeta|chatPreview|chatActions|clawd-user-face|clawd-user-meta|clawd-user-name|clawd-user-plan|clawd-user-more|clawd-welcome-hero|clawd-welcome-shortcuts)\b/.test(selector)
    || (/body\.clawd-welcome/.test(selector) && /#(?:form_sheld|send_form|nonQRFormItems|leftSendForm|send_textarea|rightSendForm)\b/.test(selector));
}

function scopeSelector(selector) {
  if (/html\[data-claude-mode=["']compat["']\]/.test(selector)) return selector;
  if (/^html\s+body/.test(selector)) return selector.replace(/^html\s+body/, 'html[data-claude-mode="compat"] body');
  if (/^html\b/.test(selector)) return selector.replace(/^html\b/, 'html[data-claude-mode="compat"]');
  if (/^body\b/.test(selector)) return `html[data-claude-mode="compat"] ${selector}`;
  return `html[data-claude-mode="compat"] body ${selector}`;
}

function renderRule(node) {
  if (node.prelude?.type !== 'SelectorList') return '';
  const selectors = node.prelude.children.toArray()
    .map(selector => csstree.generate(selector))
    .filter(isFrameworkSelector)
    .map(scopeSelector);
  if (!selectors.length) return '';
  const declarations = node.block.children.toArray()
    .filter(child => child.type === 'Declaration' && keepProperty(child.property))
    .map(child => csstree.generate(child));
  if (!declarations.length) return '';
  return `${selectors.join(',\n')}{${declarations.join(';')}}`;
}

function render(node) {
  if (node.type === 'Rule') return renderRule(node);
  if (node.type !== 'Atrule' || !node.block?.children) return '';
  const name = String(node.name || '').toLowerCase();
  if (name.endsWith('keyframes')) return '';
  const body = node.block.children.toArray().map(render).filter(Boolean).join('\n');
  if (!body) return '';
  const prelude = node.prelude ? ` ${csstree.generate(node.prelude)}` : '';
  return `@${node.name}${prelude}{${body}}`;
}

/* 框架层里的重置规则是 all:revert-layer!important。
   同层里任何普通声明都会被它压掉，所以框架自己的声明必须一律 !important。
   两个例外：
     · 自定义属性（--x）不能强制 —— 那是留给主题覆盖的换皮通道
     · @keyframes 里的声明加 !important 无效，会被浏览器丢弃 */
function forceImportant(cssText) {
  const ast = csstree.parse(cssText);
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node, item, list) {
      if (node.property.startsWith('--')) return;
      if (this.atrule && /keyframes$/i.test(String(this.atrule.name))) return;
      node.important = true;
    },
  });
  return csstree.generate(ast);
}

const generated = sourceAst.children.toArray().map(render).filter(Boolean).join('\n');
const base = fs.readFileSync(basePath, 'utf8').trim();
const structurePatch = fs.readFileSync(patchPath, 'utf8').trim();
const welcomeException = `@media (min-width:701px){\n${WELCOME_PLACEHOLDER_SELECTOR}{display:none!important}\n}`;
/* 换皮插槽不能进归零范围：主题在这里画图标是被允许的。
   框架只锁它的盒子（见 compat-structure-patch.css），不锁内容。 */
const SUBTREE_EXCLUDE = {
  '#top-settings-holder>.drawer>.drawer-toggle': ':not(.drawer-icon)',
};

const ownedSelectors = [
  ...OWNED_ROOTS,
  ...OWNED_SUBTREES.map(selector => `${selector} *${SUBTREE_EXCLUDE[selector] || ''}`),
];
const ownedReset = [
  '/* Framework-owned nodes: cancel every declaration supplied by the external theme.',
  ' * This must be the first structural rule in cw-frame. Never include .drawer-content or #chat descendants. */',
  `@media (min-width:701px){\n:where(html[data-claude-mode="compat"] body) :where(\n${ownedSelectors.join(',\n')}\n){all:revert-layer!important}\n}`,
  '/* Welcome owns the chat and composer containers, but never any message descendant. */',
  '@media (min-width:701px){',
  ':where(html[data-claude-mode="compat"] body.clawd-welcome) :where(#chat,#form_sheld){all:revert-layer!important}',
  '}',
  /* 放行 = 不声明，不是声明成 revert-layer。revert-layer 在 cw-frame（第一层）里等于清空，
   * 主题永远画不回来。.drawer-icon 的换皮插槽边界靠上面归零选择器里的 :not(.drawer-icon) 排除来保证，
   * 这里不需要、也不允许再写任何 .drawer-icon 相关规则。 */
].join('\n');

const expectedSelectors = new Set();
csstree.walk(sourceAst, {
  visit: 'Rule',
  enter(node) {
    if (node.prelude?.type !== 'SelectorList') return;
    const hasStructuralDeclaration = node.block.children.toArray()
      .some(child => child.type === 'Declaration' && keepProperty(child.property));
    if (!hasStructuralDeclaration) return;
    for (const selectorNode of node.prelude.children.toArray()) {
      const selector = csstree.generate(selectorNode);
      if (isFrameworkSelector(selector)) expectedSelectors.add(scopeSelector(selector).replace(/\s+/g, ''));
    }
  },
});
const generatedAst = csstree.parse(generated);
const generatedSelectors = new Set();
csstree.walk(generatedAst, {
  visit: 'Rule',
  enter(node) {
    if (node.prelude?.type !== 'SelectorList') return;
    for (const selectorNode of node.prelude.children.toArray()) {
      generatedSelectors.add(csstree.generate(selectorNode).replace(/\s+/g, ''));
    }
  },
});
const missingSelectors = [...expectedSelectors].filter(selector => !generatedSelectors.has(selector));
if (missingSelectors.length) {
  throw new Error(`compat coverage missing ${missingSelectors.length} selector(s):\n${missingSelectors.join('\n')}`);
}

const frameBody = [
  ownedReset,
  base,
  '/* Structural declarations imported from the full desktop layout. */',
  `@media (min-width:701px){\n${generated}\n}`,
  '/* The sole message-selector exception: native welcome placeholders only. */',
  welcomeException,
  structurePatch,
].join('\n\n');
const frameBodyForced = forceImportant(frameBody);

/* ---- 构建期断言：写文件之前必须全过，任何一条不过就 throw ---- */
const assertAst = csstree.parse(frameBodyForced);

// 1. cw-frame 层里不允许存在普通声明（自定义属性和 @keyframes 内除外）
const plainDeclarations = [];
csstree.walk(assertAst, {
  visit: 'Declaration',
  enter(node) {
    if (node.property.startsWith('--')) return;
    if (this.atrule && /keyframes$/i.test(String(this.atrule.name))) return;
    if (!node.important) plainDeclarations.push(node.property);
  },
});
if (plainDeclarations.length) {
  throw new Error(`compat.css 断言1失败：存在会被 all:revert-layer!important 压掉的普通声明: ${plainDeclarations.join(', ')}`);
}

// 2. 不允许出现 revert-layer，除了 all:revert-layer 那两条重置（按 property === 'all' 豁免）
const badRevertLayer = [];
csstree.walk(assertAst, {
  visit: 'Declaration',
  enter(node) {
    if (node.property === 'all') return;
    const value = csstree.generate(node.value);
    if (/revert-layer/i.test(value)) badRevertLayer.push(`${node.property}:${value}`);
  },
});
if (badRevertLayer.length) {
  throw new Error(`compat.css 断言2失败：出现非 all 的 revert-layer（放行只能靠不声明，不是 revert-layer）: ${badRevertLayer.join(', ')}`);
}

// 3. 引用的每个 var(--x)，若不以宿主变量前缀开头，必须在最终输出里有定义
const HOST_VAR_PREFIXES = ['--SmartTheme', '--mainFontFamily', '--fontScale', '--topBar'];
const definedVars = new Set();
csstree.walk(assertAst, {
  visit: 'Declaration',
  enter(node) {
    if (node.property.startsWith('--')) definedVars.add(node.property);
  },
});
const referencedVars = new Set();
csstree.walk(assertAst, {
  visit: 'Function',
  enter(node) {
    if (node.name !== 'var') return;
    const first = node.children.first;
    if (first && first.type === 'Identifier') referencedVars.add(first.name);
  },
});
const undefinedVars = [...referencedVars].filter(name =>
  !definedVars.has(name) && !HOST_VAR_PREFIXES.some(prefix => name.startsWith(prefix)));
if (undefinedVars.length) {
  throw new Error(`compat.css 断言3失败：引用了未定义的自定义属性: ${undefinedVars.join(', ')}`);
}

// 4. 框架层里不允许对 .drawer-icon（含伪元素）声明换皮通道属性
const SKIN_CHANNEL_PROPERTIES = new Set(['background-image', 'mask-image', '-webkit-mask-image', 'content', 'color']);
const drawerIconViolations = [];
csstree.walk(assertAst, {
  visit: 'Rule',
  enter(node) {
    if (node.prelude?.type !== 'SelectorList') return;
    const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
    if (!selectors.some(selector => /\.drawer-icon\b/.test(selector))) return;
    for (const child of node.block.children.toArray()) {
      if (child.type === 'Declaration' && SKIN_CHANNEL_PROPERTIES.has(child.property)) {
        drawerIconViolations.push(`${selectors.join(',')} { ${child.property} }`);
      }
    }
  },
});
if (drawerIconViolations.length) {
  throw new Error(`compat.css 断言4失败：.drawer-icon 上声明了换皮通道属性（应交给主题）: ${drawerIconViolations.join('; ')}`);
}

const output = [
  '/* GENERATED by _dev/build-compat-css.js. Do not edit this file directly. */',
  '@layer cw-frame {',
  frameBodyForced,
  '}',
].join('\n\n').trimEnd() + '\n';

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(output)} bytes)`);
