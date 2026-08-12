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

await import(`${pathToFileURL(path.join(root, 'index.js')).href}?runtime-test=2.0.119`);
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
console.log('✓ Claude Web 2.0.119 runtime DOM regressions passed');
