/* A2 交互回归：抓起 / 拖动阈值 / touch-action / 序列锁 / 代次令牌 / 烦躁衰减。

   为什么单独一个文件：这些断言全都要等真实时间过去（序列 3.4 秒、衰减按
   760ms 连戳），塞进 test-2.0.118-runtime.mjs 会把那个文件拖慢一倍。

   ⚠ 这里的等待时间跟 index.js 里的常量绑死：
     - A2_TMS（戳的各档时长）
     - a2SulkSeq 的 [turn 400, t5 2600, face 400]
     - clawdRuntimeTick 的 200ms 轮询、衰减阈值 1000ms
   改了那边就要同步改这里，否则测到的是竞态不是行为。 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/* ---------- 0. 滚动态：被滚动带歪，慢滚不触发 ---------- */
/* 放在最前面：这时候 Clawd 还没被碰过，fy=0、A/C 轨都空，正好是滚动态该表演的场合。
   jsdom 没有布局，scrollTop 不会自己动，所以直接把它定义成想要的值。 */
const chatBox = window.document.querySelector('#chat');
function scrollTo(top) {
  Object.defineProperty(chatBox, 'scrollTop', { value: top, configurable: true, writable: true });
  chatBox.dispatchEvent(new window.Event('scroll'));
}
scrollTo(0);
await wait(60);
for (let i = 1; i <= 10; i += 1) { scrollTo(i * 180); await wait(28); }
assert.ok(clawd.classList.contains('clawd-scroll-hold'),
  '滚动开始时 Clawd 要扒住输入框');
assert.equal(clawd.style.rotate || '', '',
  '一次滚动只做两次 class 变化，中间不许逐帧写样式');
await wait(400);
assert.equal(clawd.classList.contains('clawd-scroll-hold'), false,
  '停下之后要松手');
assert.ok(clawd.classList.contains('clawd-scroll-release'),
  '松手时要播一次探回来的收尾');
await wait(600);
assert.equal(clawd.classList.contains('clawd-scroll-release'), false,
  '收尾播完要把 class 撤干净');

/* 慢滚必须落在死区里，一点开销都不该产生 */
for (let i = 1; i <= 8; i += 1) { scrollTo(1800 + i); await wait(70); }
assert.equal(clawd.classList.contains('clawd-scroll-hold'), false,
  '慢速滚动必须落在死区里不触发，否则长聊天里每一次滚动都要付代价');

/* ---------- 1. touch-action 静态就是 none；transition 在拖拽期间被切开 ---------- */
/* 2.0.143 起 touch-action 不再是 pointerdown 时才切的内联样式，而是常驻的 CSS——
   Android 在 pointerdown 之后还会自己做一段手势判定，等那时候再切已经晚了。
   所以这里断言的是样式表里有这条规则，不是内联属性。 */
const interactionCss = window.document.getElementById('claude-clawd-interaction-style')?.textContent || '';
assert.match(interactionCss, /touch-action:\s*none\s*!important/,
  '可拖 Clawd 必须常驻 touch-action:none，否则安卓上拖它会把聊天一起滚起来');
press(100, 100);
assert.equal(clawd.style.getPropertyValue('transition'), 'none',
  '按下之后要盖掉 transition:transform 240ms，否则拖拽会被拉成橡皮筋');
lift(100, 100);
/* 上面那一下没拖动，算一次戳，烦躁 +1。等它衰减回 0 再往下测，
   否则下一条测到的是第 2 档而不是第 1 档。衰减阈值 1000ms + tick 200ms。 */
await wait(1500);

/* ---------- 2. 抓的反馈立刻给；5px 阈值只决定松手后是戳还是抛 ---------- */
/* 2.0.143 起 grab 姿势在 pointerdown 就上，不再等第一次大位移——
   等到阈值才给反馈的话，手指落下到画面有反应之间会空掉一拍。
   阈值现在只用来判定松手后走 a2Poke 还是 a2Ballistic。 */
press(100, 100);
assert.equal(cTrack(), 'grab', '手指一落下就该看到抓住的反馈，不能等位移超过阈值');
move(102, 101);                       // 位移 3px，还在阈值内
lift(102, 101);
assert.equal(cTrack(), 't1', '没拖过就该走戳，第一档是 t1');
await wait(1500);

press(100, 100);
move(120, 100);                       // 位移 20px，超过阈值
lift(120, 100);
assert.notEqual(cTrack(), 't1', '拖过就该走抛掷，不是戳');
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

/* ---------- 7. 气泡跟着 Clawd 走，不再留在输入框上 ---------- */
await wait(1500);
press(300, 300);
move(360, 240);                       // 拖开一段
await wait(120);                      // 等 a2DeferGrabFeedback 的 rAF + setTimeout
const toast = clawd.parentElement.querySelector('.clawd-hi-toast, .clawd-cc-toast');
assert.ok(toast, '拖动时应该冒一个气泡出来');
assert.ok(toast.style.translate,
  '气泡必须跟着 Clawd 位移，否则它会留在输入框上、像是话从输入框飘出来的');
/* 用独立的 translate 属性，不是 transform：气泡的 transform 被 translateY(-50%)
   和入场动画占着，写 transform 会把入场动画顶掉。 */
assert.equal(toast.style.transform, '',
  '不许改气泡的 transform，那是 translateY(-50%) 和入场动画在用');
lift(360, 240);
await wait(1600);

/* ---------- 8. 静态：几条不能悄悄回退的实现约束 ---------- */
const src = readFileSync(path.join(root, 'index.js'), 'utf8');
assert.doesNotMatch(src, /A2_CEILING/,
  '不许再出现硬编码的向上活动高度，边界要按真实可视区算');
const wallsBody = src.slice(src.indexOf('function a2Walls'), src.indexOf('function a2ClampX'));
assert.match(wallsBody, /#sheld/, '边界要以聊天容器为基准');
assert.match(wallsBody, /#top-bar/,
  '左边界必须减掉侧栏：#sheld/#chat/#form_sheld 都是 0 → 窗口宽，整个铺在侧栏底下');
assert.match(wallsBody, /const viewportTop = Math\.max\(0, viewport\?\.offsetTop \|\| 0\)/,
  '竖向天花板必须来自可视视口；欢迎页 #sheld 的顶边会塌到输入框附近，把 miny 锁成 0');
assert.match(src, /Math\.pow\(P\.drag, k\)/,
  '回落必须按真实经过时间推进；逐帧推进会让掉帧的设备落得成倍地慢');
assert.ok((src.match(/a2NoteInteraction\(\)/g) || []).length >= 4,
  '抓、戳、抛都要记成「人还在」，否则只跟 Clawd 玩的时候它会在你手里睡着');
assert.doesNotMatch(src, /A2\.flying = 0/,
  '代次令牌只能递增。清零会让它被复用，上一轮排队中的 840ms 回调会认领新的飞行，'
  + '生气和跺脚就会在半空中触发');
const ballistic = src.slice(src.indexOf('function a2Ballistic'), src.indexOf('function a2Poke'));
assert.match(ballistic, /A2\.fy < A2\.bnd\.miny/,
  '抛掷必须夹上边界，否则用力往上一甩就飞出屏幕');
assert.doesNotMatch(ballistic, /A2\.fy = 0;\s*\n\s*A2\.rot = 0;\s*\n\s*A2\.sqx = 1;\s*\n\s*A2\.sqy = 1;\s*\n\s*a2Place\(button\);\s*\n\s*A2\.homeX/,
  '进锁时不许把飞在半空的 Clawd 瞬移回归位线');
assert.match(src, /function a2ClampX\(x\)/,
  '右边界不再随高度变：装饰 Clawd 那堵看不见的墙已经去掉');

/* ---------- 9. 输入态 ---------- */
const box = window.document.querySelector('#send_textarea');
box.focus();
box.value = '在打字';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(300);
assert.ok(clawd.classList.contains('clawd-input-has-text'),
  '框里有字时要挂上输入态的 class');
assert.equal(clawd.dataset.clawdB, 'compose',
  '普通输入保持 compose，不该误触发表情姿势');
assert.match(interactionCss, /@keyframes clawd-compose-nod\b/,
  '点头动作必须存在。原来那个 bob 幅度只有 1px，等于没有输入态');
assert.match(interactionCss, /clawd-compose-nod-frames/,
  '换帧要单独一条 step-end 动画，跟位移合成一条的话像素画会插值糊掉');
assert.match(interactionCss, /\[data-clawd-owner="B"\][^{]*clawd-input-active/,
  '输入态必须限定在 B 轨占画面时——生成和被抓被丢都比「我在看你打字」优先');
assert.match(interactionCss, /\[data-clawd-owner="B"\][^{]*clawd-scroll-hold/,
  '滚动态同样只在 B 轨占画面时表演');
assert.match(interactionCss, /@keyframes clawd-peek-in-frames/,
  '扒住输入框的换帧动画必须在（原型里的 p-peek）');
assert.match(interactionCss, /--clawd-f-peek-grip/,
  '扒住输入框要用 peek-grip 这张钳子搭在上沿的帧');

/* ---------- 10. 原型第一批 B 轨姿势 ---------- */
box.value = '你觉得呢？';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(clawd.dataset.clawdB, 'tilt',
  '输入问号时 B 轨要歪头，不再只播通用点头');

box.value = '真的！';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(clawd.dataset.clawdB, 'wow',
  '输入感叹号时 B 轨要惊讶');

box.value = '这是一段已经足够长而且没有任何标点的输入内容确实很长';
box.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(clawd.dataset.clawdB, 'wow',
  '较长输入也要触发 wow，保留原型的内容长度反馈');

assert.match(interactionCss,
  /clawd-composer-clawd\[data-clawd-owner="B"\]\[data-clawd-b="tilt"\]/,
  '新 B 姿势只能挂在输入框上方的大 Clawd，不能改掉消息末尾小 Clawd 的落款职责');
for (const pose of ['wow', 'hide', 'ledge', 'tramp', 'shake', 'around', 'spin', 'dhop', 'lean', 'wake']) {
  assert.match(interactionCss, new RegExp(`data-clawd-b="${pose}"`),
    `${pose} 必须有 B 轨选择器`);
}
assert.match(interactionCss,
  /clawd-composer-clawd\[data-clawd-owner="A"\]\[data-clawd-a="sit"\]/,
  '长生成的 sit 必须属于 A 轨，不能混进空闲 B 轨');
assert.match(interactionCss, /@keyframes clawd-b-wowP\b/,
  'wow 的位移动画必须从原型移植');
assert.match(interactionCss, /@keyframes clawd-b-hideP\b/,
  'hide 的下沉动画必须从原型移植');
assert.match(interactionCss, /@keyframes clawd-b-ledgeP\b/,
  'ledge 的吊边动画必须从原型移植');
for (const animation of ['trampP', 'shakeP', 'aroundP', 'aroundF', 'spinP', 'spinF',
  'dhopP', 'dhopF', 'leanP', 'leanF', 'wakeP', 'wakeF']) {
  assert.match(interactionCss, new RegExp(`@keyframes clawd-b-${animation}\\b`),
    `${animation} 必须从原型移植，位移和换帧要各走自己的动画`);
}
assert.match(src, /CLAWD_B_AMBIENT_POSES/,
  '空闲姿势不能只留在样式表里，必须接入低频 B 轨在场调度');
for (const pose of ['around', 'shake', 'spin', 'dhop', 'lean', 'hide', 'ledge', 'tramp']) {
  assert.match(src, new RegExp(`state: '${pose}'`),
    `${pose} 必须有实际触发，不能只做成 CSS 库存`);
}
assert.match(src, /maybePlayClawdBAmbient\(now\)/,
  '低频姿势要复用现有 runtime tick，不能另挂高频监听');
const ambientBody = src.slice(src.indexOf('function maybePlayClawdBAmbient'), src.indexOf('function ensureComposerClawd'));
assert.doesNotMatch(ambientBody, /clawd-welcome/,
  '欢迎页就是用户最常等待空闲姿势的地方，不能把它从 B 轨随机调度里排除');
assert.match(src, /CLAWD_TIRED_SIT_MS = 12000/,
  '长生成要在明确阈值后进入 sit，下一阶段再由 applyTired 改成连续疲劳');
assert.match(src, /clawdTracks\.A = 'sit'/,
  'sit 必须真正接进 A 轨，不能只有选择器');
assert.match(src, /setClawdB\('wake', 500\)/,
  '从真实睡眠恢复时必须进入 wake，普通输入不能反复触发');

box.value = '';
box.dispatchEvent(new window.Event('input', { bubbles: true }));

console.log('✓ A2 interaction regressions passed');
process.exit(0);
