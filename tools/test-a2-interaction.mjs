/* A2 交互回归：抓起 / 拖动阈值 / touch-action / 序列锁 / 代次令牌 / 烦躁衰减。

   为什么单独一个文件：这些断言全都要等真实时间过去（序列 3.4 秒、衰减按
   760ms 连戳），塞进 test-2.0.118-runtime.mjs 会把那个文件拖慢一倍。

   ⚠ 这里的等待时间跟 index.js 里的常量绑死：
     - A2_TMS（戳的各档时长）
     - a2SulkSeq 的 [turn 400, t5 2600, face 400]
     - clawdRuntimeTick 的 200ms 轮询、衰减阈值 1000ms
   改了那边就要同步改这里，否则测到的是竞态不是行为。 */

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
await import(`${pathToFileURL(path.join(root, 'index.js')).href}?a2-test=1`);
await new Promise(resolve => window.setTimeout(resolve, 850));

const clawd = window.document.querySelector('#send_form > .clawd-composer-clawd');
assert.ok(clawd, 'A2 测试需要输入框上方那只 Clawd 先挂上');
const sendForm = window.document.getElementById('send_form');
const originalClawdRect = clawd.getBoundingClientRect.bind(clawd);
const originalFormRect = sendForm.getBoundingClientRect.bind(sendForm);
let dragGeometryReads = 0;
clawd.getBoundingClientRect = () => { dragGeometryReads += 1; return originalClawdRect(); };
sendForm.getBoundingClientRect = () => { dragGeometryReads += 1; return originalFormRect(); };

function wait(ms) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

/* jsdom 没有 PointerEvent，用普通 Event 补上处理函数真正读到的那几个字段。 */
function pointer(type, x, y) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  return event;
}
function press(x, y) { clawd.dispatchEvent(pointer('pointerdown', x, y)); }
function move(x, y) { clawd.dispatchEvent(pointer('pointermove', x, y)); }
function lift(x, y) { clawd.dispatchEvent(pointer('pointerup', x, y)); }
const cTrack = () => clawd.dataset.clawdC || '';

/* ---------- 1. touch-action 必须预先声明；按下立即进入抓取姿势 ---------- */
const interactionStyle = window.document.getElementById('claude-clawd-interaction-style')?.textContent || '';
assert.match(interactionStyle, /clawd-composer-clawd[\s\S]{0,900}?touch-action:\s*none\s*!important/,
  'Android 在 pointerdown 前就决定滚动归属，可拖 Clawd 必须静态 touch-action:none');
assert.equal(clawd.style.getPropertyValue('touch-action'), '',
  'touch-action 不该等 pointerdown 才以内联样式补上');
dragGeometryReads = 0;
press(100, 100);
assert.equal(cTrack(), 'grab', '手指落下必须立即显示抓取姿势，不等位移阈值');
assert.equal(dragGeometryReads, 0, '正常 pointerdown 必须使用预热边界，不能临时强制布局');
assert.equal(clawd.style.getPropertyValue('touch-action'), '',
  '当前手势开始后再改 touch-action 已经无效，不得恢复旧的晚切逻辑');
assert.equal(clawd.style.getPropertyValue('transition'), 'none',
  '按下之后要盖掉 transition:transform 240ms，否则拖拽会被拉成橡皮筋');
lift(100, 100);
assert.equal(clawd.style.getPropertyValue('touch-action'), '',
  '松手后不应写入或清理 touch-action，静态规则始终接管');
/* 上面那一下没拖动，算一次戳，烦躁 +1。等它衰减回 0 再往下测，
   否则下一条测到的是第 2 档而不是第 1 档。衰减阈值 1000ms + tick 200ms。 */
await wait(1500);

/* ---------- 2. 拖动阈值：5px 以内算戳，超过才算拖 ---------- */
press(100, 100);
move(102, 101);                       // 位移 3px，还在阈值内
assert.equal(cTrack(), 'grab', '3px 内仍保持按下即出现的抓取反馈');
assert.doesNotMatch(clawd.style.getPropertyValue('transform'), /translate3d/,
  '3px 位移仍应判成戳，不能真正搬动位置');
lift(102, 101);
assert.equal(cTrack(), 't1', '没拖过就该走戳，第一档是 t1');
await wait(1500);

press(100, 100);
dragGeometryReads = 0;                // pointerdown 的边界读取不算进首次 move
move(120, 100);                       // 位移 20px，超过阈值
assert.equal(cTrack(), 'grab', '超过阈值就该进 grab');
assert.match(clawd.style.getPropertyValue('transform'), /translate3d\((?!0\.0px)/,
  '首次有效 move 必须同步写入位置');
assert.equal(dragGeometryReads, 0,
  '首次有效 move 不能先为气泡或粒子同步读取布局');
await wait(80);                       // 首帧之后才允许反馈读取布局
assert.ok(dragGeometryReads >= 3, '延后的气泡和粒子仍应正常创建');
lift(120, 100);
await wait(1400);                     // 让这次抛掷落定

/* ---------- 3. 烦躁衰减从最后一次互动算起 ---------- */
/* 连戳间隔 760ms。如果衰减是按挂钟固定掉档，净增长只有 0.3 档/秒，
   永远爬不到第 4 档——这条就是用来卡住那个回归的。 */
await wait(3600);                     // 先把烦躁放干净：抛掷也会加烦躁，衰减是 1 档/秒
let tier = '';
for (let i = 0; i < 4; i += 1) {
  press(100, 100);
  lift(100, 100);
  tier = cTrack();
  if (i < 3) await wait(760);
}
assert.equal(tier, 't4', `连戳 4 下（间隔 760ms）必须爬到第 4 档，实际是 ${tier || '空'}`);

/* ---------- 4. 第 5 档进生气序列，锁期间抓不起来 ---------- */
await wait(760);
press(100, 100);
lift(100, 100);
assert.equal(cTrack(), 'turn', '第 5 档要进生气序列，第一步是转身');

await wait(200);
press(100, 100);
move(140, 100);                       // 锁期间试着把它拖走
assert.equal(cTrack(), 'turn', '生气期间抓不起来，C 轨不许被 grab 顶掉');
lift(140, 100);
assert.equal(cTrack(), 'turn', '锁期间松手也不许触发抛掷');

/* ---------- 5. 序列不许被砸穿，也不许留半截姿势 ---------- */
await wait(500);                      // 此时应已走到第二步 t5（400ms 之后）
assert.equal(cTrack(), 't5', '序列第二步应该是背对着的 t5');
press(100, 100);
move(150, 120);
lift(150, 120);
await wait(100);
assert.equal(cTrack(), 't5', '序列播到一半被抓，姿势不许被顶掉');

await wait(3200);                     // 400 + 2600 + 400 = 3400，留足余量
assert.equal(cTrack(), '', '序列播完要把 C 轨清干净，不能留半截姿势');

/* ---------- 6. 序列播完烦躁归零 ---------- */
press(100, 100);
lift(100, 100);
assert.equal(cTrack(), 't1', '生气播完烦躁要清零，下一次戳应该重新从第 1 档开始');

console.log('✓ A2 interaction regressions passed');
process.exit(0);
