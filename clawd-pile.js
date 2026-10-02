/* 输入框右上角：三只叠着睡觉的 Clawd（2.0.223）。
   Lulu 2026-10-01 看过原型 Claude outputs/clawd-pile-v1.html 后定的：一格 2px；巫师（星星帽 + 魔杖）躺在上面，
   牛仔帽在左下，墨镜在右下。替换原来那只不能点的装饰图（#send_form::after，icons/clawd.png）。
   点一下：牛仔抬帽子睁眼、墨镜把眼镜往下拉偷看、巫师的魔杖闪一下；都蹦一下再睡回去。
   像素画和 Clawd 骨架同一套调色板（壳体 #d97757）。box-shadow 里排在前面的画在上面，所以格子要倒过来排。 */
export function createClawdPile({ doc, win }) {
  const PX = 2;
  const PAL = { '#': '#d97757', 'o': 'var(--clawd-pile-eye)', 'Z': '#1f1d1b', 'w': '#fbf8f1', 'B': '#5b8fb9', 'b': '#3f6f99',
    'y': '#e8b64a', 'Y': '#fff3c4', 'n': '#8b5e3c', 'l': '#cc4f45', 'k': 'var(--clawd-pile-ink)', 'h': 'var(--clawd-pile-shadow)' };
  const BODY = ['..############..', '..############..', '..############..', '################', '################',
    '..############..', '..############..', '..############..'];   // 蹲着：腿收进去看不见（Lulu 2026-10-01）
  const EYES = { shut: [[3, 2, 'oo'], [11, 2, 'oo']], open: [[4, 1, 'o'], [4, 2, 'o'], [11, 1, 'o'], [11, 2, 'o']], half: [[4, 2, 'o'], [11, 2, 'o']] };
  const GLASSES = { on: [[3, 1, 'ZZZZ'], [9, 1, 'ZZZZ'], [7, 1, 'ZZ'], [3, 2, 'ZZZ'], [10, 2, 'ZZZ'], [4, 1, 'w'], [10, 1, 'w']],
    down: [[3, 2, 'ZZZZ'], [9, 2, 'ZZZZ'], [7, 2, 'ZZ'], [3, 3, 'ZZZ'], [10, 3, 'ZZZ'], [4, 2, 'w'], [10, 2, 'w']] };
  const COWBOY = ['.....nnnnnn.....', '....nnnnnnnn....', '....llllllll....', '.nnnnnnnnnnnnnn.'];
  const WIZARD = ['...........b....', '..........Bb....', '.........BBB....', '.......BBBBB....', '......ByBBBBB...', '.....BBBBBByBB..', '..BBBBBBBBBBBB..'];
  const WAND = { rest: [[0, 3, 'n'], [1, 2, 'n'], [2, 1, 'n'], [2, -1, '.y.'], [2, 0, 'yYy'], [2, 1, '.y.']],
    shine: [[0, 3, 'n'], [1, 2, 'n'], [2, 1, 'n'], [2, -1, '.Y.'], [2, 0, 'YwY'], [2, 1, '.Y.']] };
  const POS = { cowboy: [0, 16], shades: [14, 16], wizard: [7, 9] };   // 没有腿了，各往下挪一格贴地；巫师再压下去一格，底下两只呼吸压扁时中间不露缝（2.0.228）
  const state = { cowboy: 'sleep', shades: 'sleep', wizard: 'sleep' };
  const timers = new Set();
  let pile = null, zTimer = 0, zi = 0, quietUntil = 0, destroyed = false;

  const later = (fn, ms) => { const t = win.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const grid = (rows, ox = 0, oy = 0) => { const out = []; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') out.push([x + ox, y + oy, ch]); })); return out; };
  const spans = (list, ox = 0, oy = 0) => { const out = []; for (const [x, y, s] of list) [...s].forEach((ch, i) => { if (ch !== '.') out.push([x + i + ox, y + oy, ch]); }); return out; };
  const shadow = cells => cells.slice().reverse().map(([x, y, ch]) => `${x * PX}px ${y * PX}px 0 .3px ${PAL[ch]}`).join(',');
  const calm = () => doc.documentElement.dataset.claudeMotion === 'off' || !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function art(cls, cells) { const a = doc.createElement('div'); a.className = 'clawd-pile-art ' + cls; a.style.boxShadow = shadow(cells); return a; }
  /* 2.0.227（Lulu：点了戴帽子那只以后出现白边）：每一格像素原来是一个 box-shadow 小方块。Windows 缩放 125% / 150% 时一格 = 2.5 / 3 个
     屏幕像素，再加上呼吸和蹦的缩放，相邻小方块对不齐，中间漏出一条条白线。三只的身体、帽子、魔杖改成一张小图（canvas 画好转成图片），
     按最近邻放大（image-rendering: pixelated），一张图怎么缩放都不会裂缝。每种状态的图只画一次，缓存起来。
     Z、闪光、地上的影子不缩放，仍用 box-shadow。 */
  const BMP_W = 22, BMP_H = 16, EYE = '#2b1d17';
  const bmpCache = new Map();
  function bitmap(cells) {
    const key = cells.map(c => c.join(',')).join(';');
    let url = bmpCache.get(key); if (url) return url;
    const cv = doc.createElement('canvas'); cv.width = BMP_W; cv.height = BMP_H;
    const g = cv.getContext?.('2d');
    if (!g) { bmpCache.set(key, 'none'); return 'none'; }   // 没有 canvas 的环境（测试用的 jsdom）：不画，也不抛错
    for (const [x, y, ch] of cells) { g.fillStyle = ch === 'o' ? EYE : PAL[ch]; g.fillRect(x, y, 1, 1); }   // 后画的盖住先画的
    url = `url("${cv.toDataURL()}")`; bmpCache.set(key, url); return url;
  }
  function sprite(cls, cells) { const a = doc.createElement('div'); a.className = 'clawd-pile-bmp ' + cls; a.style.backgroundImage = bitmap(cells); return a; }
  /* 2.0.225（Lulu：点击卡卡的）：每只两层——外层 .clawd-pile-c 管位置和「蹦」（Web Animations，每次点都能干净地重播），
     里层 .clawd-pile-b 管呼吸（CSS 动画）。以前蹦和呼吸抢同一个 animation 属性，一蹦呼吸就从半截跳回原大；
     换眼睛 / 帽子还整只重建元素，呼吸也跟着从头来。现在换状态只改那几层的 box-shadow，元素不动。 */
  const parts = {};
  function cellsOf(name) {
    const st = state[name];
    // 帽子在身体上面 7 格以内，所以每只的原点上移 7 格
    let body = grid(BODY, 0, 7);
    if (name === 'shades') body = body.concat(st === 'awake' ? spans(EYES.open, 0, 7).concat(spans(GLASSES.down, 0, 7)) : spans(GLASSES.on, 0, 7));
    else body = body.concat(spans(st === 'awake' ? EYES.open : st === 'half' ? EYES.half : EYES.shut, 0, 7));
    const out = { body };
    if (name === 'cowboy') out.hat = grid(COWBOY, 0, st === 'awake' ? 2 : 3);
    if (name === 'wizard') { out.hat = grid(WIZARD); out.wand = spans(st === 'awake' ? WAND.shine : WAND.rest, 15, 7); }
    return out;
  }
  function sleeper(name) {
    const [X, Y] = POS[name];
    const c = doc.createElement('div');
    c.className = 'clawd-pile-c' + (name === 'wizard' ? ' clawd-pile-top' : '');
    c.dataset.name = name;
    c.style.cssText = `left:${X * PX}px;top:${(Y - 7) * PX}px;width:${16 * PX}px;height:${16 * PX}px`;
    const b = doc.createElement('div'); b.className = 'clawd-pile-b';
    const layers = {};
    for (const [k, cells] of Object.entries(cellsOf(name))) { layers[k] = sprite(k, cells); b.append(layers[k]); }
    c.append(b);
    parts[name] = { c, layers, timers: [], hop: null };
    c.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); poke(name); });
    return c;
  }
  function paint(name) {
    const p = parts[name]; if (!p) return;
    for (const [k, cells] of Object.entries(cellsOf(name))) { const v = bitmap(cells); if (p.layers[k] && p.layers[k].style.backgroundImage !== v) p.layers[k].style.backgroundImage = v; }
  }
  function draw() {
    if (!pile) return;
    pile.querySelectorAll(':scope>*').forEach(n => n.remove());
    const ground = doc.createElement('div'); ground.className = 'clawd-pile-ground';
    ground.append(art('', grid(['.' + 'h'.repeat(28) + '.'], 0, 24)));
    pile.prepend(ground);
    for (const name of ['cowboy', 'shades', 'wizard']) pile.append(sleeper(name));
    buildFx();
  }
  // 蹦一下（果冻）：先压扁蓄力 → 拉长弹起 → 落地再压扁 → 回正。位置和形变都是平滑的。
  const HOP = [
    { translate: '0 0', scale: '1 1', easing: 'cubic-bezier(.3,0,.5,1)' },
    { offset: .18, translate: '0 0', scale: '1.08 .9', easing: 'cubic-bezier(.2,.8,.4,1)' },
    { offset: .5, translate: `0 -${3 * PX}px`, scale: '.95 1.07', easing: 'cubic-bezier(.5,0,.8,.4)' },
    { offset: .78, translate: '0 0', scale: '1.07 .92', easing: 'cubic-bezier(.3,0,.4,1)' },
    { translate: '0 0', scale: '1 1' },
  ];
  function poke(name) {
    const p = parts[name]; if (!p) return;
    quietUntil = Date.now() + 1800;
    // 连点：作废这一只上次留下的「半睁 / 睡回去」，重新算。
    for (const t of p.timers) { win.clearTimeout(t); timers.delete(t); } p.timers.length = 0;
    state[name] = 'awake'; paint(name);
    if (!calm() && p.c.animate) { p.hop?.cancel(); p.hop = p.c.animate(HOP, { duration: 460 }); }
    if (name === 'wizard' && !calm()) sparkle();
    p.timers.push(later(() => { state[name] = 'half'; paint(name); }, 1000));
    p.timers.push(later(() => { state[name] = 'sleep'; paint(name); }, 1400));
  }
  /* 2.0.225：Z 和闪光改成建好就一直挂着的几个元素（平时透明），用 Web Animations 播。
     以前每次飘 Z、闪光都往页面里加删元素，酒馆的 keyboard.js 和别的扩展（regex_bind 等）观察整页增删，
     每次都跟着整页重扫，点一下就卡一下（实测 50–100ms 的长任务）。播 Web Animations 不改 DOM、不改属性，它们不会被惊动。 */
  const SPARK_AT = [[19, -3, 0], [21, -1, 120], [18, -1, 220], [20, -5, 320]];
  const SPARK = [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.6 }];
  const ZFLOAT = [{ opacity: 0, translate: '0 0' }, { offset: .12, opacity: 1 }, { offset: .8, opacity: .9 }, { opacity: 0, translate: `${6 * PX}px -${14 * PX}px` }];
  let sparks = [], zs = [];
  // Z 和闪光也画成小图（box-shadow 的 .3px 外扩在缩放屏上会糊出一圈浅色边）。Z 的颜色日夜不同，两张都画好，CSS 按日夜挑。
  function smallBmp(cells, w, h, ink) {
    const cv = doc.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext?.('2d');
    if (!g) return 'none';
    for (const [x, y, ch] of cells) { g.fillStyle = ch === 'k' ? ink : PAL[ch]; g.fillRect(x, y, 1, 1); }
    return `url("${cv.toDataURL()}")`;
  }
  function buildFx() {
    const [X, Y] = POS.wizard;
    const fx = (cls, x, y, w, h, css) => { const n = doc.createElement('div'); n.className = cls; n.style.cssText = `left:${x * PX}px;top:${y * PX}px;width:${w * PX}px;height:${h * PX}px;${css}`; pile.append(n); return n; };
    const star = smallBmp([[0, 1, 'Y'], [1, 0, 'Y'], [1, 2, 'Y'], [2, 1, 'Y'], [1, 1, 'w']], 3, 3);
    sparks = SPARK_AT.map(([dx, dy]) => fx('clawd-pile-spark', X + dx - 1, Y + dy - 1, 3, 3, `background-image:${star}`));
    const big = spans([[0, 0, 'kkkk'], [2, 1, 'k'], [1, 2, 'k'], [0, 3, 'kkkk']]), small = spans([[0, 0, 'kkk'], [1, 1, 'k'], [0, 2, 'kkk']]);
    /* 2.0.228：Z 改回 box-shadow 小方块。做成小图后，一边平滑飘一边按最近邻放大，Z 的斜笔画会时有时无，看着像「工」（Lulu 截图）。
       Z 只平移不缩放，用 box-shadow 没有裂缝问题；颜色走 --clawd-pile-ink，日夜自动换。大小两个 Z 轮流。 */
    zs = [fx('clawd-pile-z', X + 12, Y - 2, 1, 1, `box-shadow:${shadow(big)}`), fx('clawd-pile-z', X + 13, Y - 2, 1, 1, `box-shadow:${shadow(small)}`)];
  }
  function sparkle() {
    sparks.forEach((s, i) => s.animate?.(SPARK, { duration: 500, delay: SPARK_AT[i][2], easing: 'steps(4)' }));
  }
  // 2.0.227（Lulu：Z 动太快）：飘一趟 2.6 → 4.2 秒，间隔 1.1 → 1.5 秒。三个 Z 轮流用（3 × 1.5 > 4.2，不会撞车）。
  // 2.0.228（Lulu：一次飘一个 Z 就好）：上一个飘完、隔 0.8 秒再出下一个，空中永远只有一个。
  const Z_FLOAT_MS = 4200, Z_EVERY_MS = 5000;
  // Z：从巫师头顶右边一个一个往右上飘。页面在后台、减少动态、刚被戳过时不飘。
  function puffZ() {
    if (!pile || doc.hidden || calm() || Date.now() < quietUntil || pausedAt) return;
    zs[zi++ % zs.length]?.animate?.(ZFLOAT, { duration: Z_FLOAT_MS, easing: 'linear' });
  }
  const CSS = `
html body #send_form#send_form.clawd-has-pile::after{content:none!important}
html body #send_form#send_form>.clawd-pile.clawd-pile{display:block!important}
.clawd-pile{--clawd-pile-eye:#2b1d17;--clawd-pile-ink:#6b6560;--clawd-pile-shadow:rgba(20,20,19,.16);position:absolute;bottom:100%;right:14px;margin-bottom:-1px;width:${30 * PX}px;height:${25 * PX}px;z-index:2;pointer-events:none}
html[data-claude-integrated-theme="night"] .clawd-pile{--clawd-pile-ink:#bdb7ae;--clawd-pile-shadow:rgba(0,0,0,.35)}
.clawd-pile>.clawd-pile-c{position:absolute;pointer-events:auto;cursor:pointer;transform-origin:50% 93.75%}
.clawd-pile>.clawd-pile-ground{position:absolute;left:0;top:0;pointer-events:none}
.clawd-pile .clawd-pile-art{position:absolute;left:0;top:0;width:${PX}px;height:${PX}px}
.clawd-pile .clawd-pile-bmp{position:absolute;left:0;top:0;width:${BMP_W * PX}px;height:${BMP_H * PX}px;background:no-repeat 0 0/100% 100%;image-rendering:pixelated;pointer-events:none}
.clawd-pile .clawd-pile-b{position:absolute;inset:0;transform-origin:50% 93.75%}
/* 呼吸（果冻）：三只各自轻轻压扁再回弹，原点在各自身体底边；周期和起点都错开，不会一起动。
   幅度很小（高约 1px），上面那只和下面两只之间最多差一格。 */
.clawd-pile>.clawd-pile-c>.clawd-pile-b{animation:clawd-pile-breathe 3.1s ease-in-out infinite}
.clawd-pile>.clawd-pile-c[data-name="shades"]>.clawd-pile-b{animation-duration:3.5s;animation-delay:-1.2s}
.clawd-pile>.clawd-pile-c[data-name="wizard"]>.clawd-pile-b{animation-duration:2.8s;animation-delay:-.6s}
/* 2.0.228（Lulu：果冻再明显一点）：压扁 1.035/.955 → 1.07/.91，回弹时拉长冲过头再落回。 */
@keyframes clawd-pile-breathe{0%,100%{scale:1 1}42%{scale:1.07 .91}58%{scale:.96 1.05}72%{scale:1.015 .985}84%{scale:1 1}}
.clawd-pile :is(.clawd-pile-z,.clawd-pile-spark){position:absolute;pointer-events:none;opacity:0;background-repeat:no-repeat;background-size:100% 100%;image-rendering:pixelated}
html[data-claude-motion="off"] .clawd-pile *{animation:none!important}
.clawd-pile[data-paused] *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.clawd-pile *{animation:none!important}}
html[data-claude-decorations="off"] .clawd-pile{display:none!important}`;
  /* 2.0.235（Lulu：更新后滚动对话变卡）：实测这一堆的呼吸和飘 Z 在这个页面上没交给合成器，每一帧都在主线程算样式，
     滚动时那几帧又正好要处理滚动带来的样式失效，这一堆占了滚动时样式计算的约四分之一。
     滚对话（或页面里任何滚动区域）时先把它们暂停，停下来 0.4 秒后再接着动。暂停只改这一堆自己的属性，不碰 html / body。 */
  let pausedAt = 0, resumeTimer = 0;
  function setPaused(on) {
    if (!pile) return;
    if (on) {
      if (!pausedAt) { pausedAt = Date.now(); pile.setAttribute('data-paused', ''); for (const z of zs) for (const a of z.getAnimations?.() || []) a.pause(); }
      win.clearTimeout(resumeTimer); resumeTimer = win.setTimeout(() => setPaused(false), 400);
    } else if (pausedAt) {
      pausedAt = 0; pile.removeAttribute('data-paused'); for (const z of zs) for (const a of z.getAnimations?.() || []) a.play();
    }
  }
  const onScroll = e => { if (pile && !(e.target instanceof win.Node && pile.contains(e.target))) setPaused(true); };
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
  let style = null;
  function ensure() {
    if (destroyed) return null;
    const form = doc.querySelector('#send_form');
    if (!form) return null;
    if (!style || !style.isConnected) { style = doc.createElement('style'); style.id = 'clawd-pile-style'; style.textContent = CSS; doc.head.append(style); }
    if (!pile || !form.contains(pile)) {
      pile?.remove();
      pile = doc.createElement('div'); pile.className = 'clawd-pile'; pile.setAttribute('aria-hidden', 'true');
      form.append(pile); draw();
    }
    if (!form.classList.contains('clawd-has-pile')) form.classList.add('clawd-has-pile');
    if (!zTimer) zTimer = win.setInterval(puffZ, Z_EVERY_MS);
    return pile;
  }
  // 大 Clawd 落地时要给这一堆让开：返回这堆在屏幕上的左边（没有就返回 null）。
  function left() { if (!pile || !pile.isConnected) return null; const r = pile.getBoundingClientRect(); return r.width ? r.left : null; }
  function destroy() {
    destroyed = true; win.clearInterval(zTimer); zTimer = 0; win.clearTimeout(resumeTimer);
    doc.removeEventListener('scroll', onScroll, { capture: true });
    for (const t of timers) win.clearTimeout(t); timers.clear();
    pile?.closest('#send_form')?.classList.remove('clawd-has-pile');
    pile?.remove(); pile = null; style?.remove(); style = null;
  }
  return { ensure, left, destroy };
}
