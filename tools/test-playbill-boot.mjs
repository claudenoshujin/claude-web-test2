/* Playbill 启动回归：刷新页面、不碰设置面板，剧场结构必须自己建出来。

   为什么单开一个文件而不是并进 test-2.0.118-runtime.mjs：
   这个检查要在 import index.js **之前**就把 skin 写成 playbill —— 模块求值时
   就要读它来决定首帧的 data-claude-skin。那个文件是按 classic 起的，
   在同一个进程里再 import 一次会把它后面的断言全打乱。
   代价是 DOM 骨架抄了一份，改那边要想着这边。

   这个文件挡的是两个已经发生过的错：
     1. watchSession() 曾经只有设置面板「结构」下拉的 change 会调，
        刷新页面时整套自建 DOM 一个都不建（2026-08-05 真机诊断）。
     2. stampMessages 在 b32f3a1 被删掉但两处调用留着，refreshTheatre
        第二句就 ReferenceError —— node --check 查不出来，只有真跑才会响。

   ⚠ 和其它 jsdom 测试一样：必须在本机磁盘上跑，网络盘（E:）上 node 解析
   node_modules 会挂住，表现是没有任何输出也不报错。
*/

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
  <div id="top-bar"><div id="top-settings-holder"><div id="ai-config-button"><div class="drawer-toggle"></div></div><div id="sys-settings-button"><div class="drawer-toggle"></div></div><div id="rightNavHolder"><div class="drawer-toggle"></div></div><div id="persona-management-button"><div class="drawer-toggle"></div></div><div id="user-settings-button"><div class="drawer-toggle"></div></div><div id="advanced-formatting-button"><div class="drawer-toggle"></div></div><div id="WI-SP-button"><div class="drawer-toggle"></div></div><div id="backgrounds-button"><div class="drawer-toggle"></div></div><div id="extensions-settings-button"><div class="drawer-toggle"></div></div></div></div>
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


/* ---- Playbill 启动验证（2026-08-24 新增，不属于原回归） ---- */
window.localStorage.setItem('claude-web:decorations', 'off');
window.localStorage.setItem('claude-web:skin', 'playbill');
window.localStorage.setItem('claude-web:structure', 'linear');
window.localStorage.setItem('claude-web:layout', 'pc');

let thrown = null;
window.addEventListener('error', e => { thrown = e.error || e.message; });
const origWarn = console.warn;
const warns = [];
console.warn = (...a) => { warns.push(a.map(String).join(' ')); origWarn(...a); };

await import(`${pathToFileURL(path.join(root, 'index.js')).href}?playbill-boot-check=1`);
await new Promise(resolve => setTimeout(resolve, 1500));

const aside = window.document.getElementById('clawd-aside');
assert.ok(aside, '刷新后（不碰设置面板）右栏必须自己建出来');

const nav = window.document.querySelector('#top-settings-holder .cw-nav');
assert.ok(nav, '导航必须自己建出来');
const labels = [...nav.querySelectorAll('.cw-nav-item span')].map(n => n.textContent);
assert.equal(labels.length, 9, '导航九项，实际 ' + labels.length + '：' + labels.join('/'));
assert.ok(labels.includes('背景'), '「背景」那一项必须在（候选 id 生效）');

const bootFail = warns.filter(w => w.includes('剧场结构启动失败'));
assert.equal(bootFail.length, 0, '启动不该抛：' + bootFail.join(' | '));
assert.equal(thrown, null, '不该有未捕获异常：' + thrown);

console.warn = origWarn;
console.log('✓ Playbill 启动验证通过：右栏 + 导航九项（含背景）在刷新后自建');

process.exit(0);
