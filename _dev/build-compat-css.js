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
 * 输出四份：
 *   桌面 styles/compat-day.css / compat-night.css        —— 整个外壳归框架
 *   手机 styles/compat-mobile-day.css / -night.css       —— 只接管输入区和欢迎页
 *
 * 手机端为什么只接管两块：手机版本来就没有常驻侧栏，抽屉和顶栏都是酒馆自己的，
 * 框架去接管它们既没有对应的 Claude 形态，也会跟美化的手机适配正面对撞。
 * 输入框和欢迎页是「Claude 外壳」在手机上唯一成立的部分。
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
/* 酒馆自己的变量，兼容模式下归主题。
   在 :root 上覆盖它们等于隔着变量去改对话区：--avatar-base-* 会改消息头像，
   --SmartTheme* 会改页面底色和正文色。框架要用自己的令牌（--cw-* / --cl-*），
   不许改酒馆的。作用域在外壳容器里的同名声明不受这条限制。 */
const HOST_OWNED_VAR = /^--(?:SmartTheme|main|avatar|font|blur|topbar|top-bar)/i;

const ROOT_ALLOWED = new Set([
  'interpolate-size', 'width', 'max-width', 'min-width',
  'overflow-x', 'overscroll-behavior-x', 'overscroll-behavior',
]);

/* #chat / #sheld 是对话区的容器：框架只管它们的几何（位置、尺寸、留给侧栏的
   内边距），上色归主题。实测雨中曲的「黄卡片浮在白底上」就是这里来的 ——
   酒馆自己有 #chat{background:var(--SmartThemeChatTintColor)}（主题的黄），
   被我们搬过来的 #chat{background:transparent} 顶掉了。 */
const CONTAINER_ONLY_SUBJECT = /^#(?:chat|sheld)$/;
const CONTAINER_PAINT = /^(?:background|backdrop-filter|-webkit-backdrop-filter|box-shadow|border|outline|color|filter|opacity)(?:-|$)/;

/* 换皮插槽：主题写了图标就用主题的，没写就让 Font Awesome 的字形自然显示。
 *
 * 2.0.103 补了三类，起因是兼容模式下所有侧栏图标都变成实心方块：
 *
 *   1. `mask` / `-webkit-mask` 两个简写。day-*.css 里 .drawer-icon::before 用的是
 *      简写，只列长写会整条漏掉。
 *   2. `background` / `background-color`。这是黑方块的直接原因 ——
 *      day-mobile.css 里每个图标都是「底色铺满 24px 盒子 + 蒙版抠出形状」：
 *        background-color:var(--cl-rail-icon,currentColor);
 *        mask-image:url(../icons/01-presets.svg);
 *      生成器把 mask-image 丢进换皮通道、把 background-color 留下了，
 *      于是镂空板没了、墨还在，整块糊死。
 *
 * 关键认识：`.drawer-icon` 这个元素本身是带蒙版的，所以它上面的**任何** background
 * 都是被抠过的图案，没有一条是「盒子的悬停高亮」。`:hover{background:var(--cw-surface-hover)}`
 * 和 `.openIcon{background-color:var(--cl-accent)}` 都属于「图标变色」，一样归主题。
 * 框架在这个插槽上只锁盒子（位置、尺寸、background-position/size/repeat 这些排布属性），
 * 一滴墨都不许下。
 */
const SKIN_CHANNEL_PROPERTIES = new Set([
  'background-image', 'mask-image', '-webkit-mask-image', 'content', 'color',
  'mask', '-webkit-mask',
  'background', 'background-color',
]);

/* 2.0.104：图案的**排布**也不能从源文件搬。
 *
 * day-*.css 里图标是这么摆的：`.drawer-icon` 是 inset:0 的整行宽盒子、padding-left:11px，
 * 于是 `background-position:11px center` 正好落在行内缩进上。
 * 但兼容模式下 compat-framework-base.css 把插槽改成了 24×24、left:8px、overflow:hidden ——
 * 11px 起画一张 22px 宽的图，右边界到 33px，盒子只有 24px，看得见的只剩六成。
 * （实测雨中曲 / 狸猫：bg-pos 11px 50%，width 24px，left 8px，图标只有一半。）
 *
 * 而且 base 改不动它：搬过来那条带 `:is(#ai-config-button,…)` 一串 id，权重压过 base。
 * 所以坐标系归谁定，就由谁全包：兼容模式下插槽是 base 定的，排布也由 base 写
 * （center / no-repeat / contain），源文件那套一律不搬。
 *
 * 这一组只在 renderGroup 里丢，不进 SKIN_CHANNEL_PROPERTIES ——
 * 否则 base 自己声明的 background-position:center 会被生成期断言 3 判成违规。 */
const ICON_BOX_LAYOUT_PROPERTIES = new Set([
  'background-position', 'background-position-x', 'background-position-y',
  'background-size', 'background-repeat', 'background-origin', 'background-clip',
  'mask-position', 'mask-size', 'mask-repeat', 'mask-origin', 'mask-clip',
  '-webkit-mask-position', '-webkit-mask-size', '-webkit-mask-repeat',
  '-webkit-mask-origin', '-webkit-mask-clip',
]);

/* `.drawer-icon::before` 上的 display 是「关掉字形」的开关，属于换皮抑制。
 *
 * 完整模式下框架自己用蒙版在元素上画图标，所以要把 Font Awesome 的字形关掉，
 * `::before{display:none}` 是对的。兼容模式下元素上的图案已经归主题了，再把字形
 * 关掉就等于连最后的退路一起砍掉 —— 实测天使爱、草木青时完全没有图标，就是这条。
 *
 * 放开之后两类主题各自正确，不需要框架判断：
 *   · 用图片画图标的（狸猫、雨中曲）自己把 content 清成了空串，字形不会冒出来
 *   · 用字形的（天使爱、草木青时）content 里有字形，正常显示
 *
 * 只对 ::before 生效。元素本身的 display 不能碰 ——
 * `#persona-management-button>.drawer-toggle>.drawer-icon{display:none}` 是有意隐藏
 * 某个抽屉的图标，丢了会让它冒出来。 */
const ICON_GLYPH_SUPPRESSION_PROPERTIES = new Set(['display']);

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
/* 侧栏 Recents 那一行里的 .chatName / .chatPreview / .chatMeta / .chatDate /
   .chatActions / .avatar 也是框架自己 createElement 出来的（index.js 的 buildRecentRow），
   只是沿用了酒馆的类名。它们必须算框架自有节点，否则 display 不强制，
   主题一写就赢 —— 2.0.96 侧栏 Recents 里冒出「第 XIV 幕 · 27 句」和整段预览文字
   叠在一起，就是 .chatMeta 的 display:none 没带 !important。 */
const FRAME_OWNED_SUBJECT = /\.clawd-[\w-]+|\.recentChatList\b|\.recentChat\b|\.recentChatInfo\b|\.chat(?:Name|NameContainer|Preview|Meta|Date|Actions)\b|\.avatar\b|#top-bar\b|#top-settings-holder\b|#form_sheld\b|#send_form\b|#qr--bar\b|#nonQRFormItems\b|#leftSendForm\b|#rightSendForm\b|#send_textarea\b|#sheld\b|#chat\b|\.drawer-content\b|\.drawer-toggle\b/;
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

/* 2.0.99：手机和桌面用同一张区域表。
   2.0.98 这里有一张 MOBILE_OWNED 白名单，手机端只放行输入区和欢迎页，
   顶栏和抽屉交还给酒馆和美化。真机结果是两边都没人管：酒馆原生顶栏被挤成
   一条 8px 竖排小字，欢迎页连输入框都没有。现在这张白名单没了，
   两个断点唯一的差别只剩源文件（day-pc.css vs day-mobile.css）。 */
let LAYOUT = 'pc';

function isOutsideLayoutRegion() {
  return false;
}

function shellScope() {
  return ':is(#top-bar,#top-settings-holder,#form_sheld)';
}

function isChatContent(selector) {
  if (WELCOME_OWNED.test(selector)) return false;
  if (FRAME_SCOPED.test(selector)) return false;
  return CHAT_CONTENT.test(selector);
}

function isDrawerIconSubject(selector) {
  return /\.drawer-icon\b/.test(selectorSubject(selector));
}

/* 主语是 .drawer-icon 的 ::before（换皮插槽里画字形的那一层）。 */
function isDrawerIconPseudoSubject(selector) {
  const subject = selectorSubject(selector);
  return /\.drawer-icon\b/.test(subject) && /::?before\b/.test(subject);
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

/* 只丢「明确提到消息」的选择器是不够的。
 * day-pc.css 里有大量不带任何容器前缀的排版规则（h1 / p / table / code /
 * :is(small,.chatDate) 这类），它们本来就是写给消息正文看的。搬进兼容模式之后
 * 照样命中 #chat 里的内容，于是雨中曲那种重排版的美化被压得七零八落。
 *
 * 所以判据反过来：一条选择器必须**证明自己在外壳里**才发出去。
 * 证据是它至少带一个 id，或者带一个外壳专有的 class。纯元素/伪类选择器
 * 一律丢弃 —— 那是正文的地盘。 */
const SHELL_ANCHOR = /#[\w-]+|\.clawd-[\w-]+|\.recentChat(?:List)?\b|\.drawer(?:-[\w-]+)?\b/;

function isShellAnchored(selector) {
  return isRootLevel(selector) || SHELL_ANCHOR.test(selector);
}

/* 没有外壳锚点的选择器不是直接丢掉，而是给它套一层外壳作用域。
   丢掉会连抽屉面板里的排版一起丢（面板里全是原生控件，很多规则写的是
   纯元素选择器）；套一层之后它既进不了 #chat，又还能管面板内部。 */

function anchorSelector(selector) {
  const value = String(selector).trim();
  const head = /^((?::root|html)(?:\[[^\]]*\])*(?:\s+body)?|body)(?:\s+|$)/.exec(value);
  const prefix = head ? `${head[1]} ` : '';
  const rest = head ? value.slice(head[0].length).trim() : value;
  if (!rest) return [value];
  /* 两条：外壳容器的后代，以及外壳容器自己。
     只写后代的话，像 `*{transition:...}` 这种通用规则管不到 #form_sheld 本身。 */
  const scope = shellScope();
  return [`${prefix}${scope} ${rest}`, `${prefix}${scope}:is(${rest})`];
}

function renderRule(node) {
  if (node.prelude?.type !== 'SelectorList') return '';
  const selectors = node.prelude.children.toArray().map(selector => csstree.generate(selector));
  const kept = selectors
    .filter(selector => !isChatContent(selector) && !isOutsideLayoutRegion(selector))
    .flatMap(selector => (isShellAnchored(selector) ? [selector] : anchorSelector(selector)));
  if (!kept.length) return '';

  /* 一条规则里可能既有 #chat 又有别的主语（day-pc.css 里 `#sheld,#chat,.foo{...}`
     这种写法很多）。整条按「是不是容器」判断会一刀切错，所以按主语拆成两组，
     各自套各自的声明过滤。 */
  const containerSelectors = kept.filter(selector => CONTAINER_ONLY_SUBJECT.test(selectorSubject(selector)));
  const otherSelectors = kept.filter(selector => !CONTAINER_ONLY_SUBJECT.test(selectorSubject(selector)));
  if (containerSelectors.length && otherSelectors.length) {
    return [
      renderGroup(node, containerSelectors, true),
      renderGroup(node, otherSelectors, false),
    ].filter(Boolean).join('\n');
  }
  return renderGroup(node, kept, containerSelectors.length > 0);
}

function renderGroup(node, kept, containerOnly) {
  if (!kept.length) return '';
  const rootOnly = kept.every(isRootLevel);
  const iconSlot = kept.some(isDrawerIconSubject);
  const iconGlyphLayer = kept.some(isDrawerIconPseudoSubject);
  const declarations = node.block.children.toArray()
    .filter(child => child.type === 'Declaration')
    .filter(child => {
      const property = String(child.property).toLowerCase();
      if (property.startsWith('--')) return !(rootOnly && HOST_OWNED_VAR.test(property));
      if (rootOnly) return ROOT_ALLOWED.has(property);
      if (containerOnly && CONTAINER_PAINT.test(property)) return false;
      if (iconSlot && SKIN_CHANNEL_PROPERTIES.has(property)) return false;
      if (iconSlot && ICON_BOX_LAYOUT_PROPERTIES.has(property)) return false;
      if (iconGlyphLayer && ICON_GLYPH_SUPPRESSION_PROPERTIES.has(property)) return false;
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
  /* 2.0.99：归零范围两端一致。它本来就只覆盖框架自己 createElement 出来的节点，
     跟断点无关 —— 手机端一样会建侧栏 Recents 和欢迎页。 */
  const roots = RESET_ROOTS;
  const subtrees = RESET_SUBTREES;
  const media = LAYOUT === 'mobile' ? '@media (max-width:700px)' : '@media (min-width:701px)';
  const owned = [
    ...roots,
    ...subtrees.map(selector => `${selector} *${SUBTREE_EXCLUDE[selector] || ''}`),
  ];
  return [
    '/* R2 子树归零：撤销外部主题写在框架自有节点上的一切声明。',
    ' * 必须排在框架所有结构规则之前。永远不要加入 .drawer-content 的后代或 #chat 的后代。 */',
    `${media}{\n:where(html[data-claude-mode="compat"] body) :where(\n${owned.join(',\n')}\n){all:revert-layer!important}\n}`,
    '/* 欢迎态下框架接管 #chat 和 #form_sheld 这两个容器本身，但不碰任何消息后代。 */',
    `${media}{`,
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

function build(variant, layout) {
  LAYOUT = layout;
  const sourcePath = path.join(root, 'styles', `${variant}-${layout}.css`);
  const outputPath = path.join(root, 'styles',
    layout === 'mobile' ? `compat-mobile-${variant}.css` : `compat-${variant}.css`);
  const sourceCss = fs.readFileSync(sourcePath, 'utf8');
  const sourceAst = csstree.parse(sourceCss);

  const generated = sourceAst.children.toArray().map(render).filter(Boolean).join('\n');
  const welcomeMedia = layout === 'mobile' ? '@media (max-width:700px)' : '@media (min-width:701px)';
  /* 2.0.99：补充层两端都要。里面两块（侧栏条目锁竖排、图标插槽锁盒子）针对的是
     「主题改了、而 <variant>-*.css 没声明」这类洞，手机端只会更多不会更少。
     文件本身不带 @media，在这里按断点包一层。 */
  const baseCss = fs.readFileSync(basePath, 'utf8').trim();
  const base = baseCss ? `${welcomeMedia}{\n${baseCss}\n}` : '';
  const welcomeException = `${welcomeMedia}{\n${WELCOME_PLACEHOLDER_SELECTOR}{display:none!important}\n}`;

  const frameBody = [
    buildResetRule(),
    base,
    `/* 外壳区域，原样搬自 styles/${variant}-${layout}.css。 */`,
    /* 不能再往外面套 @media (min-width:701px)。源文件自己带 53 个 @media，
       套一层之后它们变成嵌套条件：里面的 (max-width:700px) 块和外层
       (min-width:701px) 永远互斥，规则等于被删。#send_form 的 display:flex
       正好只写在那个 max-width 块里，2.0.87 输入框按钮竖排就是这么来的。 */
    generated,
    '/* 唯一一条消息选择器例外：酒馆原生欢迎占位。 */',
    welcomeException,
  ].join('\n\n');

  const forced = forceImportant(frameBody);
  assertOutput(`${variant}-${layout}`, forced);

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

function main() {
  for (const variant of VARIANTS) {
    build(variant, 'pc');
    build(variant, 'mobile');
  }
}

/* consistency-check 直接复用这份名单，避免两边再各维护一份文本。
   require 本模块时只读导出；命令行执行时的生成行为保持不变。 */
module.exports = { SKIN_CHANNEL_PROPERTIES, main };

if (require.main === module) main();
