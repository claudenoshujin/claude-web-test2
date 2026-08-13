import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <select id="themes"><option value="Original">Original</option></select>
  <div id="extensions_settings"></div>
  <div id="completion_prompt_manager"><ul id="completion_prompt_manager_list">
    <li class="completion_prompt_manager_prompt" id="tt-prompt-row"><span class="completion_prompt_manager_prompt_name">TT row</span></li>
    <li class="completion_prompt_manager_prompt" id="st-prompt-row"><span class="drag-handle">☰</span><span class="completion_prompt_manager_prompt_name">ST row</span></li>
  </ul></div>
  <div id="top-bar"><div id="top-settings-holder"></div></div>
  <div id="sheld">
    <div id="chat">
      <div class="mes" is_user="true" mesid="0"><div class="mes_block">
        <div class="mes_text"><q>quoted</q></div>
        <div class="mes_buttons">
          <div class="mes_button extraMesButtonsHint"></div>
          <div class="extraMesButtons"><div class="mes_button overflow-action"></div></div>
          <div class="mes_button mes_edit"></div>
          <div class="mes_button third-party-action"></div>
          <div class="mes_button displayNone hidden-action"></div>
        </div>
        <div class="claude-user-message-actions"></div>
      </div></div>
    </div>
    <div id="form_sheld"><form id="send_form"><textarea id="send_textarea"></textarea></form></div>
  </div>
</body></html>`, {
  url: 'https://example.test/',
  pretendToBeVisual: true,
});

const { window } = dom;
const context = {
  chat: [], characters: [], groups: [],
  powerUserSettings: {
    theme: 'Original',
    main_text_color: 'rgba(1,2,3,1)',
    quote_text_color: 'rgba(9,8,7,1)',
    animation_duration: 0,
  },
  saveSettingsDebounced() {},
  eventSource: { on() {}, off() {}, removeListener() {} },
  eventTypes: {},
};

window.SillyTavern = { ...context, getContext: () => context };
window.toastr = { info() {}, warning() {}, error() {} };
window.fetch = async input => ({
  ok: true,
  json: async () => String(input).includes('csrf-token') ? { token: 'runtime-test' } : [],
});
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'visualViewport', {
  configurable: true,
  value: { width: 390, height: 780, offsetTop: 0, addEventListener() {}, removeEventListener() {} },
});
window.$ = value => {
  if (typeof value === 'function') { value(); return undefined; }
  return {
    on(name, handler) { value?.addEventListener?.(name, handler); return this; },
    prop(name, next) { if (value) value[name] = next; return this; },
    val(next) { if (value && next !== undefined) value.value = next; return next === undefined ? value?.value : this; },
    trigger() { return this; },
  };
};

Object.assign(globalThis, {
  window,
  document: window.document,
  location: window.location,
  history: window.history,
  MutationObserver: window.MutationObserver,
  HTMLElement: window.HTMLElement,
  HTMLIFrameElement: window.HTMLIFrameElement,
  Element: window.Element,
  Node: window.Node,
  getComputedStyle: window.getComputedStyle.bind(window),
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  $: window.$,
  SillyTavern: window.SillyTavern,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

const coreDeleteModeStyle = window.document.createElement('style');
coreDeleteModeStyle.textContent = 'body.documentstyle #chat .last_mes:has(> .del_checkbox[style*="display: block"]) .mes_text { margin-left: 0; }';
window.document.head.append(coreDeleteModeStyle);
Object.defineProperty(coreDeleteModeStyle.sheet, 'href', { configurable: true, value: 'https://example.test/css/toggle-dependent.css' });
const pluginLockStyle = window.document.createElement('style');
pluginLockStyle.textContent = '.del_checkbox[style="display: block"] ~ .immersive-message { display: block; }';
window.document.head.append(pluginLockStyle);
Object.defineProperty(pluginLockStyle.sheet, 'href', { configurable: true, value: 'https://example.test/scripts/extensions/third-party/immersive/user.css' });

await import(`${pathToFileURL(path.join(root, 'index.js')).href}?runtime-test=2.0.130`);
await new Promise(resolve => window.setTimeout(resolve, 650));

assert.equal(window.document.documentElement.dataset.claudeQuoteBodyColor, 'on');
assert.equal(window.document.querySelector('.third-party-action')?.isConnected, true, 'third-party action must survive refresh');
const interactionStyle = window.document.getElementById('claude-clawd-interaction-style')?.textContent || '';
assert.match(interactionStyle, /\.extraMesButtons \{\s*display: none !important;/, 'overflow actions must start folded');
assert.match(interactionStyle, /\.extraMesButtons\.visible \{\s*display: flex !important;/, 'native ellipsis expansion must remain available');
assert.match(interactionStyle, /> \.extraMesButtonsHint,[\s\S]*\.mes\[is_user="false"\][\s\S]*> \.mes_edit \{\s*display: inline-flex !important;/, 'ellipsis and assistant native edit action must be visible');
assert.doesNotMatch(interactionStyle, /#chat > \.mes\[is_user="true"\] \.mes_buttons \{\s*display: none !important;/, 'user action row must remain available');
assert.match(interactionStyle, /grid-template-columns: 26px minmax\(0,1fr\)/, 'Prompt Manager icon and text need separate columns');
const userEditProxy = window.document.querySelector('.claude-user-message-actions .claude-user-message-edit');
assert.ok(userEditProxy, 'user message needs a visible edit proxy outside the collapsed native header');
assert.equal(window.document.querySelector('.claude-user-message-actions .claude-user-message-delete'), null, 'user action row must not restore the unsafe quick-delete button');
assert.ok(window.document.getElementById('claude-web-quote-body-color'), 'quote toggle must mount in extension settings');
assert.equal(coreDeleteModeStyle.sheet.cssRules.length, 0, 'known ST core delete-mode rule should still be neutralized');
assert.equal(pluginLockStyle.sheet.cssRules.length, 1, 'third-party [style] selectors must survive cleanup');
assert.match(interactionStyle, /\.extraMesButtons\.visible[\s\S]*flex-wrap: wrap !important;/, 'expanded actions must use a wrapping panel');
assert.match(interactionStyle, /background-image:[\s\S]*linear-gradient\(currentColor, currentColor\)[\s\S]*background-size: 16px 2px, 16px 2px, 16px 2px !important;/, 'drag handle glyph must be rendered independently of TT text handling');
assert.equal(window.document.querySelectorAll('#tt-prompt-row > .drag-handle').length, 1, 'TT row must receive one real drag handle');
assert.equal(window.document.querySelectorAll('#st-prompt-row > .drag-handle').length, 1, 'ST native drag handle must not be duplicated');
assert.ok(window.document.querySelector('#tt-prompt-row > .clawd-prompt-drag-handle'), 'injected handle needs a cleanup marker');
assert.equal(window.document.querySelectorAll('#tt-prompt-row > .clawd-prompt-drag-handle > .clawd-prompt-drag-glyph > span').length, 3, 'TT handle needs three real visible bar elements');
const lateTtRow = window.document.createElement('li');
lateTtRow.id = 'late-tt-prompt-row';
lateTtRow.className = 'completion_prompt_manager_prompt';
lateTtRow.innerHTML = '<span class="completion_prompt_manager_prompt_name">Late TT row</span>';
window.document.querySelector('#completion_prompt_manager_list').append(lateTtRow);
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.equal(window.document.querySelectorAll('#late-tt-prompt-row > .drag-handle').length, 1, 'TT rows created after panel rebuild need the lightweight observer repair');
assert.equal(window.document.querySelectorAll('#late-tt-prompt-row > .clawd-prompt-drag-handle > .clawd-prompt-drag-glyph > span').length, 3, 'late TT rows need the complete drag glyph');
window.__TAURITAVERN__ = true;
const nativeTtRow = window.document.createElement('li');
nativeTtRow.id = 'native-tt-prompt-row';
nativeTtRow.className = 'completion_prompt_manager_prompt';
nativeTtRow.innerHTML = '<span class="drag-handle"></span><span class="completion_prompt_manager_prompt_name">Native TT row</span>';
window.document.querySelector('#completion_prompt_manager_list').append(nativeTtRow);
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.ok(window.document.querySelector('#native-tt-prompt-row > .drag-handle.clawd-prompt-drag-handle'), 'TT native empty handle must be reused and marked');
assert.equal(window.document.querySelectorAll('#native-tt-prompt-row > .clawd-prompt-drag-handle > .clawd-prompt-drag-glyph > span').length, 3, 'TT native empty handle needs three visible bars');

const themeStyle = window.document.getElementById('claude-integrated-theme-live-style');
assert.ok(themeStyle, 'full theme stylesheet must be installed');
const manager = window.document.createElement('div');
manager.id = 'charManagerModal';
manager.style.display = 'block';
window.document.body.append(manager);
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.equal(themeStyle.getAttribute('media'), 'not all', 'Character Manager must suspend the theme stylesheet');

manager.remove();
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.notEqual(themeStyle.getAttribute('media'), 'not all', 'closing Character Manager must restore the theme stylesheet');

assert.notEqual(context.powerUserSettings.theme, 'Original', 'full mode must apply the Claude theme during the session');
const cachedPageHide = new window.Event('pagehide');
Object.defineProperty(cachedPageHide, 'persisted', { value: true });
window.dispatchEvent(cachedPageHide);
assert.notEqual(context.powerUserSettings.theme, 'Original', 'bfcache pagehide must keep the live theme intact');
const cachedPageShow = new window.Event('pageshow');
Object.defineProperty(cachedPageShow, 'persisted', { value: true });
window.dispatchEvent(cachedPageShow);
window.dispatchEvent(new window.Event('pagehide'));
await new Promise(resolve => window.setTimeout(resolve, 20));
assert.equal(context.powerUserSettings.theme, 'Original', 'extension pagehide must restore the previous ST theme');
assert.equal(window.document.getElementById('claude-integrated-theme-live-style'), null, 'pagehide must remove the live theme stylesheet');
dom.window.close();
console.log('✓ Claude Web 2.0.130 runtime DOM regressions passed');
