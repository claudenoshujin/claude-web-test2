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
      <div class="mes last_mes" is_user="false" mesid="1"><div class="mes_block">
        <div class="mes_text"><p>assistant answer</p></div>
        <div class="mes_buttons"></div>
      </div></div>
    </div>
    <div id="form_sheld"><form id="send_form"><textarea id="send_textarea"></textarea></form></div>
  </div>
</body></html>`, {
  url: 'https://example.test/',
  pretendToBeVisual: true,
});

const { window } = dom;
const runtimeEvents = new Map();
const emitRuntimeEvent = (type, ...args) => {
  for (const handler of runtimeEvents.get(type) || []) handler(...args);
};
const context = {
  chat: [
    { is_user: true, mes: 'quoted' },
    { is_user: false, mes: 'assistant answer', swipes: ['assistant answer'], swipe_id: 0 },
  ],
  characters: [], groups: [],
  powerUserSettings: {
    theme: 'Original',
    main_text_color: 'rgba(1,2,3,1)',
    quote_text_color: 'rgba(9,8,7,1)',
    animation_duration: 0,
  },
  saveSettingsDebounced() {},
  eventSource: {
    on(type, handler) {
      const handlers = runtimeEvents.get(type) || new Set();
      handlers.add(handler);
      runtimeEvents.set(type, handlers);
    },
    off(type, handler) { runtimeEvents.get(type)?.delete(handler); },
    removeListener(type, handler) { runtimeEvents.get(type)?.delete(handler); },
  },
  eventTypes: {
    GENERATION_STARTED: 'generation_started',
    GENERATION_ENDED: 'generation_ended',
    GENERATION_STOPPED: 'generation_stopped',
    GENERATION_FAILED: 'generation_failed',
  },
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
Object.defineProperty(window.navigator, 'userAgent', {
  configurable: true,
  value: 'Mozilla/5.0 (Linux; Android 14; CW_Android_14_Via) AppleWebKit/537.36',
});
const virtualKeyboard = { overlaysContent: false };
Object.defineProperty(window.navigator, 'virtualKeyboard', {
  configurable: true,
  value: virtualKeyboard,
});
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

const externalModal = window.document.createElement('div');
externalModal.className = 'sample-extension-modal-backdrop';
externalModal.style.cssText = 'position: fixed; inset: 0; display: none;';
externalModal.getBoundingClientRect = () => ({
  x: 0, y: 0, left: 0, top: 0,
  width: window.innerWidth, height: window.innerHeight,
  right: window.innerWidth, bottom: window.innerHeight,
});
window.document.body.append(externalModal);

window.localStorage.setItem('claude-web:decorations', 'off');
await import(`${pathToFileURL(path.join(root, 'index.js')).href}?runtime-test=2.0.146`);
await new Promise(resolve => window.setTimeout(resolve, 850));

const composerShell = window.document.getElementById('form_sheld');
const androidPanAnchor = window.document.querySelector('.clawd-android-keyboard-pan-anchor');
assert.equal(virtualKeyboard.overlaysContent, true, 'modern Android must enable VirtualKeyboard overlay mode');
assert.ok(window.document.body.classList.contains('clawd-virtual-keyboard-overlay'));
assert.equal(androidPanAnchor, null, 'overlay mode must not leave the adjustPan fallback anchor mounted');
composerShell.style.setProperty('--cl-mobile-composer-translate-y', '-272px');
window.document.getElementById('send_textarea').focus();
window.dispatchEvent(new window.Event('resize'));
await new Promise(resolve => window.setTimeout(resolve, 50));
const refreshedAndroidPanAnchor = window.document.querySelector('.clawd-android-keyboard-pan-anchor');
assert.equal(refreshedAndroidPanAnchor, null, 'focusin must not re-enable adjustPan while overlay mode owns keyboard geometry');
assert.equal(
  composerShell.style.getPropertyValue('--cl-mobile-composer-translate-y'),
  '',
  'native Android keyboard layout must clear a stale composer translation',
);

assert.equal(window.document.documentElement.dataset.claudeQuoteBodyColor, 'on');
assert.equal(window.document.querySelector('.third-party-action')?.isConnected, true, 'third-party action must survive refresh');
const interactionStyle = window.document.getElementById('claude-clawd-interaction-style')?.textContent || '';
const composerClawd = window.document.querySelector('#send_form > .clawd-composer-clawd');
assert.ok(composerClawd, 'the migrated Clawd must mount directly inside #send_form');
assert.equal(window.document.querySelectorAll('.clawd-composer-clawd').length, 1, 'composer Clawd must be a singleton');
assert.equal(window.document.querySelector('#chat .clawd-message-signoff-clawd'), null, 'no Clawd may remain at the end of a message');
assert.equal(window.document.querySelectorAll('button.clawd-signoff-button').length, 1, 'the whole page must contain exactly one Clawd button');
assert.equal(window.document.querySelector('.clawd-mobile-clawd-button'), null, 'mobile chrome must not own a third Clawd');
assert.equal(window.document.documentElement.dataset.claudeDecorations, 'off', 'runtime fixture must cover decorations-off behavior');
assert.notEqual(window.getComputedStyle(composerClawd).display, 'none', 'turning off particles and bubbles must not hide Clawd');
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'B', 'B owns the idle frame');
assert.equal(composerClawd.dataset.clawdB, window.__claudeClawdInteraction.clawdState().B || '', 'the migrated Clawd must consume the shared B track');
assert.doesNotMatch(interactionStyle, /#send_form::after \{[\s\S]{0,200}content: none !important;/, 'the composer decorative Clawd must stay alive');
assert.match(interactionStyle, /#chat \.typing_indicator::before,[\s\S]*display: none !important;/, 'typing indicator must not draw another Clawd');
assert.match(interactionStyle, /safe-area-inset-left/, 'the left anchor must include the phone safe area');

emitRuntimeEvent('generation_started');
/* think 至少 900ms，再由 200ms runtime tick 结算；1250ms 覆盖最坏 tick 相位。 */
await new Promise(resolve => window.setTimeout(resolve, 1250));
assert.equal(window.__claudeClawdInteraction.clawdState().A, 'stream', 'generation must advance from think to stream');
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'A', 'A owns the frame while generating');
assert.equal(window.document.querySelector('#chat .clawd-message-signoff-clawd'), null, 'no Clawd may appear in the message while generating either');
composerClawd.click();
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'C', 'touch must temporarily outrank generation');
/* C 轨是 2.0.135 的 720ms，运行时 tick 200ms，最坏 920ms 才清空。
   旧值 850ms 是按 2.0.139 那条 560ms 的 composer 分支定的。 */
await new Promise(resolve => window.setTimeout(resolve, 1100));
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'A', 'A must resume after the touch track clears');
emitRuntimeEvent('generation_ended');
assert.equal(window.__claudeClawdInteraction.clawdState().A, 'done', 'generation must settle once into done');
emitRuntimeEvent('generation_stopped');
assert.equal(window.__claudeClawdInteraction.clawdState().A, 'done', 'duplicate terminal events must not settle the same round twice');
await new Promise(resolve => window.setTimeout(resolve, 1800));
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'B', 'B must resume after done clears');
assert.equal(window.document.querySelector('#chat .clawd-message-signoff-clawd'), null, 'settling a reply must not re-create a message-end Clawd');
assert.equal(window.document.querySelectorAll('button.clawd-signoff-button').length, 1, 'still exactly one Clawd after a full generation round');
composerClawd.click();
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'C', 'touching the migrated Clawd must update the shared C track');
await new Promise(resolve => window.setTimeout(resolve, 1100));
assert.equal(window.__claudeClawdInteraction.clawdState().owner, 'B', 'B must resume after the shared touch track clears');
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
assert.match(interactionStyle, /background-image: none !important;/, 'drag handle must not paint a second glyph behind the real bars');
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
assert.equal(window.getComputedStyle(window.document.querySelector('#native-tt-prompt-row > .clawd-prompt-drag-handle > .clawd-prompt-drag-glyph > span')).boxShadow, 'none', 'TT drag bars must not inherit a ghost shadow');

externalModal.style.display = 'grid';
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.ok(window.document.body.classList.contains('clawd-external-modal-open'), 'visible third-party full-screen modal must lower the Claude rail');
assert.equal(window.document.querySelector('#top-settings-holder').style.getPropertyValue('z-index'), '1', 'modal must lower the rail at node priority');
assert.equal(window.document.querySelector('#top-bar').style.getPropertyValue('z-index'), '1', 'modal must also lower the full-height rail shell');
externalModal.style.display = 'none';
await new Promise(resolve => window.setTimeout(resolve, 40));
assert.ok(!window.document.body.classList.contains('clawd-external-modal-open'), 'closing the third-party modal must restore the Claude rail');
assert.equal(window.document.querySelector('#top-settings-holder').style.getPropertyValue('z-index'), '', 'closing the modal must restore the original inline rail layer');
assert.equal(window.document.querySelector('#top-bar').style.getPropertyValue('z-index'), '', 'closing the modal must restore the full-height rail shell');

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
assert.equal(virtualKeyboard.overlaysContent, false, 'pagehide must restore the browser VirtualKeyboard setting');
dom.window.close();
console.log('✓ Claude Web 2.0.146 runtime DOM regressions passed');
