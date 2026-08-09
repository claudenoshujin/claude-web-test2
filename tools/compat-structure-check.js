const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'styles', 'compat.css');
const fixturePath = path.join(root, '_dev', 'fixture.html');
const patchPath = path.join(root, '_dev', 'compat-structure-patch.css');
const runtimePath = path.join(root, 'index.js');
const css = fs.readFileSync(cssPath, 'utf8');
const fixture = fs.readFileSync(fixturePath, 'utf8');
const structurePatch = fs.readFileSync(patchPath, 'utf8');
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
  errors.push('compat.css must contain one top-level @layer cw-frame block');
}

const resetRules = rules.filter(rule => rule.declarations.some(declaration =>
  declaration.property === 'all' && declaration.value === 'revert-layer' && declaration.important));
if (resetRules.length !== 1) errors.push(`expected one owned-subtree reset rule, found ${resetRules.length}`);
const resetSelectors = resetRules.flatMap(rule => rule.selectors);
if (!resetSelectors.every(selector => selector.includes(':where('))) {
  errors.push('owned-subtree reset must use low-specificity :where()');
}
for (const forbidden of ['.drawer-content', '#chat']) {
  if (resetSelectors.some(selector => selector.includes(forbidden))) {
    errors.push(`owned-subtree reset must not include ${forbidden}`);
  }
}
for (const requiredOwned of [
  '.clawd-rail-brand', '.clawd-rail-recents', '.recentChat', '.clawd-user-face',
  '#top-settings-holder>.drawer>.drawer-toggle', '#send_form', '#qr--bar', '#nonQRFormItems',
  '#leftSendForm', '#rightSendForm', '#send_textarea',
  '.clawd-welcome-hero', '.clawd-welcome-shortcuts',
]) {
  if (!resetSelectors.some(selector => normalize(selector).includes(normalize(requiredOwned)))) {
    errors.push(`owned-subtree reset missing ${requiredOwned}`);
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
  ['.chatActions', 'position', 'absolute'],
  ['.chatName', 'white-space', 'nowrap'],
  ['.chatName', 'text-overflow', 'ellipsis'],
  ['.chatPreview', '-webkit-line-clamp', '2'],
  ['.chatMeta', 'display', 'none'],
  ['.chatDate', 'display', 'none'],
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
if (/(?:transform|filter|translate|scale|rotate)\s*:\s*none\s*!important|float\s*:\s*none\s*!important|position\s*:\s*static\s*!important/i.test(structurePatch)) {
  errors.push('compat-structure-patch.css still contains defensive property declarations');
}
for (const runtimeFragment of [
  "const LAYER_ORDER_ID = 'claude-layer-order'",
  "layerOrder.textContent = '@layer cw-frame, st-theme;'",
  'hostDocument.head.prepend(layerOrder)',
  '@layer st-theme {',
  'layer(st-theme)',
  "new hostWindow.MutationObserver(() =>",
  "backing.setAttribute('aria-hidden', 'true')",
]) {
  if (!runtime.includes(runtimeFragment)) errors.push(`runtime missing ${runtimeFragment}`);
}
for (const surfaceFragment of [
  '.clawd-surface-host>.clawd-surface-backing',
  'background-color:Canvas!important',
]) {
  if (!css.includes(surfaceFragment)) errors.push(`surface backing CSS missing ${surfaceFragment}`);
}
for (const fragment of ['id="qr--bar"', 'id="nonQRFormItems"', 'recentList.className = "recentChatList"', 'id="persona-management-button"']) {
  if (!fixture.includes(fragment)) errors.push(`fixture missing ${fragment}`);
}

if (errors.length) {
  console.error(errors.map(error => `FAIL ${error}`).join('\n'));
  process.exit(1);
}
console.log(`compat structure static checks passed (${rules.length} rules)`);
