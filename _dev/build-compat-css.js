const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'styles', 'day-pc.css');
const outputPath = path.join(root, 'styles', 'compat.css');
const ast = csstree.parse(fs.readFileSync(sourcePath, 'utf8'));

function keepSelector(selector) {
  return /\.typing_indicator\b/.test(selector)
    || /(?:\.|body\.)clawd[-\w]*/i.test(selector)
    || /\.claude-(?:user-message-actions|swipe-(?:left|right)-proxy|reroll-button|generation-timer|code-copy|has-preset-reasoning)\b/i.test(selector)
    || /body\.claude-generation-active\b/i.test(selector)
    || /\[data-claude-(?:clawd|motion|decorations|gen-timer)(?:=|\])/i.test(selector);
}

function render(node) {
  if (node.type === 'Rule') {
    if (node.prelude?.type !== 'SelectorList') return '';
    const selectors = node.prelude.children.toArray()
      .map(selector => csstree.generate(selector))
      .filter(keepSelector);
    if (!selectors.length) return '';
    return `${selectors.join(',\n')}${csstree.generate(node.block)}`;
  }

  if (node.type !== 'Atrule') return '';
  const name = String(node.name || '').toLowerCase();
  if (name.endsWith('keyframes')) return csstree.generate(node);
  if (!node.block?.children) return '';
  const body = node.block.children.toArray().map(render).filter(Boolean).join('\n');
  if (!body) return '';
  const prelude = node.prelude ? ` ${csstree.generate(node.prelude)}` : '';
  return `@${node.name}${prelude}{${body}}`;
}

const variables = `/* Claude Web compatibility framework.
 * Native SillyTavern themes own color, typography, backgrounds and stock layout.
 * This file styles only Claude Web's own components and the Clawd typing anchor. */
:root{
  --cl-canvas:var(--SmartThemeBlurTintColor,rgba(20,20,20,.92));
  --cl-surface:var(--SmartThemeChatTintColor,var(--cl-canvas));
  --cl-soft:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 8%,transparent);
  --cl-soft-hover:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 13%,transparent);
  --cl-line:var(--SmartThemeBorderColor,color-mix(in srgb,currentColor 18%,transparent));
  --cl-line-strong:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 28%,transparent);
  --cl-ink:var(--SmartThemeBodyColor,currentColor);
  --cl-muted:var(--SmartThemeEmColor,var(--cl-ink));
  --cl-accent:var(--SmartThemeQuoteColor,var(--SmartThemeUnderlineColor,#d97757));
  --cl-accent-soft:color-mix(in srgb,var(--cl-accent) 16%,transparent);
  --cl-code:color-mix(in srgb,var(--cl-ink) 8%,transparent);
  --cl-code-ink:var(--cl-ink);
  --cl-sans:var(--mainFontFamily,system-ui,sans-serif);
  --cl-serif:var(--mainFontFamily,system-ui,sans-serif);
  --cl-body-weight:inherit;
  --cl-clawd-eye:#000;
  --cl-clawd-eye-row-a:#000;
  --cl-clawd-eye-row-b:var(--cl-accent);
  --cl-typing-float-animation:clawd-question-float 2.36s cubic-bezier(.37,0,.22,1) infinite;
  --cl-greeting-particle-animation:clawd-question-float 2.83s cubic-bezier(.37,0,.22,1) .41s infinite;
  --cw-text-body:var(--cl-ink);
  --cw-text-secondary:var(--cl-muted);
  --cw-text-muted:var(--cl-muted);
  --cw-text-faint:color-mix(in srgb,var(--cl-muted) 62%,transparent);
  --cw-mark:var(--cl-accent);
  --cw-hero:var(--cl-ink);
  --cw-surface-page:var(--cl-canvas);
  --cw-surface-raised:var(--cl-surface);
  --cw-surface-input:var(--cl-surface);
  --cw-surface-hover:var(--cl-soft-hover);
  --cw-rule-hairline:var(--cl-line);
  --cw-scrollbar:color-mix(in srgb,var(--cl-muted) 48%,transparent);
  --cw-scrollbar-hover:var(--cl-muted);
  --cw-shadow-floating:0 10px 28px color-mix(in srgb,#000 20%,transparent);
  --cw-radius-2:2px;
  --cw-radius-5:5px;
  --cw-radius-7:7px;
  --cw-radius-8:8px;
  --cw-radius-9:9px;
  --cw-radius-10:10px;
  --cw-radius-14:14px;
  --cw-radius-16:16px;
  --cw-radius-20:20px;
  --cw-radius-pill:999px;
  --cw-radius-circle:50%;
  --cw-fs-s:.86rem;
  --cw-lh-s:1.45;
  --cw-gut:12px;
  --cw-column:min(760px,100%);
  --cw-composer:min(760px,100%);
  --cw-c-list:240px;
  --cw-c-nav:68px;
  --cw-pb-top:0px;
}
`;

const body = ast.children.toArray().map(render).filter(Boolean).join('\n\n');
fs.writeFileSync(outputPath, `${variables}\n${body}\n`);
console.log(`Wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(body)} bytes of filtered CSS)`);
