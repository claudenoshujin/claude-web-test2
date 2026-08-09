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

const generated = sourceAst.children.toArray().map(render).filter(Boolean).join('\n');
const base = fs.readFileSync(basePath, 'utf8').trim();
const structurePatch = fs.readFileSync(patchPath, 'utf8').trim();
const welcomeException = `@media (min-width:701px){\n${WELCOME_PLACEHOLDER_SELECTOR}{display:none!important}\n}`;
const output = [
  '/* GENERATED by _dev/build-compat-css.js. Do not edit this file directly. */',
  base,
  '/* Structural declarations imported from the full desktop layout. */',
  `@media (min-width:701px){\n${generated}\n}`,
  '/* The sole message-selector exception: native welcome placeholders only. */',
  welcomeException,
  structurePatch,
].join('\n\n').trimEnd() + '\n';

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(output)} bytes)`);
