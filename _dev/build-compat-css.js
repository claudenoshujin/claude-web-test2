/* 兼容框架样式表生成器（区域制）。
 *
 * 2.0.86 之前这个脚本干的是「筛属性」：从 day-pc.css 里只挑几何相关的声明，
 * 其余一律丢给外部主题。那条线在现实里不存在 —— 面板的白底、Clawd 的背景图、
 * 图标的字形都既是结构又是外观，筛掉之后框架自己缺一块，症状看起来却像
 * 「被主题破坏」，于是一路修在错的方向上（见 兼容框架-进展与未修复缺陷汇总-20260809.docx）。
 *
 * 现在改成「筛区域」：
 *   · 外壳（侧栏 / 欢迎页 / 输入区 / 抽屉面板 / 其余非对话区）整块照搬 day-pc.css，
 *     一条声明都不删，颜色一起带走 —— 兼容模式下外壳就是 Claude Web 本体。
 *   · 对话区（#chat 的后代、.mes 家族）整条丢弃，交给外部美化 JSON。
 *   · 两个例外，都是「这条声明会漏进对话区」才存在的：
 *       - html/:root/body 只保留自定义属性和少量布局声明，背景/文字色不搬；
 *       - .drawer-icon 是换皮插槽，只锁盒子，不写 background-image/content/color。
 *
 * 输出两份：styles/compat-day.css、styles/compat-night.css，跟随明暗开关。
 */
const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const basePath = path.join(__dirname, 'compat-framework-base.css');
const VARIANTS = ['day', 'night'];

/* 对话区：整条规则丢弃。.clawd-welcome-* 是框架自己的欢迎页结构，
   它长在 #chat 里，但不属于消息，必须放行。 */
const CHAT_CONTENT = new RegExp([
  '\\.mes(?:_|\\b)',
  '\\.last_mes\\b',
  '\\.mesAvatarWrapper\\b',
  '\\.swipe',
  '\\.name_text\\b',
  'reasoning',
  '\\.claude-user-message-actions\\b',
  '\\.clawd-signoff-button\\b',
  '#chat\\s*(?:>|\\s)',
].join('|'), 'i');

/* 放行的只有框架自己建的欢迎页节点。注意不能写成 /\.clawd-welcome/ ——
   那样 body.clawd-welcome #chat>.mes[...] 这类选择器会被当成框架自有内容放进来，
   等于把消息选择器漏进框架层。 */
const WELCOME_OWNED = /\.clawd-welcome-(?:hero|shortcuts)\b/;

/* 根级声明里唯一允许搬的普通属性。其余（background / color / font-family /
   color-scheme）会继承或透进对话区，属于主题的地盘。 */
const ROOT_ALLOWED = new Set([
  'interpolate-size', 'width', 'max-width', 'min-width',
  'overflow-x', 'overscroll-behavior-x', 'overscroll-behavior',
]);

/* 换皮插槽：主题写了图标就用主题的，没写就让 Font Awesome 的字形自然显示。 */
const SKIN_CHANNEL_PROPERTIES = new Set([
  'background-image', 'mask-image', '-webkit-mask-image', 'content', 'color',
]);

const WELCOME_PLACEHOLDER_SELECTOR =
  'html[data-claude-mode="compat"] body.clawd-welcome #chat>:is(.welcomePanel,.mes[type="assistant_message"],.mes[type="welcome_prompt"])';

/* 子树归零（R2）。范围只覆盖框架自有节点和框架完全重定位的容器。
 * 绝对不要把 .drawer-content 的后代或 #chat 的后代加进来：那些是酒馆原生控件，
 * 归零会连酒馆自己未分层的基础样式一起够不到，面板会变成裸控件。 */
/* 归零范围：只能是框架自己创建、并且 day-pc.css 自己把几何写全了的节点。
 *
 * 2.0.87 真机的教训：day-pc.css 是「坐在酒馆上面」写的，很多地方直接吃酒馆
 * style.css 的默认值 —— 比如 #send_form 的 display:flex，桌面端 day-pc.css
 * 里根本没写，是酒馆自己给的。归零等于清空（包括未分层的酒馆样式），
 * 于是兼容模式下 #send_form 变成 display:block，按钮竖着排。
 * 所以原生节点（#send_form / #top-settings-holder / .drawer-* / #form_sheld …）
 * 一律不归零，靠层序 + !important 压主题就够；框架没声明的地方让酒馆默认值露出来，
 * 这比清空成裸元素安全得多。 */
const RESET_ROOTS = [
  '.clawd-rail-brand', '.clawd-rail-recents', '.clawd-rail-recents-label', '.clawd-pc-top-actions',
  '.recentChatList', '.recentChat',
  '.clawd-user-face', '.clawd-user-meta', '.clawd-user-name', '.clawd-user-plan', '.clawd-user-more',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
];

/* 子树归零只能覆盖框架自己建出来的节点。
   实测（2.0.86 真机）：all:revert-layer!important 并不是「清空」，它会回退到
   酒馆自己那份未分层的 style.css —— 这对撤销主题是对的，但它同时也压过了
   酒馆运行时写在元素上的 inline display。所以 #form_sheld * / #top-bar * 这种
   把原生控件整片扫进去的写法会让 #mes_impersonate、#mes_continue、
   #dialogue_del_mes 这些「该藏的时候藏」的控件常驻显示。原生控件只归零它们的
   容器根，内部交给酒馆自己。 */
const RESET_SUBTREES = [
  '.clawd-rail-brand', '.clawd-rail-recents', '.clawd-pc-top-actions',
  '.recentChatList', '.recentChat', '.clawd-user-face', '.clawd-user-meta',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
];

/* 换皮插槽不进归零范围。 */
const SUBTREE_EXCLUDE = {};

/* 框架自己建的节点。只有它们的 display/visibility 才强制 !important；
   原生控件的显隐必须留给酒馆的运行时逻辑，否则「该藏的时候藏不住」。 */
const FRAME_OWNED_SUBJECT = /\.clawd-[\w-]+|\.recentChatList\b|\.recentChat\b|#top-bar\b|#top-settings-holder\b|#form_sheld\b|#send_form\b|#qr--bar\b|#nonQRFormItems\b|#leftSendForm\b|#rightSendForm\b|#send_textarea\b|#sheld\b|#chat\b|\.drawer-content\b|\.drawer-toggle\b/;
const RUNTIME_TOGGLED_PROPERTIES = new Set(['display', 'visibility']);

function keepsNativeToggle(rule) {
  if (!rule || rule.prelude?.type !== 'SelectorList') return false;
  const selectors = rule.prelude.children.toArray().map(selector => csstree.generate(selector));
  return selectors.every(selector => !FRAME_OWNED_SUBJECT.test(selectorSubject(selector)));
}

function selectorSubject(selector) {
  const parts = String(selector).split(/[\s>+~]+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function isRootLevel(selector) {
  return /^(?::root|html)(?:\[[^\]]*\])*$/.test(String(selector).trim())
    || /^(?:html\s+)?body$/.test(String(selector).trim());
}

/* 已经限定在外壳容器里的选择器，无论提到什么类名都不可能选到消息 ——
   侧栏和输入区不是 #chat 的祖先。
   这条豁免是必须的：day-pc.css 里侧栏头像那条写的是
   `.clawd-rail-recents :is(img,.avatar,.mesAvatarWrapper,[class*="avatar"i])`，
   只因为括号里出现了 .mesAvatarWrapper，整条就会被当成对话区规则丢掉，
   侧栏头像于是回到图片原始尺寸（2.0.86 真机上是 96×144）。
   注意 #sheld / #chat 不能进这张表 —— 它们是消息的祖先。 */
const FRAME_SCOPED = new RegExp([
  /* 注意是 clawd-welcome- 带横杠：body.clawd-welcome 是状态类，
     写着它的选择器照样能指到 #chat 里的消息，不能当成外壳作用域。 */
  '\\.clawd-(?:rail|user|pc-top-actions|welcome-|fake-mic)',
  '#top-bar\\b', '#top-settings-holder\\b',
  '#form_sheld\\b', '#send_form\\b', '#qr--bar\\b', '#nonQRFormItems\\b',
  '#leftSendForm\\b', '#rightSendForm\\b', '#send_textarea\\b',
  /* .welcomeRecent / .welcomePanel 是酒馆自己长在 #chat 里的欢迎区，
     属于对话区，不在这张表里。 */
  '\\.recentChatList\\b', '\\.recentChat\\b',
].join('|'));

function isChatContent(selector) {
  if (WELCOME_OWNED.test(selector)) return false;
  if (FRAME_SCOPED.test(selector)) return false;
  return CHAT_CONTENT.test(selector);
}

function isDrawerIconSubject(selector) {
  return /\.drawer-icon\b/.test(selectorSubject(selector));
}

function scopeSelector(selector) {
  const value = String(selector).trim();
  if (/html\[data-claude-mode=["']compat["']\]/.test(value)) return value;
  if (/^:root\b/.test(value)) return value.replace(/^:root/, 'html[data-claude-mode="compat"]');
  if (/^html\s+body/.test(value)) return value.replace(/^html\s+body/, 'html[data-claude-mode="compat"] body');
  if (/^html\b/.test(value)) return value.replace(/^html\b/, 'html[data-claude-mode="compat"]');
  if (/^body\b/.test(value)) return `html[data-claude-mode="compat"] ${value}`;
  return `html[data-claude-mode="compat"] body ${value}`;
}

function renderRule(node) {
  if (node.prelude?.type !== 'SelectorList') return '';
  const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
  const kept = selectors.filter(selector => !isChatContent(selector));
  if (!kept.length) return '';

  const rootOnly = kept.every(isRootLevel);
  const iconSlot = kept.some(isDrawerIconSubject);
  const declarations = node.block.children.toArray()
    .filter(child => child.type === 'Declaration')
    .filter(child => {
      const property = String(child.property).toLowerCase();
      if (property.startsWith('--')) return true;
      if (rootOnly) return ROOT_ALLOWED.has(property);
      if (iconSlot && SKIN_CHANNEL_PROPERTIES.has(property)) return false;
      return true;
    })
    .map(child => csstree.generate(child));
  if (!declarations.length) return '';
  return `${kept.map(scopeSelector).join(',\n')}{${declarations.join(';')}}`;
}

/* @keyframes 的选择器是 from/to/百分比，不能走 renderRule；整块原样搬。 */
function renderAtrule(node) {
  const name = String(node.name || '').toLowerCase();
  if (name === 'import' || name === 'charset') return '';
  if (name.endsWith('keyframes')) return csstree.generate(node);
  if (!node.block?.children) return '';
  const body = node.block.children.toArray().map(render).filter(Boolean).join('\n');
  if (!body) return '';
  const prelude = node.prelude ? ` ${csstree.generate(node.prelude)}` : '';
  return `@${node.name}${prelude}{${body}}`;
}

function render(node) {
  if (node.type === 'Rule') return renderRule(node);
  if (node.type === 'Atrule') return renderAtrule(node);
  return '';
}

/* 框架层里的重置规则是 all:revert-layer!important，同层里任何普通声明都会被它压掉，
   所以框架自己的声明必须一律 !important。两个例外：自定义属性（留给主题的换皮通道）
   和 @keyframes 内的声明（加了会被浏览器丢弃）。 */
function forceImportant(cssText) {
  const ast = csstree.parse(cssText);
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      if (node.property.startsWith('--')) return;
      if (this.atrule && /keyframes$/i.test(String(this.atrule.name))) return;
      if (RUNTIME_TOGGLED_PROPERTIES.has(String(node.property).toLowerCase())
        && keepsNativeToggle(this.rule)) return;
      node.important = true;
    },
  });
  return csstree.generate(ast);
}

function collectImports(sourceCss) {
  const imports = [];
  csstree.walk(csstree.parse(sourceCss), {
    visit: 'Atrule',
    enter(node) {
      if (String(node.name).toLowerCase() === 'import') imports.push(`@${csstree.generate(node)}`.replace(/^@@/, '@'));
    },
  });
  return imports;
}

function buildResetRule() {
  const owned = [
    ...RESET_ROOTS,
    ...RESET_SUBTREES.map(selector => `${selector} *${SUBTREE_EXCLUDE[selector] || ''}`),
  ];
  return [
    '/* R2 子树归零：撤销外部主题写在框架自有节点上的一切声明。',
    ' * 必须排在框架所有结构规则之前。永远不要加入 .drawer-content 的后代或 #chat 的后代。 */',
    `@media (min-width:701px){\n:where(html[data-claude-mode="compat"] body) :where(\n${owned.join(',\n')}\n){all:revert-layer!important}\n}`,
    '/* 欢迎态下框架接管 #chat 和 #form_sheld 这两个容器本身，但不碰任何消息后代。 */',
    '@media (min-width:701px){',
    ':where(html[data-claude-mode="compat"] body.clawd-welcome) :where(#chat,#form_sheld){all:revert-layer!important}',
    '}',
  ].join('\n');
}

function assertOutput(variant, cssText) {
  const ast = csstree.parse(cssText);

  const plain = [];
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      if (node.property.startsWith('--')) return;
      if (this.atrule && /keyframes$/i.test(String(this.atrule.name))) return;
      if (RUNTIME_TOGGLED_PROPERTIES.has(String(node.property).toLowerCase())
        && keepsNativeToggle(this.rule)) return;
      if (!node.important) plain.push(node.property);
    },
  });
  if (plain.length) {
    throw new Error(`compat-${variant} 断言1失败：存在会被 all:revert-layer!important 压掉的普通声明: ${[...new Set(plain)].join(', ')}`);
  }

  const badRevert = [];
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      if (node.property === 'all') return;
      const value = csstree.generate(node.value);
      if (/revert-layer/i.test(value)) badRevert.push(`${node.property}:${value}`);
    },
  });
  if (badRevert.length) {
    throw new Error(`compat-${variant} 断言2失败：出现非 all 的 revert-layer（放行只能靠不声明）: ${badRevert.join(', ')}`);
  }

  const iconViolations = [];
  const chatLeaks = [];
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node) {
      if (node.prelude?.type !== 'SelectorList') return;
      const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
      for (const selector of selectors) {
        if (isChatContent(selector)) chatLeaks.push(selector);
      }
      if (!selectors.some(isDrawerIconSubject)) return;
      for (const child of node.block.children.toArray()) {
        if (child.type === 'Declaration' && SKIN_CHANNEL_PROPERTIES.has(child.property)) {
          iconViolations.push(`${selectors.join(',')} { ${child.property} }`);
        }
      }
    },
  });
  if (iconViolations.length) {
    throw new Error(`compat-${variant} 断言3失败：.drawer-icon 上声明了换皮通道属性: ${iconViolations.join('; ')}`);
  }
  const realLeaks = chatLeaks.filter(selector => selector !== WELCOME_PLACEHOLDER_SELECTOR);
  if (realLeaks.length) {
    throw new Error(`compat-${variant} 断言4失败：对话区选择器漏进框架层: ${realLeaks.slice(0, 5).join(' | ')}`);
  }
}

function build(variant) {
  const sourcePath = path.join(root, 'styles', `${variant}-pc.css`);
  const outputPath = path.join(root, 'styles', `compat-${variant}.css`);
  const sourceCss = fs.readFileSync(sourcePath, 'utf8');
  const sourceAst = csstree.parse(sourceCss);

  const generated = sourceAst.children.toArray().map(render).filter(Boolean).join('\n');
  const base = fs.readFileSync(basePath, 'utf8').trim();
  const welcomeException = `@media (min-width:701px){\n${WELCOME_PLACEHOLDER_SELECTOR}{display:none!important}\n}`;

  const frameBody = [
    buildResetRule(),
    base,
    `/* 外壳区域，原样搬自 styles/${variant}-pc.css。 */`,
    /* 不能再往外面套 @media (min-width:701px)。源文件自己带 53 个 @media，
       套一层之后它们变成嵌套条件：里面的 (max-width:700px) 块和外层
       (min-width:701px) 永远互斥，规则等于被删。#send_form 的 display:flex
       正好只写在那个 max-width 块里，2.0.87 输入框按钮竖排就是这么来的。 */
    generated,
    '/* 唯一一条消息选择器例外：酒馆原生欢迎占位。 */',
    welcomeException,
  ].join('\n\n');

  const forced = forceImportant(frameBody);
  assertOutput(variant, forced);

  /* @import 必须排在所有规则之前，不能落在 @layer 块里面。 */
  const output = [
    '/* GENERATED by _dev/build-compat-css.js. Do not edit this file directly. */',
    ...collectImports(sourceCss),
    '@layer cw-frame {',
    forced,
    '}',
  ].join('\n\n').trimEnd() + '\n';

  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${path.relative(root, outputPath)} (${(Buffer.byteLength(output) / 1024).toFixed(0)} KB)`);
}

for (const variant of VARIANTS) build(variant);
