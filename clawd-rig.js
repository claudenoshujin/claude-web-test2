/* Clawd 分件骨架 · 复合动作（C1b）
   由 diagnostics 原型的源码自动生成（make-rig.py），不要手改：改动作先改原型、看过，再重新生成。
   和原型的区别只有：
   - 坐标原点对齐现网 ::before（BOX = [0, 6]），静止时 9 层拼出来和 --clawd-f-open 逐像素一致；
   - 选择器挂在输入框那只 Clawd 按钮上（data-clawd-clip），层用 clr- 前缀，免得和酒馆撞名；
   - 眼睛、描边颜色跟现网主题变量走；
   - 躲进输入框的剪切挂在 .clawd-rig 上；
   - 动作的 CSS 按需生成：一次全生成约 500KB，改成播到哪个才生成哪个（cssFor）。 */

const RB = 'button.clawd-signoff-button.clawd-composer-clawd';

export function buildClawdRig() {
  /* ════════════════════════════════════════════════════════════════════
     1. 调色板 —— 一个字符对应一个颜色，'.' 和空格是透明
     ════════════════════════════════════════════════════════════════════ */
  const PX = 3;          // 一个美术像素 = 3 CSS px（和现网 box-shadow 点阵同格）
  const TICK = 100;      // 统一节拍：所有变化都落在 100ms 一格的网格上（官方 GIF 实测：每次变化间隔的中位数正好 100ms）
  const PAL = {
    '#': '#d97757',      // 壳体（现网同色）
    's': '#bf684c',      // 暗部：转面、在身前的钳子。新增的第三个本体色
    'o': 'var(--cl-clawd-eye, #000)',   // 眼睛：跟现网 ::before 同一个变量
    'k': 'var(--clr-ink)', // 道具描边、符号：主题正文色掺暖灰，日间暖深棕、夜间浅色（--clr-ink 在 genRestCSS 里定义一次）
    'w': '#fbf8f1', 'c': '#ecdfc6', 'g': '#a8a194',
    'b': '#cfe3ee', 'B': '#5b8fb9', 'y': '#e8b64a', 'r': '#cc4f45',
    'p': '#ef9aa6', 'n': '#8b5e3c', 'l': '#6a6158',
    'O': '#d97757', 'q': '#e8a88e', 'Q': '#f1cbbb',   // 节点：本色 / 淡 / 更淡
    'e': 'var(--clr-ink)', // 墨迹
    'h': 'rgba(20,20,19,.16)', // 影子
    // 道具描边：不用深墨色。一格描边在输入框那个尺寸下约 2.5 屏幕像素，深色就成了一圈粗黑边（Lulu 2026-09-24 真机）。
    // 改成比道具本色深两三档的同色系中间调：纸、信封用暖灰，杯子、碗用灰蓝。日夜两套底色上都看得清。
    'd': '#9a8e80', 'D': '#6f8ca6',
  };

  /* ════════════════════════════════════════════════════════════════════
     2. 精灵 —— 每层一组帧。ox/oy 是这张图左上角相对于该层原点的偏移
     ════════════════════════════════════════════════════════════════════ */
  const F = (rows, ox = 0, oy = 0) => ({ rows, ox, oy });
  const rep = (s, n) => Array(n).fill(s);

  function mirrorFrame(fr, partW) {
    // 左右镜像：以该层原点所在的 partW 宽格子为轴
    const w = Math.max(...fr.rows.map(r => r.length));
    const rows = fr.rows.map(r => r.padEnd(w, '.').split('').reverse().join(''));
    return { rows, ox: partW - (fr.ox + w), oy: fr.oy };
  }

  const SPR = {
    body: {
      stand: F(rep('############', 8)),
      tall:  F(rep('############', 9), 0, -1),
      squash:F(['.ssssssssssss.', ...rep('##############', 5)], -1, 2),
      squash2:F(['.ssssssssssss.', ...rep('##############', 4)], -1, 4),   // 坐得更扁：配 legs.crouch
      turnL: F(rep('###########s', 8)),          // 面朝左：右边一列暗部
      turnR: F(rep('s###########', 8)),          // 面朝右：左边一列暗部
      leanR: F([...rep('.############', 4), ...rep('############.', 4)]),
      leanL: F([...rep('############.', 4), ...rep('.############', 4)], -1),
    },
    legs: {
      stand:  F(['.#.#....#.#.', '.#.#....#.#.']),
      crouch: F(['.#.#....#.#.'], 0, 1),
      tuck:   F(['..#.#..#.#..'], 0, 1),
      // 走路：近侧一对腿着地（本色、两格长），远侧一对抬起（暗部色、一格长），两对交替（Lulu 2026-09-24 改）
      walkA:  F(['.#.s....#.s.', '.#......#...']),
      walkB:  F(['.s.#....s.#.', '...#......#.']),
      // 被拎起来：腿岔开往下垂，两帧交替就是在空中蹬腿
      // 被拎着蹬腿：左边两条和右边两条轮流伸直（2 格）/ 缩起（1 格），四条腿都在动。
      // 第三轮：伸到 3 格的腿和挥舞的钳子一样长，看着像多了一对手（Lulu 2026-09-24），改回最长 2 格
      dangle: F(['.#.#....#.#.', '.#.#........']),
      dangle2:F(['.#.#....#.#.', '........#.#.']),
    },
    eyes: {
      open:   F(['o......o', 'o......o']),
      half:   F(['o......o'], 0, 1),
      shut:   F(['oo......oo'], -1, 1),
      happy:  F(['.o......o.', 'o.o....o.o'], -1),   // ^^ 笑眼（以前画成了 ∨∨，Lulu 2026-09-24 改）
      squint: F(['o......o', '.o....o.', 'o......o']),
      wide:   F(['oo......oo', 'oo......oo'], -1),
    },
    clawR: {
      stub:  F(['##', '##']),
      front: F(['ss', 'ss']),
      up:    F(['##', '##', '#.'], 0, -7),       // 和现网 cheer 帧的钳子位置一致
      rUp:   F(['..##', '..##', '.#..', '.#..', '#...', '#...'], 0, -4),
      rDown: F(['#...', '.#..', '..##', '..##'], 0, 1),   // 斜着往下够地面（已不用，留着备查）
      low:   F(['###', '###'], 0, 3),                    // 贴地：挨着身体右下角（种节点用）
      reach1:F(['...##', '#####']),                        // 伸手：细胳膊 + 钳子
      reach2:F(['......##', '########']),
    },
    shadow: {
      w12: F(['hhhhhhhhhhhh']),
      w14: F(['hhhhhhhhhhhhhh'], -1),
      w10: F(['hhhhhhhhhh'], 1),
      w8:  F(['hhhhhhhh'], 2),
    },
    prop: {
      // 擦杯子
      mug:   F(['..DDDD', 'DDDbwD', 'D.DbbD', 'DDDbbD', '..DDDD']),
      cloth: F(['cw..', 'wccc', '.cwc', '..c.']),
      // 吃饭
      // 饭压平、比碗口宽一点（Lulu 2026-09-24 改）
      // 碗缩小、筷子改短，不再伸出身体外面（Lulu 2026-09-24）
      bowl:  F(['wwwww', 'DBwBD', '.DDD.']),
      bowlEmpty: F(['DgggD', '.DDD.'], 0, 1),
      // 筷子从右钳往左下斜插进碗里，不再横过脸
      chop:  F(['...n', '..n.', '.n..', 'n...']),
      chopRice: F(['...n', '..n.', '.n..', 'w...']),
      // 读信
      env:   F(['dddddddd', 'ddwwwwdd', 'dwdwwdwd', 'dwwddwwd', 'dwwwwwwd', 'dddddddd']),
      envOpen: F(['..dddd..', '.dwwwwd.', 'dddddddd', 'dwwwwwwd', 'dwwwwwwd', 'dwwwwwwd', 'dwwwwwwd', 'dddddddd'], 0, -2),
      letter: F(['ddddddd', 'dcccccd', 'dgggccd', 'dcccccd', 'dggggcd', 'dcccccd', 'dggccrd', 'ddddddd']),
      letterFold: F(['ddddd', 'dcccd', 'dcrcd', 'ddddd']),
      // 种节点（生长帧以根为原点，往上长）
      seed:  F(['On', 'nO']),
      p1:    F(['O', 'l', 'l'], 0, -2),
      p2:    F(['O', 'l', 'l', 'l'], 0, -3),
      p3:    F(['..O..', '..l..', 'O.l.O', '.lll.', '..l..'], -2, -4),
      p4:    F(['..O..', 'O.l.O', '.lll.', 'O.l.O', '.lll.', '..l..', '..l..'], -2, -6),
      d1:    F(['...O...', 'O.....O', '.O...O.', '.......', 'O.....O', '.......', '.......', '...O...'], -3, -8),
      d2:    F(['.q...q.', '...q...', 'q.....q', '.......', '.q...q.', '.......', '...q...'], -3, -10),
      d3:    F(['Q.....Q', '...Q...', '.......', '.Q...Q.', '.......', '...Q...'], -3, -12),
      // 追蝴蝶（以蝴蝶身体下端为原点）
      bfUp:  F(['B...B', 'BB.BB', '.BkB.', '..k..'], -2, -3),
      bfDn:  F(['.....', '.....', 'BBkBB', '.BkB.'], -2, -3),
      bfRest:F(['..B..', '.BB..', '..k..'], -2, -2),
      // 伸懒腰
      tear:  F(['b', 'b']),
      // 出错时纸上画叉
      sheetErr: F(['cerrcccrrccccc', 'ceerrcrreccccc', 'gggggggggggggg'], 0, -2),
      quillDown: F(['k.BB', '.BB.'], 0, 0),   // 掉在地上躺平的笔
      // 写字
      quill: F(['...BB', '..BB.', '.k...', 'k....'], 0, -3),
      quillFly: F(['BB.', '.BB', '..k'], 0, -2),
      sheetFly: F(['cccc', 'cecc', 'cccc'], 0, -2),
    },
    sym: {
      bang:  F(['..r..', '..r..', '..r..', '.....', '..r..'], -2),
      q:     F(['.kkk.', 'k...k', '...k.', '..k..', '.....', '..k..'], -2, -1),
      heart: F(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], -2),
      note:  F(['..kk.', '..k.k', '..k..', 'kkk..', 'kk...'], -2),
      spark: F(['..y..', '..y..', 'yyyyy', '..y..', '..y..'], -2),
      sparkS:F(['.y.', 'yyy', '.y.'], -1, 1),
      dots:  F(['k.k.k'], -2, 4),
      dots1: F(['k....'], -2, 4), dots2: F(['k.k..'], -2, 4),
      tilde: F(['.k...', 'k.k.k', '...k.'], -2, 2),
      z:     F(['kkkkk', '...k.', '..k..', '.k...', 'kkkkk'], -2, 0),   // 睡觉的 Z（5×5，4×4 的斜线太短，看着像「工」）
      vein:  F(['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'], -2),   // 生气的青筋（「哼」）
      sweat: F(['.B.', 'BbB', 'BbB', '.B.'], -1, 1),          // 汗滴（灰蓝描边，浅底上也看得见）
    },
  };
  // 左钳 = 右钳镜像
  SPR.clawL = Object.fromEntries(Object.entries(SPR.clawR).map(([k, fr]) => [k, mirrorFrame(fr, 2)]));
  // 写字的墨迹：一条往右长的波浪线，每 300ms 多两格
  (() => {
    const top = 'e.ee.e..ee.e.ee..e.e';
    const bot = '.e..e.ee..e.e..ee.e.';
    for (let i = 1; i <= 10; i++) SPR.prop['ink' + i] = F([top.slice(0, i * 2), bot.slice(0, i * 2)], 0, -1);
    // 纸：平放在地上的一条，墨迹写在纸上（Lulu：完成时要把笔和纸都丢掉，所以得先有纸）
    const W = 14;
    for (let i = 0; i <= 10; i++) {
      const n = Math.round(i * 1.2);
      const r0 = ('c' + top.slice(0, n).replace(/\./g, 'c')).padEnd(W, 'c');
      const r1 = ('c' + bot.slice(0, n).replace(/\./g, 'c')).padEnd(W, 'c');
      SPR.prop['sheet' + i] = F([r0, r1, 'g'.repeat(W)], 0, -2);
    }
  })();

  /* ════════════════════════════════════════════════════════════════════
     3. 骨架 —— 各层原点（相对 16×10 的 Clawd 框左上角）、静止帧、层级
     ════════════════════════════════════════════════════════════════════ */
  const PARTS = ['shadow', 'legs', 'body', 'eyes', 'clawL', 'clawR', 'propA', 'propB', 'sym'];
  const SHEET = { shadow: 'shadow', legs: 'legs', body: 'body', eyes: 'eyes', clawL: 'clawL', clawR: 'clawR', propA: 'prop', propB: 'prop', sym: 'sym' };
  const ORIGIN = { shadow: [2, 10], legs: [2, 8], body: [2, 0], eyes: [4, 2], clawL: [0, 5], clawR: [14, 5], propA: [0, 0], propB: [0, 0], sym: [7, -9] };   // 符号整体比身体顶再高一点（Lulu 2026-09-24：往上挪）
  const REST_F = { shadow: 'w12', legs: 'stand', body: 'stand', eyes: 'open', clawL: 'stub', clawR: 'stub', propA: null, propB: null, sym: null };
  const REST_Z = { shadow: 1, legs: 2, body: 3, eyes: 4, clawL: 5, clawR: 5, propA: 7, propB: 8, sym: 9 };
  const UPPER_KIDS = new Set(['body', 'eyes', 'clawL', 'clawR', 'sym']);   // 跟着上半身一起动的层
  const BOX = [0, 6];                   // 和现网 ::before 的 box-shadow 坐标对齐：框左上角 = (0px, 18px)

  // 现网 --clawd-f-open 解出来的点阵，用来验证「静止拼图 = 现网」
  const OPEN_REF = [
    '..############..',
    '..############..',
    '..##o######o##..',
    '..##o######o##..',
    '..############..',
    '################',
    '################',
    '..############..',
    '...#.#....#.#...',
    '...#.#....#.#...',
  ];

  function frameOf(part, name) {
    if (!name) return null;
    const fr = SPR[SHEET[part]][name];
    if (!fr) throw new Error(`没有这一帧：${part}.${name}`);
    return fr;
  }
  function pixelsOf(part, name) {
    // 返回 [[x, y, 颜色字符], ...]，坐标相对 Clawd 框
    const fr = frameOf(part, name);
    if (!fr) return [];
    const [ox0, oy0] = ORIGIN[part];
    const out = [];
    fr.rows.forEach((row, y) => row.split('').forEach((ch, x) => {
      if (ch !== '.' && ch !== ' ') out.push([ox0 + fr.ox + x, oy0 + fr.oy + y, ch]);
    }));
    return out;
  }
  const SHADOW_CACHE = new Map();
  function boxShadow(part, name) {
    const key = part + ':' + name;
    if (SHADOW_CACHE.has(key)) return SHADOW_CACHE.get(key);
    const px = pixelsOf(part, name);
    const v = px.length
      ? px.map(([x, y, ch]) => `${(x + BOX[0]) * PX}px ${(y + BOX[1]) * PX}px 0 .3px ${PAL[ch]}`).join(',')
      : 'none';
    SHADOW_CACHE.set(key, v);
    return v;
  }

  /* ════════════════════════════════════════════════════════════════════
     4. 动作 = 时间轴数据
        at(t, 层, {x, y, f, z, att})  在 t 毫秒时设定（默认直接跳到，像素动画的常态）
        to(t0, t1, 层, {x, y}, ease)  从 t0 的当前值缓动到 t1 的目标值
        层 'upper' 是上半身（身体/眼睛/钳子/符号一起动）；'root' 是整只平移（走路）
        att：道具挂在哪一层上，跟着那一层的位移走
     ════════════════════════════════════════════════════════════════════ */
  const EASE = {
    step: () => 0, lin: p => p, in: p => p * p, out: p => 1 - (1 - p) * (1 - p),
    io: p => p * p * (3 - 2 * p),
  };
  const TRACK_PARTS = ['root', 'upper', ...PARTS];
  const NUM_PROPS = new Set(['x', 'y', 'sc', 'r', 'a']);   // 可以缓动的数值属性
  function restValue(part, prop) {
    if (prop === 'x' || prop === 'y') return 0;
    if (prop === 'f') return part in REST_F ? REST_F[part] : null;
    if (prop === 'z') return REST_Z[part];
    if (prop === 'att') return null;
    if (prop === 'sc' || prop === 'a') return 1;   // 缩放、不透明度
    if (prop === 'r') return 0;                    // 旋转（度）
    throw new Error('未知属性 ' + prop);
  }

  class Clip {
    constructor(id, name, dur, opt = {}) {
      Object.assign(this, { id, name, dur, loop: !!opt.loop, pool: !!opt.pool, weight: opt.weight || 1,
        cool: opt.cool || 0, track: opt.track || 'B', from: opt.from || null, beats: [],
        // intro：循环动作前面先播一段只播一次的「进场」，然后从 intro 那一刻开始循环（例：坐下再接着写）
        intro: opt.intro || 0,
        next: opt.next || null,             // 播完自动接哪个（例：抓起 → 吊着）
        noShadow: !!opt.noShadow,           // 允许中途没有影子（离地、缩进输入框）
        clipGround: !!opt.clipGround,       // 地面线以下剪掉
        hold: !!opt.hold,                   // 播完停在最后一帧等下一个状态（例：被按住，等松手 / 拖动 / 轻抚）
        group: opt.group || 'long' });
      // smooth：哪些层的位移不按 100ms 节拍跳，而是平滑移动。只给「整张图不变、只是换位置」的层用
      //（整只平移、跳起的弧线、飞行的道具）；换姿势、换帧仍然按节拍跳
      this.smooth = new Set(opt.smooth || []);
      this.tr = {};
      this.flexKeys = [];
      this.flexEase = opt.flexEase || 'cubic-bezier(.35,0,.25,1)';
    }
    /* 弹性层：整只的挤压 / 拉伸 / 歪头，平滑插值（不按像素格跳），这是原版伸懒腰 Q 弹的来源 */
    flex(t, v) {
      t = Math.round(t / TICK) * TICK;
      this.flexKeys = this.flexKeys.filter(k => k[0] !== t);
      this.flexKeys.push([t, { sx: 1, sy: 1, r: 0, tx: 0, ty: 0, ...v }]);
      this.flexKeys.sort((a, b) => a[0] - b[0]);
      return this;
    }
    keys(part, prop) {
      this.tr[part] ??= {};
      return (this.tr[part][prop] ??= []);
    }
    put(part, prop, t, v, e = 'step') {
      if (!TRACK_PARTS.includes(part)) throw new Error('未知层 ' + part);
      t = Math.round(t / TICK) * TICK;   // 对齐节拍：写成 150ms 的点会落到 200ms，节奏由作者用 100 的整数倍来保证
      const ks = this.keys(part, prop);
      const i = ks.findIndex(k => k[0] === t);
      if (i >= 0) ks[i] = [t, v, e]; else { ks.push([t, v, e]); ks.sort((a, b) => a[0] - b[0]); }
    }
    at(t, part, props, e = 'step') {
      for (const [prop, v] of Object.entries(props)) this.put(part, prop, t, v, NUM_PROPS.has(prop) ? e : 'step');
      return this;
    }
    to(t0, t1, part, props, e = 'io') {
      t0 = Math.round(t0 / TICK) * TICK; t1 = Math.round(t1 / TICK) * TICK;   // 先对齐节拍再取起点值，不然会读到对齐前的旧值
      for (const [prop, v] of Object.entries(props)) {
        if (!NUM_PROPS.has(prop)) { this.put(part, prop, t1, v); continue; }
        this.put(part, prop, t0, sampleKey(this, part, prop, t0));
        this.put(part, prop, t1, v, e);
      }
      return this;
    }
    seq(t0, step, part, list) {
      list.forEach((props, i) => this.at(t0 + i * step, part, props));
      return this;
    }
    beat(t, text) { this.beats.push([t, text]); return this; }
  }

  function sampleKey(clip, part, prop, t, raw = false) {
    const rest = restValue(part === 'root' || part === 'upper' ? 'propA' : part, prop);
    const ks0 = clip.tr[part]?.[prop];
    if (!ks0 || !ks0.length) return rest;
    const ks = ks0[0][0] === 0 ? ks0 : [[0, rest, 'step'], ...ks0];
    let i = 0;
    while (i + 1 < ks.length && ks[i + 1][0] <= t) i++;
    const [t0, v0] = ks[i];
    const nxt = ks[i + 1];
    if (!nxt || typeof v0 !== 'number' || nxt[2] === 'step' || t < t0) return v0;
    const p = (t - t0) / (nxt[0] - t0);
    const v = v0 + (nxt[1] - v0) * EASE[nxt[2]](p);
    return raw ? +v.toFixed(3) : Math.round(v);   // 平滑层不取整，其余一律取整到整格
  }

  /* 某一时刻整只的状态：每层的 {dx, dy, f, z}（dx/dy 已经合成了上半身、挂载和整体平移之外的所有位移） */
  function sampleState(clip, t) {
    const own = {};
    for (const part of ['upper', ...PARTS]) {
      own[part] = {
        x: sampleKey(clip, part, 'x', t, clip.smooth.has(part)), y: sampleKey(clip, part, 'y', t, clip.smooth.has(part)),
        f: part === 'upper' ? null : sampleKey(clip, part, 'f', t),
        z: part === 'upper' ? 0 : sampleKey(clip, part, 'z', t),
        att: part === 'upper' ? null : sampleKey(clip, part, 'att', t),
        sc: sampleKey(clip, part, 'sc', t, true), r: sampleKey(clip, part, 'r', t, true), a: sampleKey(clip, part, 'a', t, true),
      };
    }
    const out = {};
    const resolve = (part, depth = 0) => {
      if (out[part]) return out[part];
      if (depth > 4) throw new Error('挂载成环：' + part);
      const o = own[part];
      let dx = o.x, dy = o.y;
      if (UPPER_KIDS.has(part)) { dx += own.upper.x; dy += own.upper.y; }
      if (o.att) {
        if (o.att === 'upper') { dx += own.upper.x; dy += own.upper.y; }
        else { const a = resolve(o.att, depth + 1); dx += a.dx; dy += a.dy; }
      }
      return (out[part] = { dx, dy, f: o.f, z: o.z, sc: o.sc, r: o.r, a: o.a });
    };
    PARTS.forEach(p => resolve(p));
    const rr = clip.smooth.has('root');
    out.root = { dx: sampleKey(clip, 'root', 'x', t, rr), dy: sampleKey(clip, 'root', 'y', t, rr) };
    return out;
  }

  function restState() {
    const s = {};
    PARTS.forEach(p => (s[p] = { dx: 0, dy: 0, f: REST_F[p], z: REST_Z[p], sc: 1, r: 0, a: 1 }));
    s.root = { dx: 0, dy: 0 };
    return s;
  }
  function sameState(a, b) {
    return PARTS.every(p => {
      const A = a[p], B = b[p];
      const vis = !!A.f || !!B.f;
      return A.f === B.f && (!vis || (A.dx === B.dx && A.dy === B.dy && A.z === B.z && A.sc === B.sc && A.r === B.r && A.a === B.a));
    }) && a.root.dx === b.root.dx && a.root.dy === b.root.dy;
  }

  /* ════════════════════════════════════════════════════════════════════
     5. 生成器：时间轴 → step-end @keyframes
        每 100ms 采样一次、取整到像素；只在值变化时写关键帧
     ════════════════════════════════════════════════════════════════════ */
  function touches(clip, part) {
    const has = (p, prop) => !!clip.tr[p]?.[prop]?.length;
    return {
      pos: has(part, 'x') || has(part, 'y') || has(part, 'att') || (UPPER_KIDS.has(part) && (has('upper', 'x') || has('upper', 'y')))
        || (has(part, 'att') && (has('upper', 'x') || has('upper', 'y'))),
      f: has(part, 'f'),
      z: has(part, 'z'),
      sc: has(part, 'sc'), r: has(part, 'r'), a: has(part, 'a'),
    };
  }
  function propAttachedPos(clip, part) {
    // 挂载层的位置取决于被挂的那一层，只要这一层在任何时刻挂着东西，就当作需要位移
    return !!clip.tr[part]?.att?.length;
  }
  const pct = (t, dur) => `${+(t / dur * 100).toFixed(3)}%`;

  function clipSegments(clip) {
    if (clip.loop && clip.intro) return [
      { t0: 0, t1: clip.intro, iter: '1', fill: ' forwards', delay: '', sfx: '-i' },
      { t0: clip.intro, t1: clip.dur, iter: 'infinite', fill: '', delay: ` ${clip.intro}ms`, sfx: '' }];
    return [{ t0: 0, t1: clip.dur, iter: clip.loop ? 'infinite' : '1', fill: clip.loop ? '' : ' forwards', delay: '', sfx: '' }];
  }

  function genClipCSS(clip) {
    // 采样：只在 100ms 节拍上出帧。关键点在写入时已经对齐节拍，所以整段动画只有一个钟——
    // 和官方 GIF 一样，要变就在拍子上变，不会出现 25ms、75ms 这种碎拍。
    // 有进场段（intro）的循环动作拆成两段关键帧：进场播一次，循环从进场结束那一刻接上。
    const tset = new Set([0, clip.dur]);
    for (let t = 0; t <= clip.dur; t += TICK) tset.add(t);
    if (clip.intro) tset.add(clip.intro);
    const times = [...tset].sort((x, y) => x - y);
    const states = times.map(t => sampleState(clip, t));
    const segs = clipSegments(clip);
    let css = '';
    const rules = [];
    // 一条属性按段各出一组关键帧；valueAt(i) 把第 i 个采样点变成一条声明
    const emitSeg = (baseName, smooth, valueAt) => segs.map(seg => {
      const idx = [];
      times.forEach((t, i) => { if (t >= seg.t0 && t <= seg.t1) idx.push(i); });
      const span = seg.t1 - seg.t0;
      let kf = '', prev = '', prevWritten = true;
      idx.forEach((i, k) => {
        const d = valueAt(i);
        // 平滑层：值没变的那一格也要把上一格补写出来，否则 linear 会把「停住」也插值成慢慢滑
        if (smooth && d !== prev && !prevWritten && k > 0) kf += `${pct(times[idx[k - 1]] - seg.t0, span)}{${prev}}`;
        const write = k === 0 || k === idx.length - 1 || d !== prev;
        if (write) kf += `${pct(times[i] - seg.t0, span)}{${d}}`;
        prevWritten = write;
        prev = d;
      });
      const name = baseName + seg.sfx;
      css += `@keyframes ${name}{${kf}}\n`;
      return `${name} ${span}ms ${smooth ? 'linear' : 'step-end'}${seg.delay} ${seg.iter}${seg.fill}`;
    });
    for (const part of PARTS) {
      const tc = touches(clip, part);
      tc.pos = tc.pos || propAttachedPos(clip, part);
      if (!tc.pos && !tc.f && !tc.z && !tc.sc && !tc.r && !tc.a) continue;
      // 位移、换帧、层级各拆成一条动画：各自只在自己的值变化时写关键帧，
      // 不然每次挪一格都要把整串 box-shadow 再抄一遍，CSS 会胖好几倍
      const anims = [];
      const px = v => +(v * PX).toFixed(2);
      const sm = clip.smooth.has(part) || (clip.smooth.has('upper') && UPPER_KIDS.has(part));
      // 平滑层在隐藏的那一格保持上一次看得见时的位置：不然「藏起来 + 位置归零」会被插值成一道往左下角飞走的线
      const vis = [];
      let lastVis = { dx: 0, dy: 0 };
      states.forEach((s, i) => { const st = s[part]; if (st.f || !sm) lastVis = st; vis[i] = sm ? lastVis : st; });
      const emit = (suffix, fn, smooth = false, usePos = false) =>
        anims.push(...emitSeg(`clr-${clip.id}-${part}-${suffix}`, smooth, i => fn(usePos ? vis[i] : states[i][part])));
      // 位置用 left / top，不用 transform：transform 动画在合成线程上跑，换帧的 box-shadow 在主线程上跑，
      // 两边会差一帧——道具出现的那一帧先在原点（Clawd 框左上角）画出来，下一帧才跳到该在的位置，
      // 肉眼看就是「从左上角飞进来」（Lulu 2026-09-24 看到的伸懒腰眼泪）。left / top 和 box-shadow 同一次样式计算里生效。
      // 符号的缩放、旋转仍然用独立的 scale / rotate 属性，围着符号自己的中心转。
      if (tc.pos) emit('t', q => `left:${px(q.dx)}px;top:${px(q.dy)}px`, sm, true);
      if (tc.f) emit('f', st => `box-shadow:${boxShadow(part, st.f)}`);
      if (tc.z) emit('z', st => `z-index:${st.z}`);
      // 缩放、旋转、不透明度：都是平滑变化（它们不改像素网格上的图，只是整张图的大小、角度、深浅）
      if (tc.sc) emit('s', st => `scale:${st.sc}`, true);
      if (tc.r) emit('r', st => `rotate:${st.r}deg`, true);
      if (tc.a) emit('a', st => `opacity:${st.a}`, true);
      const base = part === 'eyes' ? 'clr-blink 4400ms step-end infinite, ' : '';
      rules.push(`${RB}[data-clawd-clip="${clip.id}"] .clr-p-${part}{animation:${base}${anims.join(', ')}}`);
    }
    // 整体平移（走路）；没有平移也生成一条，用来接 animationend
    const rs = clip.smooth.has('root');
    const rootAnims = emitSeg(`clr-${clip.id}-root`, rs,
      i => `transform:translate(${+(states[i].root.dx * PX).toFixed(2)}px,${+(states[i].root.dy * PX).toFixed(2)}px)`);
    rules.push(`${RB}[data-clawd-clip="${clip.id}"] .clr-root{animation:${rootAnims.join(', ')}}`);
    if (clip.flexKeys.length) {
      // 弹性层也按节拍一格一格跳（step-end），不再平滑插值：平滑的缩放叠在一格一格跳的像素上，两个钟对不齐，看起来就是抖
      const flexAnims = emitSeg(`clr-${clip.id}-flex`, false, i => `transform:${flexCSS(flexAt(clip, times[i]))}`);
      rules.push(`${RB}[data-clawd-clip="${clip.id}"] .clr-flex{animation:${flexAnims.join(', ')}}`);
    }
    if (clip.clipGround) rules.push(groundClipRule(clip));
    return css + rules.join('\n') + '\n';
  }

  /* 躲进输入框：骨架画布里地面线以下的部分剪掉，看起来就是缩到输入框后面。
     clip-path 挂在不做位移的骨架外框上（原型里是 rig 元素，扩展里是 clawd-rig 元素），所以剪切线不跟着身体一起往下走。 */
  function groundClipRule(clip) {
    const bottom = PX - (BOX[1] + 10) * PX;
    return `${RB}[data-clawd-clip="${clip.id}"] > .clawd-rig{clip-path:inset(-200px -200px ${bottom}px -200px)}`;
  }
  const FLEX_ID = { sx: 1, sy: 1, r: 0, tx: 0, ty: 0 };
  const flexCSS = v => `translate(${+(v.tx * PX).toFixed(2)}px,${+(v.ty * PX).toFixed(2)}px) rotate(${v.r}deg) scale(${v.sx},${v.sy})`;
  /* 某一时刻的弹性值：关键点之间按缓入缓出插值，出帧时再按节拍取样 */
  function flexAt(clip, t) {
    const ks0 = clip.flexKeys;
    if (!ks0.length) return FLEX_ID;
    const tail = clip.loop ? ks0[ks0.length - 1][1] : FLEX_ID;   // 循环动作（如歪头）最后一个值一直保持到循环结束
    const ks = [...(ks0[0][0] === 0 ? [] : [[0, FLEX_ID]]), ...ks0, ...(ks0[ks0.length - 1][0] === clip.dur ? [] : [[clip.dur, tail]])];
    let i = 0;
    while (i + 1 < ks.length && ks[i + 1][0] <= t) i++;
    const [t0, a] = ks[i], nx = ks[i + 1];
    if (!nx) return a;
    const p = EASE.io((t - t0) / (nx[0] - t0)), b = nx[1];
    const m = k => +(a[k] + (b[k] - a[k]) * p).toFixed(3);
    return { sx: m('sx'), sy: m('sy'), r: m('r'), tx: m('tx'), ty: m('ty') };
  }
  const FLEX_ORIGIN = [(BOX[0] + 8) * PX, (BOX[1] + 10) * PX];   // 脚底中点

  function genRestCSS() {
    let css = `${RB}{--clr-ink:color-mix(in srgb, var(--cl-ink, #121212) 60%, #7a6a5c)}\n`;
    for (const part of PARTS) {
      css += `${RB} .clr-p-${part}{z-index:${REST_Z[part]};box-shadow:${boxShadow(part, REST_F[part])}}\n`;
    }
    // 基础眨眼：4.4 秒一轮，不被动作占用眼睛帧的时候一直在跑
    const o = boxShadow('eyes', 'open'), h = boxShadow('eyes', 'half'), s = boxShadow('eyes', 'shut');
    css += `@keyframes clr-blink{0%{box-shadow:${o}}${pct(4000, 4400)}{box-shadow:${h}}${pct(4100, 4400)}{box-shadow:${s}}${pct(4200, 4400)}{box-shadow:${h}}${pct(4300, 4400)}{box-shadow:${o}}100%{box-shadow:${o}}}\n`;
    // 待机呼吸：只有两只钳子起伏，平滑地抬 1 格再放下，身体和眼睛不动（Lulu 2026-09-24 定）。
    //   整只上下沉一格像深蹲；整只细微缩放在输入框那个尺寸下不到 1 屏幕像素，看不出来，所以都不用。
    //   钳子以前是一格一格跳（step-end），看着卡，现在走平滑缓动；代价是中途落在半格上，边缘会略虚。
    const B = 3200, in0 = 1400, in1 = 2600;
    css += `@keyframes clr-breathe-claw{0%{transform:translate(0,0)}${pct(in0, B)}{transform:translate(0,-${PX}px)}${pct(in1, B)}{transform:translate(0,0)}100%{transform:translate(0,0)}}\n`;
    css += `${RB} .clr-p-eyes{animation:clr-blink 4400ms step-end infinite}\n`;
    css += `${RB} .clr-p-sym{transform-origin:${(BOX[0] + ORIGIN.sym[0] + .5) * PX}px ${(BOX[1] + ORIGIN.sym[1] + 2.5) * PX}px}\n`;
    css += `${RB} .clr-flex{position:absolute;left:0;top:0;transform-origin:${FLEX_ORIGIN[0]}px ${FLEX_ORIGIN[1]}px}\n`;
    css += `${RB} .clr-p-clawL,${RB} .clr-p-clawR{animation:clr-breathe-claw ${B}ms ease-in-out infinite}\n`;
    // 播动作时呼吸停掉（动作自己管身体），只留眨眼；动作规则写在后面，会覆盖这几条
    css += `${RB}[data-clawd-clip] .clr-p-body,${RB}[data-clawd-clip] .clr-p-clawL,${RB}[data-clawd-clip] .clr-p-clawR,${RB}[data-clawd-clip] .clr-flex{animation:none}\n${RB}[data-clawd-clip] .clr-p-eyes{animation:clr-blink 4400ms step-end infinite}\n`;
    return css;
  }
  /* ════════════════════════════════════════════════════════════════════
     6. 动作表
        坐标都是美术像素，相对各层的静止位置。y 向下为正。
        每个非循环动作：第 0 帧和最后一帧必须和待机逐像素一致（自检会查）。
     ════════════════════════════════════════════════════════════════════ */
  const CLIPS = {};
  const def = c => (CLIPS[c.id] = c);

  /* 腿的小碎步：走路时每 150ms 换一格 */
  function scuttle(c, t0, t1) {
    const cyc = ['walkA', 'stand', 'walkB', 'stand'];
    for (let t = t0, i = 0; t < t1; t += 150, i++) c.at(t, 'legs', { f: cyc[i % 4] });
    c.at(t1, 'legs', { f: 'stand' });
  }
  /* 横着走：每 300ms 迈一步——抬腿那一帧同时整只挪 1 格，落腿那一帧站稳。挪动和迈腿对齐，就不会像在冰上滑 */
  function scuttleMove(c, t0, x0, x1) {
    const dir = Math.sign(x1 - x0), n = Math.abs(x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 300;
      c.at(t, 'legs', { f: i % 2 ? 'walkB' : 'walkA' }).at(t, 'root', { x: x0 + dir * (i + 1) });
      c.at(t + 200, 'legs', { f: 'stand' });
    }
    return t0 + n * 300;
  }
  /* 举钳 / 放钳：中间补一帧（钳子先沿身侧滑到一半高度），不再从身侧一下跳到头顶 */
  function raise(c, t, claw) { c.at(t - 100, claw, { f: 'stub', y: -3 }).at(t, claw, { f: 'up', y: 0 }); }
  function lower(c, t, claw) { c.at(t, claw, { f: 'stub', y: -3 }).at(t + 100, claw, { y: 0 }); }
  /* 头顶符号：弹出来（先小 → 放大过头 → 回正）→ 各自的小动作 → 淡出。
     位置、缩放、旋转、不透明度都是平滑变化（符号是整张图在动，不改像素网格）。
     以前只是出现、每 100ms 往上跳一格、闪两下消失，所以看着没什么动画。 */
  const SYM_STYLE = {
    heart: { first: 'heart', rise: 3, wob: 8, wobT: 300 },   // 边飘边左右轻摆
    note:  { first: 'note', rise: 3, wob: 14, wobT: 200 },   // 跟着节拍晃
    bang:  { first: 'bang', big: true, shake: 10 },           // 猛地弹出来，抖两下
    q:     { first: 'q', tilt: true },                        // 歪头一样左右倾
    spark: { first: 'sparkS', spin: true },                   // 大小交替闪，同时转 90°
    dots:  { first: 'dots1', typing: true },                  // 一个点一个点冒出来
    tilde: { first: 'tilde', rise: 1, sway: true },           // 左右荡
    z:     { first: 'z', rise: 5, drift: 2, wob: 6, wobT: 400 }, // 睡觉：边往上飘边往右漂
    vein:  { first: 'vein', pulse: true },                    // 生气：一跳一跳
    sweat: { first: 'sweat', fall: 2 },                       // 汗：往下滑
  };
  function sym(c, t, kind, { x = 0, y = 0, dur = 900 } = {}) {
    const st = SYM_STYLE[kind];
    c.smooth.add('sym');
    const t1 = t + dur;
    c.at(t, 'sym', { f: st.first, x, y, a: 1, sc: st.big ? .3 : .5, r: 0 });
    c.at(t + 100, 'sym', { sc: st.big ? 1.4 : 1.25 }, 'out');
    c.at(t + 200, 'sym', { sc: 1 }, 'io');
    if (st.rise) c.at(t + 200, 'sym', { y }).at(t1, 'sym', { y: y - st.rise }, 'out');
    if (st.wob) for (let k = t + 200, i = 0; k + st.wobT <= t1 - 200; k += st.wobT, i++) c.at(k + st.wobT, 'sym', { r: i % 2 ? -st.wob : st.wob }, 'io');
    if (st.shake) { [0, 1, 2, 3].forEach(i => c.at(t + 300 + i * 100, 'sym', { r: i % 2 ? -st.shake : st.shake }, 'io')); c.at(t + 700, 'sym', { r: 0 }, 'io'); }
    if (st.tilt) c.at(t + 300, 'sym', { r: -15 }, 'io').at(t + 500, 'sym', { r: 10 }, 'io').at(t + 700, 'sym', { r: 0 }, 'io');
    if (st.spin) { for (let k = t + 100, i = 0; k < t1; k += 100, i++) c.at(k, 'sym', { f: i % 2 ? 'sparkS' : 'spark' }); c.at(t1, 'sym', { r: 90 }, 'lin'); }
    if (st.typing) for (let k = t, i = 0; k < t1 - 200; k += 300, i++) c.at(k, 'sym', { f: ['dots1', 'dots2', 'dots'][i % 3] });
    if (st.sway) c.at(t + 300, 'sym', { x: x + 1 }, 'io').at(t + 600, 'sym', { x: x - 1 }, 'io').at(t + 900, 'sym', { x }, 'io');
    if (st.drift) c.at(t + 200, 'sym', { x }).at(t1, 'sym', { x: x + st.drift }, 'io');
    if (st.fall) c.at(t + 200, 'sym', { y }).at(t1, 'sym', { y: y + st.fall }, 'in');
    if (st.pulse) for (let k = t + 300, i = 0; k < t1 - 300; k += 300, i++) c.at(k, 'sym', { sc: i % 2 ? 1 : 1.3 }, 'io');
    // 淡出：最后 300ms
    c.at(t1 - 300, 'sym', { a: 1 }).at(t1, 'sym', { a: 0, f: null }, 'io');
    c.at(t1 + 100, 'sym', { a: 1, sc: 1, r: 0 });   // 看不见了再把数值归位
  }
  /* 道具淡出：t0 开始变淡，t1 完全看不见，然后藏起来（位置不归零，隐藏时本来就看不见） */
  function fadeOut(c, part, t0, t1) {
    c.at(t0, part, { a: 1 }).at(t1, part, { a: 0, f: null }, 'io').at(t1 + 100, part, { a: 1 });
  }
  /* 跳一下：整只（连腿）离地，影子留在地上变小。蓄力压扁 → 起跳拉长 → 最高点 → 下落 → 落地压扁 → 站稳，6 拍。
     以前是只把上半身抬 1 格，腿留在原地，身体和腿之间会露出一条缝，而且没有蓄力和落地，看起来是「闪」一下 */
  function hop(c, t, h = 2) {
    c.flex(t - 100, {}).flex(t, { sx: 1.1, sy: .9 });
    c.at(t + 100, 'root', { y: -1 }, 'io').at(t + 100, 'shadow', { y: 1, f: 'w10' }, 'io').flex(t + 100, { sx: .92, sy: 1.1 });
    c.at(t + 200, 'root', { y: -h }, 'io').at(t + 200, 'shadow', { y: h, f: 'w8' }, 'io').flex(t + 200, { sx: .97, sy: 1.03 });
    c.at(t + 300, 'root', { y: -1 }, 'io').at(t + 300, 'shadow', { y: 1, f: 'w10' }, 'io').flex(t + 300, {});
    c.at(t + 400, 'root', { y: 0 }, 'io').at(t + 400, 'shadow', { y: 0, f: 'w12' }, 'io').flex(t + 400, { sx: 1.08, sy: .92 });
    c.flex(t + 500, {});
    return t + 500;
  }
  /* 手动眨一次眼（动作占用了眼睛帧时，基础眨眼会被盖住） */
  function blink(c, t, back = 'open') {
    c.at(t, 'eyes', { f: 'half' }).at(t + 100, 'eyes', { f: 'shut' }).at(t + 200, 'eyes', { f: 'half' }).at(t + 300, 'eyes', { f: back });
  }

  /* ── 擦杯子 ─────────────────────────────────────────────── */
  {
    const c = def(new Clip('polish', '擦杯子', 9000, { pool: true, cool: 40000, smooth: ['root', 'shadow'] }));
    c.beat(0, '低头，左钳把杯子拿到胸前').beat(900, '右钳拿布，绕圈擦').beat(5000, '举起来对着看').beat(5900, '闪一下，满意地蹦一下').beat(6900, '放下，收走').beat(8000, '点头，回到待机');
    c.at(300, 'eyes', { x: -1, y: 1 });
    c.to(300, 450, 'clawL', { x: 1, y: 1 }).at(300, 'clawL', { f: 'front' });
    // 杯子挂在左钳上：左钳在 (1,1) 时杯子左上角落在 (2,5)，左钳正好捏住杯把
    c.at(400, 'propA', { f: 'mug', x: 1, y: 5, att: 'clawL' }).at(500, 'propA', { y: 4 });
    c.at(600, 'clawR', { f: 'front' }).to(600, 900, 'clawR', { x: -6, y: 1 });
    // 布挂在右钳上：右钳在 (-6,1) 时布盖住杯身
    c.at(900, 'propB', { f: 'cloth', x: 11, y: 4, att: 'clawR' });
    c.at(1000, 'eyes', { f: 'half' });
    const circle = [{ x: -6, y: 1 }, { x: -7, y: 2 }, { x: -6, y: 3 }, { x: -5, y: 2 }];
    for (let i = 0; i < 20; i++) c.at(1000 + i * 200, 'clawR', circle[i % 4]);
    sym(c, 2600, 'note', { x: 4, y: 1 });
    c.at(5000, 'clawR', { x: -6, y: 1 }).at(5100, 'propB', { f: null, x: 0, y: 0, att: null });
    c.to(5100, 5400, 'clawR', { x: 0, y: 0 }).at(5400, 'clawR', { f: 'stub' });
    c.to(5200, 5700, 'clawL', { x: 0, y: -2 });
    c.at(5500, 'eyes', { f: 'open', x: -1, y: 0 });
    sym(c, 5900, 'spark', { x: -6, y: 7, dur: 800 });
    c.at(6000, 'eyes', { f: 'shut', x: 0 });
    hop(c, 6200, 1);
    c.to(6900, 7400, 'clawL', { x: 1, y: 1 });
    c.at(7600, 'propA', { f: null, x: 0, y: 0, att: null });
    c.at(7600, 'clawL', { x: 0, y: 0, f: 'stub' });
    c.at(7600, 'eyes', { f: 'open', x: 0, y: 0 });
    c.at(8000, 'upper', { y: 1 }).at(8200, 'upper', { y: 0 });
    blink(c, 8500);
  }

  /* ── 吃饭 ───────────────────────────────────────────────── */
  {
    const c = def(new Clip('eat', '吃饭', 8400, { pool: true, cool: 60000 }));
    c.beat(0, '低头，左钳端出饭碗').beat(700, '右钳拿起筷子（钳子留在身体右边）').beat(1100, '夹一口 → 抬起来 → 嚼（×3）').beat(5600, '碗空了，冒个心').beat(6000, '收筷子、收碗').beat(6900, '拍拍肚子');
    c.at(200, 'eyes', { y: 1 });
    c.at(300, 'clawL', { f: 'front' }).to(300, 500, 'clawL', { x: 3, y: 2 });
    // 碗左上角落在 (5,6)，碗底贴地：左钳 (3,2) 时挂载基点是 (2,4)
    c.at(500, 'propA', { f: 'bowl', x: 3, y: 6, att: 'clawL' }).at(600, 'propA', { y: 5 });
    // 右钳不横过脸，一直在身体右侧外面上下动；筷子右上角贴着钳子左下角，往左下斜插进碗（Lulu 2026-09-24 改）
    c.to(700, 900, 'clawR', { y: -2 });
    c.at(900, 'propB', { f: 'chop', x: 10, y: 6, att: 'clawR', z: 6 });
    for (let i = 0; i < 3; i++) {
      const T = 1100 + i * 1500;
      c.to(T, T + 200, 'clawR', { y: -1 });
      c.at(T + 300, 'propB', { f: 'chopRice' });
      // 夹起来：筷子提到碗前面（压在碗上画），米粒露出来；只抬 3 格，筷子不会挡到右眼
      c.to(T + 400, T + 700, 'clawR', { y: -3 }).at(T + 400, 'propB', { z: 8 });
      c.at(T + 700, 'propB', { f: 'chop', z: 6 }).at(T + 700, 'eyes', { f: 'shut', y: 0 });
      c.at(T + 800, 'upper', { y: 1 }).at(T + 900, 'upper', { y: 0 }).at(T + 1000, 'upper', { y: 1 }).at(T + 1100, 'upper', { y: 0 });
      c.at(T + 1300, 'eyes', { f: 'open', y: 1 });
      c.to(T + 1300, T + 1450, 'clawR', { y: -2 });
    }
    c.at(5600, 'propA', { f: 'bowlEmpty' });
    c.at(5800, 'eyes', { f: 'happy', y: 0 });
    sym(c, 5800, 'heart', { dur: 1000 });
    c.at(6000, 'propB', { f: null, x: 0, y: 0, att: null, z: 8 });
    c.to(6000, 6300, 'clawR', { y: 0 });
    c.at(6500, 'propA', { f: null, x: 0, y: 0, att: null });
    c.to(6500, 6700, 'clawL', { x: 0, y: 0 }).at(6700, 'clawL', { f: 'stub' });
    c.at(6900, 'clawR', { f: 'front', x: -2, y: 1 }).at(7100, 'clawR', { y: 2 }).at(7300, 'clawR', { y: 1 }).at(7500, 'clawR', { y: 2 })
     .at(7700, 'clawR', { f: 'stub', x: 0, y: 0 });
    c.at(7800, 'eyes', { f: 'open' });
  }

  /* ── 读信 ───────────────────────────────────────────────── */
  {
    const c = def(new Clip('letter', '读信', 8800, { cool: 60000, smooth: ['propA', 'propB'] }));
    c.beat(0, '「！」——头顶掉下来一封信').beat(800, '双钳接住，身子一沉').beat(1400, '拆开，信纸升起来').beat(2600, '逐行读（眼睛从左扫到右 ×3）').beat(5400, '开心，左右晃').beat(6600, '叠好，塞到身后');
    sym(c, 100, 'bang', { x: 6, y: 2, dur: 700 });
    c.at(100, 'eyes', { f: 'open', y: -1 });   // 不用大眼（Lulu 2026-09-24 改）
    c.at(200, 'propA', { f: 'env', x: 4, y: -14, att: 'upper' }).to(200, 800, 'propA', { y: 3 }, 'in');
    c.at(500, 'clawL', { f: 'front' }).to(500, 750, 'clawL', { x: 2, y: -1 });
    c.at(500, 'clawR', { f: 'front' }).to(500, 750, 'clawR', { x: -2, y: -1 });
    c.at(800, 'upper', { y: 1 }).at(1000, 'upper', { y: 0 });
    c.at(1000, 'eyes', { f: 'open', y: 1 });
    c.at(1400, 'propA', { f: 'envOpen' });
    c.at(1700, 'propB', { f: 'letter', x: 4, y: 2, z: 6, att: 'upper' }).to(1700, 2300, 'propB', { y: -7 });
    c.at(1900, 'eyes', { y: 0 }).at(2200, 'eyes', { y: -1 });
    c.at(2300, 'propA', { f: null, x: 0, y: 0, att: null }).at(2300, 'propB', { z: 8 });
    c.to(2300, 2500, 'clawL', { x: 2, y: -5 }).to(2300, 2500, 'clawR', { x: -3, y: -5 });
    [2600, 3500, 4400].forEach(T => c.at(T, 'eyes', { x: -1 }).at(T + 300, 'eyes', { x: 0 }).at(T + 600, 'eyes', { x: 1 }));
    c.at(5400, 'eyes', { f: 'happy', x: 0 });
    sym(c, 5400, 'heart', { x: 7, y: 2, dur: 1000 });
    c.at(5500, 'upper', { x: -1 }).at(5800, 'upper', { x: 1 }).at(6100, 'upper', { x: -1 }).at(6400, 'upper', { x: 0 });
    c.at(6600, 'propB', { f: 'letterFold', x: 5, y: -2 });
    c.to(6600, 6800, 'clawL', { x: 2, y: -3 }).to(6600, 6800, 'clawR', { x: -2, y: -3 });
    c.at(7000, 'propB', { z: 2 }).to(7000, 7400, 'propB', { y: 2 });
    c.at(7400, 'propB', { f: null, x: 0, y: 0, z: 8, att: null });
    c.to(7200, 7500, 'clawL', { x: 0, y: 0 }).at(7500, 'clawL', { f: 'stub' });
    c.to(7200, 7500, 'clawR', { x: 0, y: 0 }).at(7500, 'clawR', { f: 'stub' });
    c.at(7500, 'eyes', { x: 0, y: 0 });
    blink(c, 7900);
  }

  /* ── 种节点 ─────────────────────────────────────────────── */
  {
    const c = def(new Clip('plant', '种节点', 8400, { pool: true, cool: 90000, smooth: ['root', 'shadow'] }));
    c.beat(0, '右钳拿出一颗种子').beat(600, '右钳放低，贴着身体把种子放到地上').beat(1100, '拍两下').beat(2300, '等……').beat(3200, '长出一株节点树').beat(4200, '转过去看').beat(4600, '举钳欢呼').beat(6400, '节点散成点，飘走');
    c.at(100, 'eyes', { x: 1 });
    c.to(100, 300, 'clawR', { y: -1 });
    // 种子在右钳边上：右钳 (0,-1) 时种子在 (16,4)
    c.at(300, 'propA', { f: 'seed', x: 16, y: 5, att: 'clawR', z: 3 });
    // 身体不歪；右钳换成贴地的一块，挨着身体右下角（Lulu 2026-09-24 改）
    c.at(700, 'clawR', { f: 'low', x: 0, y: 0 }).at(700, 'propA', { x: 17, y: 8 });
    c.at(700, 'eyes', { y: 1 });
    c.at(1000, 'propA', { x: 17, y: 8, att: null });
    c.at(1100, 'clawR', { y: -1 }).at(1300, 'clawR', { y: 0 }).at(1500, 'clawR', { y: -1 }).at(1700, 'clawR', { y: 0 });
    c.at(1800, 'clawR', { f: 'stub', y: 0 });
    sym(c, 2200, 'dots', { x: 5, dur: 900 });
    blink(c, 2700);
    c.at(3200, 'propA', { f: null, x: 0, y: 0, z: 7 });
    c.at(3200, 'propB', { f: 'p1', x: 18, y: 9, z: 3 }).at(3500, 'propB', { f: 'p2' }).at(3800, 'propB', { f: 'p3' }).at(4200, 'propB', { f: 'p4' });
    c.at(3500, 'eyes', { y: 0 }).at(3800, 'eyes', { y: -1 });
    // 长好了：不用大眼，身子转向它（左边一列暗部），眼睛看过去（Lulu 2026-09-24 改）
    c.at(4200, 'body', { f: 'turnR' }).at(4200, 'eyes', { f: 'open', x: 1, y: 0 });
    c.at(4500, 'eyes', { f: 'happy', x: 0, y: 0 });
    sym(c, 4400, 'spark', { x: 11, y: 6, dur: 700 });
    c.at(4600, 'body', { f: 'stand' });
    raise(c, 4600, 'clawL'); raise(c, 4600, 'clawR');
    hop(c, 4600);
    lower(c, 5300, 'clawL'); lower(c, 5300, 'clawR');
    blink(c, 5900);
    c.at(6400, 'propB', { f: 'd1' }).at(6600, 'propB', { f: 'd2' }).at(6800, 'propB', { f: 'd3' }).at(7000, 'propB', { f: null, x: 0, y: 0, z: 8 });
    c.at(6400, 'eyes', { f: 'open', x: 1, y: -1 });
    c.at(7000, 'eyes', { x: 0, y: 0 });
    c.at(7400, 'eyes', { f: 'shut' }).at(7900, 'eyes', { f: 'open' });
  }

  /* ── 追蝴蝶 ─────────────────────────────────────────────── */
  {
    const c = def(new Clip('butterfly', '追蝴蝶', 9000, { pool: true, cool: 90000, smooth: ['propA'] }));
    c.beat(0, '一只蝴蝶飞进来，眼睛跟着转').beat(3300, '伸钳去抓——扑空').beat(4900, '它落在头顶上，一动不敢动').beat(6700, '飞走了，挥钳送别');
    const path = [[100, -8, -10], [600, -3, -6], [1200, 1, -9], [1800, 5, -5], [2400, 9, -8], [3000, 14, -4], [3500, 15, 0],
      [3800, 17, -9], [4300, 11, -10], [4900, 8, -4], [5300, 8, -1]];
    path.forEach(([t, x, y], i) => (i === 0 ? c.at(t, 'propA', { x, y }) : c.to(path[i - 1][0], t, 'propA', { x, y }, 'io')));
    c.at(100, 'propA', { z: 9 });
    for (let t = 100, i = 0; t < 5300; t += 100, i++) c.at(t, 'propA', { f: i % 2 ? 'bfDn' : 'bfUp' });
    c.at(5300, 'propA', { f: 'bfRest' }).at(5900, 'propA', { f: 'bfUp' }).at(6000, 'propA', { f: 'bfRest' });
    c.to(6700, 7200, 'propA', { x: 12, y: -8 }).to(7200, 7800, 'propA', { x: 18, y: -12 }).to(7800, 8300, 'propA', { x: 25, y: -16 });
    for (let t = 6700, i = 0; t < 8400; t += 100, i++) c.at(t, 'propA', { f: i % 2 ? 'bfDn' : 'bfUp' });
    fadeOut(c, 'propA', 7700, 8300);   // 飞远时淡出（Lulu 2026-09-24）
    c.at(100, 'eyes', { x: -1, y: -1 }).at(1500, 'eyes', { x: 0 }).at(2600, 'eyes', { x: 1, y: 0 }).at(3000, 'eyes', { y: 0 });
    // 伸钳：钳子沿身体右侧直直举到顶，不画斜胳膊（Lulu 2026-09-24 第二轮改）
    c.at(3200, 'clawR', { y: -2 }).at(3300, 'clawR', { y: -4 }).at(3300, 'eyes', { y: -1 });
    c.at(3800, 'clawR', { y: -2 }).at(3900, 'clawR', { y: 0 });
    c.at(3800, 'eyes', { f: 'squint', x: 0, y: 0 }).at(4200, 'eyes', { f: 'open', x: 0, y: -1 });
    sym(c, 3900, 'dots', { x: 5, dur: 800 });
    c.at(5300, 'eyes', { x: 0, y: -1 });
    c.at(5600, 'eyes', { f: 'half' }).at(5800, 'eyes', { f: 'shut' }).at(6100, 'eyes', { f: 'half' }).at(6300, 'eyes', { f: 'open' });
    c.at(6800, 'eyes', { x: 1 }).at(7300, 'eyes', { x: 0 });
    raise(c, 7000, 'clawR');
    c.at(7200, 'clawR', { y: 1 }).at(7400, 'clawR', { y: 0 }).at(7600, 'clawR', { y: 1 }).at(7800, 'clawR', { y: 0 });
    lower(c, 8000, 'clawR');
    c.at(8400, 'eyes', { f: 'shut', x: 0, y: 0 }).at(8800, 'eyes', { f: 'open' });
  }

  /* ── 伸懒腰 ─────────────────────────────────────────────── */
  function stretchBody(c, O) {
    c.at(O + 100, 'eyes', { f: 'half' });
    c.at(O + 200, 'upper', { y: 1 }).at(O + 200, 'legs', { f: 'crouch' });
    c.at(O + 450, 'upper', { y: 0 }).at(O + 450, 'legs', { f: 'stand' }).at(O + 450, 'body', { f: 'tall' });   // 身体往上长一格，脚不离地（以前上半身抬 1 格，和腿之间会露缝）
    raise(c, O + 450, 'clawL'); raise(c, O + 450, 'clawR');
    c.at(O + 450, 'eyes', { f: 'shut' });
    c.at(O + 450, 'shadow', { f: 'w10' });
    sym(c, O + 600, 'tilde', { y: -1, dur: 1000 });
    c.at(O + 1800, 'body', { f: 'stand' }).at(O + 1800, 'upper', { y: 0 }).at(O + 1800, 'shadow', { f: 'w12' });
    c.at(O + 1800, 'clawL', { f: 'stub', y: -3 }).at(O + 1800, 'clawR', { f: 'stub', y: -3 });
    c.at(O + 1900, 'clawL', { y: 0 }).at(O + 1900, 'clawR', { y: 0 });
    // 坐得更扁：身体只剩 4 格加一条暗部，腿只露一格（Lulu 2026-09-24 改）
    c.at(O + 2000, 'body', { f: 'squash2' }).at(O + 2000, 'legs', { f: 'crouch' }).at(O + 2000, 'eyes', { f: 'half', y: 3 }).at(O + 2000, 'shadow', { f: 'w14' });
    c.at(O + 2300, 'body', { f: 'stand' }).at(O + 2300, 'legs', { f: 'stand' }).at(O + 2300, 'eyes', { y: 0 }).at(O + 2300, 'shadow', { f: 'w12' });
    c.at(O + 2400, 'propA', { f: 'tear', x: 3, y: 3, att: 'upper' }).at(O + 2600, 'propA', { y: 4 }).at(O + 2800, 'propA', { y: 5 }).at(O + 3000, 'propA', { f: null, x: 0, y: 0, att: null });
    c.at(O + 2600, 'eyes', { f: 'open' });
    // 结尾原来有「往下一沉再弹起来」，接在坐扁后面看着像又深蹲一下，去掉（Lulu 2026-09-24）
    // 弹性层：原版伸懒腰 Q 弹的做法——整只做平滑的挤压 / 拉伸，每个停点都冲过头一点再回来
    c.flex(O + 200, { sx: 1.08, sy: .9 })
     .flex(O + 450, { sx: .86, sy: 1.18 }).flex(O + 700, { sx: .94, sy: 1.08 })
     .flex(O + 1000, { sx: .94, sy: 1.08, r: -4 }).flex(O + 1300, { sx: .94, sy: 1.08, r: 4 }).flex(O + 1600, { sx: .94, sy: 1.08, r: 0 })
     .flex(O + 1800, {}).flex(O + 2000, { sx: 1.2, sy: .8 }).flex(O + 2200, { sx: .93, sy: 1.07 }).flex(O + 2350, { sx: 1.03, sy: .97 }).flex(O + 2500, {});
  }
  {
    const c = def(new Clip('stretch', '伸懒腰', 3200, { cool: 30000, smooth: ['root', 'shadow'], group: 'sleep' }));
    c.beat(0, '蹲一下蓄力').beat(450, '双钳举过头，身体抻长，左右晃').beat(1800, '松下来，一屁股坐扁').beat(2300, '挤出一滴眼泪');
    stretchBody(c, 0);
  }

  /* ── 踱步（平滑）─────────────────────────────────────────
     身体匀速平滑地走（不按格跳），每迈一步轻轻上下颠不到半格；腿仍然按节拍换帧。
     2D 游戏里的常规做法：位置按屏幕帧率连续移动，角色动画帧按自己的节奏一格一格换。 */
  function glide(c, t0, x0, x1) {
    const n = Math.abs(x1 - x0), t1 = t0 + n * 300;
    c.at(t0, 'root', { x: x0 }).at(t1, 'root', { x: x1 }, 'lin');
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 300;
      c.at(t, 'legs', { f: i % 2 ? 'walkB' : 'walkA' }).at(t + 200, 'legs', { f: 'stand' });
      c.at(t + 100, 'root', { y: -0.34 }, 'io').at(t + 300, 'root', { y: 0 }, 'io');
    }
    c.at(t1, 'legs', { f: 'stand' });
    return t1;
  }
  {
    const c = def(new Clip('walk', '踱步', 10000, { pool: true, cool: 45000, smooth: ['root'] }));
    // 停下只回头看一眼就走，不再完整张望、不冒「？」（和东张西望重复，Lulu 2026-09-24）
    c.beat(0, '转向左，横着走 8 格').beat(2500, '停下，回头看一眼').beat(3100, '转向右，走过头 6 格').beat(7300, '回头看一眼').beat(7800, '走回原位');
    c.at(100, 'body', { f: 'turnL' }).at(100, 'eyes', { x: -1 });
    const e1 = glide(c, 100, 0, -8);
    c.at(e1, 'body', { f: 'stand' }).at(e1, 'eyes', { x: 0 }).at(e1 + 100, 'eyes', { x: 1 }).at(e1 + 500, 'eyes', { x: 0 });
    c.at(e1 + 600, 'body', { f: 'turnR' }).at(e1 + 600, 'eyes', { x: 1 });
    const e2 = glide(c, e1 + 600, -8, 6);
    c.at(e2, 'body', { f: 'stand' }).at(e2, 'eyes', { x: 0 }).at(e2 + 200, 'eyes', { x: -1 });
    c.at(e2 + 500, 'body', { f: 'turnL' });
    const e3 = glide(c, e2 + 500, 6, 0);
    c.at(e3, 'body', { f: 'stand' }).at(e3, 'eyes', { x: 0 });
  }

  /* ════════════════════════════════════════════════════════════════════
     生成（A 轨）
     2026-09-24 Lulu：「思考」去掉——一按发送就直接进写字，所以写字自带一段「拿出纸笔」的进场。
     生成超过 12 秒坐下接着写；结束有三种：完成、停止、出错，各有站着 / 坐着两个版本。
     ════════════════════════════════════════════════════════════════════ */
  const WRITE_POSE = c => t => {
    c.at(t, 'eyes', { f: 'open', x: 1, y: 1 });
    c.at(t, 'clawR', { x: 1, y: 2 });
    // 笔尖贴在纸面上：右钳 (1,2) 时笔尖在 (17,7)
    c.at(t, 'propA', { f: 'quill', x: 16, y: 5, att: 'clawR' });
    c.at(t, 'propB', { f: 'sheet0', x: 17, y: 9, z: 6, a: 1 });
  };
  /* 睡姿：上半身沉 2 格，把腿整个盖住（和犯困最低那一下一样，看不见脚；Lulu 2026-09-24） */
  const SLEEP_POSE = c => t => {
    c.at(t, 'upper', { y: 2 }).at(t, 'legs', { f: 'crouch' }).at(t, 'shadow', { f: 'w14' });
  };
  /* 坐姿：上半身往下沉 1 格，腿收成一排，影子摊开一点 */
  const SIT_POSE = c => t => {
    c.at(t, 'upper', { y: 1 }).at(t, 'legs', { f: 'tuck' }).at(t, 'shadow', { f: 'w14' });
  };

  /* ── 写字（生成中循环，带进场）──────────────────────────── */
  const WRITE_IN = 600;
  {
    const O = WRITE_IN;
    const c = def(new Clip('write', '写字', O + 3600, { loop: true, intro: O, track: 'A', group: 'gen' }));
    c.beat(0, '一按发送：低头，纸从右边滑进来，右钳摸出笔').beat(O, '贴着纸写（循环）').beat(O + 3000, '一行写完，点下头，换一张');
    // 进场
    c.at(100, 'eyes', { x: 1, y: 1 });
    c.at(100, 'propB', { f: 'sheet0', x: 21, y: 9, z: 6, a: 0 }).to(100, 400, 'propB', { x: 17, a: 1 });
    c.at(200, 'clawR', { y: -1 });
    c.at(300, 'propA', { f: 'quill', x: 16, y: 5, att: 'clawR' });
    // 循环
    const setPose = WRITE_POSE(c);
    setPose(O);
    const wig = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }];
    for (let i = 0; i < 15; i++) c.at(O + i * 200, 'clawR', wig[i % 4]);
    for (let i = 1; i <= 10; i++) c.at(O + i * 300 - 200, 'propB', { f: 'sheet' + i });
    c.at(O + 3000, 'propB', { f: 'sheet0' }).at(O + 3000, 'clawR', { x: 1, y: 2 });
    c.at(O + 3000, 'eyes', { f: 'shut' }).at(O + 3000, 'upper', { y: 1 }).at(O + 3200, 'upper', { y: 0 });
    c.at(O + 3300, 'eyes', { f: 'open' });
    setPose(O + 3600);
  }

  /* ── 坐着写（生成超过 12 秒，带「坐下」进场）──────────── */
  const SIT_IN = 500;
  {
    const O = SIT_IN, L = 4800;
    const c = def(new Clip('sitWrite', '坐着写', O + L, { loop: true, intro: O, track: 'A', from: 'write', group: 'gen' }));
    c.beat(0, '写累了，眼皮耷拉').beat(200, '一屁股坐下（身子沉 1 格，腿收起来）').beat(O, '坐着接着写，比站着慢（循环）').beat(O + 2100, '慢慢眨一下眼').beat(O + 4500, '写完一行，头一点');
    WRITE_POSE(c)(0);
    c.at(100, 'eyes', { f: 'half' });
    SIT_POSE(c)(200);
    c.flex(100, {}).flex(200, { sx: 1.08, sy: .92 }).flex(300, { sx: .98, sy: 1.02 }).flex(400, {});
    const pose = t => { WRITE_POSE(c)(t); SIT_POSE(c)(t); c.at(t, 'eyes', { f: 'half' }); };
    pose(O);
    const wig = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }];
    for (let i = 0; i < 15; i++) c.at(O + i * 300, 'clawR', wig[i % 4]);
    for (let i = 1; i <= 10; i++) c.at(O + i * 450 - 300, 'propB', { f: 'sheet' + i });
    c.at(O + 2100, 'eyes', { f: 'shut' }).at(O + 2500, 'eyes', { f: 'half' });
    c.at(O + 4500, 'propB', { f: 'sheet0' }).at(O + 4500, 'clawR', { x: 1, y: 2 });
    c.at(O + 4500, 'upper', { y: 2 }).at(O + 4500, 'eyes', { f: 'shut' }).at(O + 4700, 'upper', { y: 1 }).at(O + 4700, 'eyes', { f: 'half' });
    pose(O + L);
  }

  /* 三种收尾共用。坐着写的时候结束也用这一段：第一帧直接站起来。
     （原来另做了「坐着」版本，先花 100ms 站起来——单独播时看起来就是开头蹲一下，和站着版看不出别的差别，Lulu 2026-09-24 删掉） */
  function endClip(id, name, from, dur, beats, body) {
    const c = def(new Clip(id, name, dur, { track: 'A', from: 'write', group: 'gen', smooth: ['root', 'shadow', 'propA', 'propB'] }));
    beats.forEach(([t, text]) => c.beat(t, text));
    body(c, 0);
  }

  /* ── 完成：丢笔丢纸、蹦两下 ─────────────────────────────── */
  endClip('done', '完成', 'write', 1800,
    [[0, '写完了'], [150, '笔往右上一抛，纸也扬起来飞走'], [300, '双钳举起蹦两下，闪光']],
    (c, O) => {
      WRITE_POSE(c)(O);
      c.at(O, 'propB', { f: 'sheet10' });
      c.at(O + 100, 'eyes', { f: 'happy', x: 0, y: 0 });
      c.at(O + 100, 'clawR', { x: 0, y: -2 }).at(O + 150, 'clawR', { f: 'up', x: 0, y: 0 });
      c.at(O + 150, 'propA', { f: 'quillFly', x: 19, y: 1, att: null }).to(O + 150, O + 600, 'propA', { x: 29, y: -12 }, 'out');
      c.seq(O + 250, 100, 'propA', [{ f: 'quill' }, { f: 'quillFly' }, { f: 'quill' }, { f: 'quillFly' }]);
      fadeOut(c, 'propA', O + 400, O + 700);
      c.at(O + 200, 'propB', { f: 'sheetFly', x: 21, y: 7 }).to(O + 200, O + 700, 'propB', { x: 33, y: -7 }, 'out');
      fadeOut(c, 'propB', O + 450, O + 800);
      raise(c, O + 300, 'clawL');
      hop(c, O + 400);
      sym(c, O + 300, 'spark', { dur: 700 });
      lower(c, O + 1000, 'clawL'); lower(c, O + 1000, 'clawR');
      c.at(O + 1500, 'eyes', { f: 'open' });
    });

  /* ── 停止：手一松，笔掉地上，叹口气；不欢呼 ────────────── */
  endClip('stopped', '停止', 'write', 1700,
    [[0, '写到一半被叫停'], [100, '抬头'], [200, '手一松，笔掉到地上'], [300, '「…」'], [500, '叹口气（钳子一耷拉，身子不动）'], [600, '笔和纸淡出'], [1300, '眨眼，回到待机']],
    (c, O) => {
      WRITE_POSE(c)(O);
      c.at(O, 'propB', { f: 'sheet6' });
      c.at(O + 100, 'eyes', { x: 0, y: 0 });
      c.at(O + 200, 'clawR', { x: 0, y: 0 });
      // 笔：离手时在 (17,7)，往下掉到地上躺平
      c.at(O + 200, 'propA', { x: 17, y: 7, att: null }).to(O + 200, O + 400, 'propA', { y: 9 }, 'in');
      c.at(O + 400, 'propA', { f: 'quillDown', x: 17, y: 8 });
      fadeOut(c, 'propA', O + 700, O + 1000);
      fadeOut(c, 'propB', O + 600, O + 900);
      sym(c, O + 300, 'dots', { x: 5, dur: 1000 });
      c.at(O + 400, 'eyes', { f: 'half' });
      c.at(O + 500, 'clawL', { y: 1 }).at(O + 500, 'clawR', { y: 1 }).at(O + 900, 'clawL', { y: 0 }).at(O + 900, 'clawR', { y: 0 });   // 叹气只让钳子耷拉一下，身子不往下沉（沉一格看着像深蹲）
      c.at(O + 1100, 'eyes', { f: 'open' });
      blink(c, O + 1300);
    });

  /* ── 出错：「！」一哆嗦，笔飞出去，纸上画叉，冒汗 ─────── */
  endClip('error', '出错', 'write', 2200,
    [[0, '写着写着'], [100, '「！」一哆嗦，笔脱手飞出去'], [200, '纸上出现红叉'], [500, '低头看这一摊'], [600, '冒汗'], [1300, '纸淡出'], [1500, '叹气（钳子耷拉一下），回到待机']],
    (c, O) => {
      WRITE_POSE(c)(O);
      c.at(O, 'propB', { f: 'sheet5' });
      sym(c, O + 100, 'bang', { x: 6, y: 2, dur: 800 });
      c.at(O + 100, 'eyes', { x: 0, y: -1 });
      c.flex(O, {}).flex(O + 100, { sx: .94, sy: 1.08 }).flex(O + 200, { sx: 1.06, sy: .95 }).flex(O + 300, {});
      c.at(O + 100, 'clawR', { x: 0, y: -1 }).at(O + 300, 'clawR', { x: 0, y: 0 });
      c.at(O + 100, 'propA', { f: 'quillFly', x: 17, y: 5, att: null }).to(O + 100, O + 300, 'propA', { x: 20, y: 1 }, 'out')
       .to(O + 300, O + 600, 'propA', { x: 21, y: 9 }, 'in');
      c.at(O + 600, 'propA', { f: 'quillDown', x: 20, y: 8 });
      fadeOut(c, 'propA', O + 900, O + 1200);
      c.at(O + 200, 'propB', { f: 'sheetErr' });
      fadeOut(c, 'propB', O + 1300, O + 1600);
      c.at(O + 500, 'eyes', { x: 1, y: 2 });
      sym(c, O + 600, 'sweat', { x: 8, y: 4, dur: 1000 });
      c.at(O + 1500, 'eyes', { f: 'half', x: 0, y: 0 });
      c.at(O + 1600, 'clawL', { y: 1 }).at(O + 1600, 'clawR', { y: 1 }).at(O + 1900, 'clawL', { y: 0 }).at(O + 1900, 'clawR', { y: 0 });
      c.at(O + 2000, 'eyes', { f: 'open' });
    });

  /* ── 互动：轻抚（光标在它身上来回划）──────────────────── */
  {
    const c = def(new Clip('pet', '轻抚', 2200, { track: 'C', group: 'touch' }));
    c.beat(0, '眯眼，往手上蹭').beat(700, '冒心').beat(1300, '闭眼享受一下').beat(1900, '心满意足');
    c.at(0, 'eyes', { f: 'shut' });
    c.seq(0, 200, 'clawL', [{ y: -1 }, { y: 0 }, { y: -1 }, { y: 0 }, { y: -1 }, { y: 0 }]);
    c.seq(100, 200, 'clawR', [{ y: -1 }, { y: 0 }, { y: -1 }, { y: 0 }, { y: -1 }, { y: 0 }]);
    // 往上蹭：身体往上长一格（脚不离地），眼睛跟着上去
    c.at(0, 'body', { f: 'tall' }).at(0, 'eyes', { y: -1 }).at(300, 'body', { f: 'stand' }).at(300, 'eyes', { y: 0 })
     .at(600, 'body', { f: 'tall' }).at(600, 'eyes', { y: -1 }).at(900, 'body', { f: 'stand' }).at(900, 'eyes', { y: 0 });
    sym(c, 700, 'heart', { dur: 1100 });
    c.at(1300, 'eyes', { f: 'shut' }).at(1900, 'eyes', { f: 'open' });   // 结尾不再闪一下 ∨∨（Lulu 2026-09-24）
    c.flex(0, { sx: .96, sy: 1.05 }).flex(300, { sx: 1.03, sy: .97 }).flex(600, { sx: .96, sy: 1.05 }).flex(900, { sx: 1.03, sy: .97 }).flex(1100, {});
  }

  /* ════════════════════════════════════════════════════════════════════
     旧动作翻新（2026-09-24）
     内容照旧版 clawd-合并原型.html，画法换成分件骨架：像素保持竖直、落在格子上，动的是部件。
     只有两类保留整只变形（Lulu 定）：歪头的整体旋转；弹跳类（蹦床、「！」、落地、被戳蹦一下）的压扁拉长。
     ════════════════════════════════════════════════════════════════════ */

  /* ── 打字：低头看输入框、点头（循环）──────────────────── */
  function composeLoop(c, L) {
    // 眼睛往下挪 3 格（旧版 low-look 的位置），一拍一点头；中间眼睛往右扫一下，像在读
    c.at(L, 'eyes', { f: 'open', x: 0, y: 3 });
    c.at(L + 300, 'upper', { y: 1 }).at(L + 300, 'eyes', { f: 'half' });
    c.at(L + 500, 'upper', { y: 0 }).at(L + 500, 'eyes', { f: 'open' });
    c.at(L + 800, 'upper', { y: 1 }).at(L + 800, 'eyes', { f: 'half' });
    c.at(L + 1000, 'upper', { y: 0 }).at(L + 1000, 'eyes', { f: 'open' });
    c.at(L + 1200, 'eyes', { x: 1 }).at(L + 1500, 'eyes', { x: 0 });
    c.at(L + 1600, 'eyes', { f: 'open', x: 0, y: 3 });
  }
  {
    const O = 200;
    const c = def(new Clip('compose', '打字：低头看、点头', O + 1600, { loop: true, intro: O, group: 'type' }));
    c.beat(0, '眼睛往下看输入框').beat(O, '跟着打字一拍一点头（循环）').beat(O + 1200, '眼睛往右扫一下，像在读');
    c.at(100, 'eyes', { y: 1 });
    composeLoop(c, O);
  }

  /* ── 「？」歪头（循环，带进场；退出用 untilt）──────────── */
  {
    const O = 1400, L = 2400;
    const c = def(new Clip('tilt', '「？」歪头', O + L, { loop: true, intro: O, group: 'type' }));
    c.beat(0, '输入里有问号').beat(100, '整只歪过去（冲过头一点再回来）').beat(200, '冒「？」').beat(O, '歪着头等（循环）').beat(O + 1200, '「？」再冒一次');
    c.at(100, 'eyes', { y: -1 });
    c.flex(0, {}).flex(100, { r: -8 }).flex(200, { r: -16 }).flex(300, { r: -11 }).flex(400, { r: -13 });
    sym(c, 200, 'q', { x: 3, dur: 1000 });
    c.flex(O, { r: -13 }).flex(O + L, { r: -13 });
    c.at(O + 1100, 'eyes', { f: 'half' }).at(O + 1200, 'eyes', { f: 'open' });
    sym(c, O + 1200, 'q', { x: 3, dur: 1000 });
  }
  {
    const c = def(new Clip('untilt', '歪头 → 回正', 400, { from: 'tilt', group: 'type' }));
    c.beat(0, '问号删掉了，头摆回来（也冲过头一点）');
    c.at(0, 'eyes', { y: -1 }).at(200, 'eyes', { y: 0 });
    c.flex(0, { r: -13 }).flex(100, { r: -4 }).flex(200, { r: 3 }).flex(300, {});
  }

  /* ── 「！」惊讶：弹起来，然后接着低头看（循环）─────────── */
  {
    const O = 1100;
    const c = def(new Clip('wow', '「！」惊讶', O + 1600, { loop: true, intro: O, smooth: ['root', 'shadow'], group: 'type' }));
    c.beat(0, '输入里有感叹号，或者一口气打了很多字').beat(100, '一缩').beat(200, '弹起来，冒「！」').beat(400, '落地').beat(600, '低头去看你写了什么').beat(O, '接着低头看、点头（循环）');
    c.at(100, 'eyes', { y: -1 });
    c.flex(0, {}).flex(100, { sx: 1.12, sy: .88 });
    c.at(100, 'root', { y: 0 }).at(100, 'shadow', { y: 0 });
    c.at(200, 'root', { y: -2 }, 'out').at(200, 'shadow', { y: 2, f: 'w10' }, 'out').flex(200, { sx: .86, sy: 1.2 });
    c.at(300, 'root', { y: -2 }).at(300, 'shadow', { y: 2 }).flex(300, { sx: .95, sy: 1.06 });
    c.at(400, 'root', { y: 0 }, 'in').at(400, 'shadow', { y: 0, f: 'w12' }, 'in').flex(400, { sx: 1.1, sy: .92 });
    c.flex(500, {});
    sym(c, 200, 'bang', { x: 5, y: 1, dur: 800 });
    c.at(600, 'eyes', { y: 1 });
    composeLoop(c, O);
  }

  /* ── 东张西望 ─────────────────────────────────────────── */
  {
    const c = def(new Clip('around', '东张西望', 2100, { group: 'idle' }));
    c.beat(0, '站着').beat(300, '眨眼，身子转向左边看').beat(1000, '眨眼，转向右边看，「？」').beat(1800, '转回来');
    blink(c, 300, 'open');
    c.at(400, 'eyes', { x: -1 }).at(400, 'body', { f: 'turnL' });
    c.at(1000, 'eyes', { f: 'half', x: 0 }).at(1000, 'body', { f: 'stand' });
    c.at(1100, 'eyes', { f: 'open', x: 1 }).at(1100, 'body', { f: 'turnR' });
    sym(c, 1100, 'q', { x: 4, dur: 800 });
    c.at(1800, 'eyes', { x: 0 }).at(1800, 'body', { f: 'stand' });
  }

  /* ── 转一圈：用转向帧真的转，不再把整张图横着捏扁 ───────── */
  {
    const c = def(new Clip('spin', '转一圈', 1200, { smooth: ['root', 'shadow'], group: 'idle' }));
    c.beat(0, '一蹲').beat(100, '起跳，转向右').beat(300, '背过身去').beat(500, '转向左').beat(600, '落地转回正面，♪');
    c.flex(0, {}).flex(100, { sx: 1.1, sy: .9 });
    c.at(100, 'body', { f: 'turnR' }).at(100, 'eyes', { x: 1 });
    c.at(100, 'root', { y: 0 }).at(100, 'shadow', { y: 0 });
    c.at(200, 'root', { y: -2 }, 'out').at(200, 'shadow', { y: 2, f: 'w10' }, 'out').flex(200, { sx: .94, sy: 1.08 });
    c.at(300, 'body', { f: 'stand' }).at(300, 'eyes', { f: null });   // 背面：没有眼睛
    c.at(300, 'root', { y: -3 }).at(300, 'shadow', { y: 3, f: 'w8' }).flex(300, {});
    c.at(500, 'body', { f: 'turnL' }).at(500, 'eyes', { f: 'open', x: -1 });
    c.at(500, 'root', { y: -2 }).at(500, 'shadow', { y: 2, f: 'w10' });
    c.at(600, 'root', { y: 0 }, 'in').at(600, 'shadow', { y: 0, f: 'w12' }, 'in').flex(600, { sx: 1.1, sy: .9 });
    c.at(700, 'body', { f: 'stand' }).at(700, 'eyes', { x: 0 }).flex(700, {});
    sym(c, 600, 'note', { x: 4, dur: 600 });
  }

  /* ── 侧身探头：身子往右挪、右钳撑地，不再把整张图压扁 ──── */
  {
    const c = def(new Clip('lean', '侧身探头', 1900, { smooth: ['root', 'shadow'], group: 'idle' }));
    c.beat(0, '往右看').beat(300, '整只往右挪一格（身子不扭），右钳撑地').beat(500, '「？」').beat(1400, '挪回来');
    c.at(200, 'eyes', { x: 1 });
    c.at(200, 'root', { x: 0 }).at(400, 'root', { x: 1 }, 'io').at(300, 'eyes', { x: 1 });
    c.at(300, 'clawR', { f: 'low', x: 0 }).at(300, 'clawL', { y: -1 });
    sym(c, 500, 'q', { x: 5, dur: 900 });
    c.at(1100, 'eyes', { f: 'half' }).at(1200, 'eyes', { f: 'open' });
    c.at(1400, 'clawR', { f: 'stub' }).at(1400, 'clawL', { y: 0 });
    c.at(1400, 'root', { x: 1 }).at(1600, 'root', { x: 0 }, 'io');
    c.at(1600, 'eyes', { x: 0 });
  }

  /* ── 躲进输入框：缩到输入框后面，只露眼睛和两只钳子扒着边 ─ */
  {
    const c = def(new Clip('hide', '躲进去', 2900, { smooth: ['root'], group: 'idle', noShadow: true, clipGround: true }));
    c.beat(0, '往上看一眼').beat(200, '一蹲').beat(300, '缩进输入框后面').beat(600, '两只钳子扒着边，只露眼睛').beat(1100, '左看看，右看看').beat(2100, '蹦出来');
    c.at(100, 'eyes', { y: -1 });
    c.at(200, 'upper', { y: 1 }).at(200, 'legs', { f: 'crouch' });
    c.at(300, 'upper', { y: 0 }).at(300, 'legs', { f: 'stand' }).at(300, 'shadow', { f: null });
    c.at(300, 'root', { y: 0 }).at(600, 'root', { y: 6 }, 'in');
    c.at(600, 'clawL', { y: -3 }).at(600, 'clawR', { y: -3 }).at(600, 'eyes', { y: 0 });
    c.at(1100, 'eyes', { x: -1 }).at(1500, 'eyes', { x: 1 }).at(1800, 'eyes', { x: 0 });
    blink(c, 1800);
    c.at(2100, 'clawL', { y: 0 }).at(2100, 'clawR', { y: 0 }).at(2100, 'root', { y: 6 });
    c.at(2300, 'root', { y: -1 }, 'out').at(2300, 'shadow', { f: 'w10', y: 1 });
    c.at(2400, 'root', { y: 0 }, 'in').at(2400, 'shadow', { f: 'w12', y: 0 });
    c.flex(2300, { sx: .92, sy: 1.1 }).flex(2400, { sx: 1.08, sy: .93 }).flex(2500, {});
  }

  /* ── 蹦床：把输入框当蹦床，一下比一下低 ─────────────── */
  {
    const c = def(new Clip('tramp', '蹦床', 1600, { smooth: ['root', 'shadow'], group: 'idle' }));
    c.beat(0, '蹲下蓄力').beat(200, '蹦老高').beat(700, '砸在输入框上，压扁').beat(800, '弹起来').beat(1000, '再砸一下').beat(1100, '小弹一下，站稳');
    const air = (t, h, e) => c.at(t, 'root', { y: -h }, e).at(t, 'shadow', { y: h, f: h >= 5 ? 'w8' : h >= 2 ? 'w10' : 'w12' }, e);
    c.at(100, 'upper', { y: 1 }).at(100, 'legs', { f: 'crouch' }).flex(0, {}).flex(100, { sx: 1.12, sy: .88 });
    c.at(200, 'upper', { y: 0 }).at(200, 'legs', { f: 'stand' }).at(200, 'eyes', { f: 'happy' });
    air(200, 0); air(400, 8, 'out'); air(500, 8); air(700, 0, 'in');
    c.flex(200, { sx: .88, sy: 1.14 }).flex(400, {}).flex(700, { sx: 1.3, sy: .68 });
    air(900, 5, 'out'); air(1000, 0, 'in');
    c.flex(800, { sx: .92, sy: 1.1 }).flex(900, {}).flex(1000, { sx: 1.15, sy: .85 });
    air(1100, 2, 'out'); air(1200, 0, 'in');
    c.flex(1100, {}).flex(1200, { sx: 1.06, sy: .94 }).flex(1300, {});
    c.at(1400, 'eyes', { f: 'open' });
  }

  /* ── 被冷落：低头往一边看，蔫了（循环）──────────────── */
  {
    const c = def(new Clip('neglected', '被冷落', 3400, { loop: true, group: 'idle' }));
    c.beat(0, '眼睛往左下看，钳子耷拉').beat(1200, '更蔫一点（身子沉 1 格）').beat(1400, '「…」').beat(2400, '抬回来一点');
    c.at(0, 'eyes', { f: 'half', x: -1, y: 2 }).at(0, 'clawL', { y: 1 }).at(0, 'clawR', { y: 1 });
    c.at(1200, 'upper', { y: 1 }).at(2400, 'upper', { y: 0 });
    sym(c, 1400, 'dots', { x: -3, dur: 1200 });
    c.at(3400, 'eyes', { f: 'half', x: -1, y: 2 });
  }

  /* ════ 睡觉 ════ */

  /* ── 犯困：打盹点头，越点越低，猛地惊醒（循环）─────────── */
  {
    const c = def(new Clip('drowsy', '犯困', 2800, { loop: true, group: 'sleep' }));
    c.beat(0, '眼皮耷拉').beat(300, '头一点').beat(1000, '再一点，更低').beat(1500, '快睡着了').beat(2000, '猛地惊醒，往上看').beat(2200, '眼皮又耷拉下来');
    c.at(0, 'eyes', { f: 'half', x: 0, y: 0 });
    c.at(300, 'eyes', { f: 'shut' }).at(300, 'upper', { y: 1 });
    c.at(700, 'eyes', { f: 'half' }).at(700, 'upper', { y: 0 });
    c.at(1000, 'eyes', { f: 'shut' }).at(1000, 'upper', { y: 1 });
    c.at(1500, 'upper', { y: 2 }).at(1500, 'legs', { f: 'crouch' });
    c.at(2000, 'upper', { y: 0 }).at(2000, 'legs', { f: 'stand' }).at(2000, 'eyes', { f: 'open', y: -1 });
    c.at(2000, 'clawL', { y: -1 }).at(2000, 'clawR', { y: -1 }).at(2100, 'clawL', { y: 0 }).at(2100, 'clawR', { y: 0 });
    c.at(2200, 'eyes', { f: 'half', y: 0 });
    c.at(2800, 'eyes', { f: 'half', y: 0 });
  }

  /* ── 睡着：打个哈欠、坐下（进场），然后坐着睡、冒 Z（循环）── */
  {
    const O = 1500, L = 3200;
    const c = def(new Clip('sleep', '睡着', O + L, { loop: true, intro: O, smooth: ['clawL', 'clawR'], group: 'sleep' }));
    c.beat(0, '打个哈欠（身子抻长，钳子抬一点）').beat(700, '松下来').beat(800, '坐下，闭眼').beat(O, '坐着睡：钳子随呼吸慢慢起伏，冒 Z（循环）');
    c.at(100, 'eyes', { f: 'shut' }).at(100, 'body', { f: 'tall' });
    c.at(100, 'clawL', { y: -2 }).at(100, 'clawR', { y: -2 });
    sym(c, 200, 'tilde', { y: -1, dur: 800 });
    c.flex(0, {}).flex(200, { sx: .92, sy: 1.1 }).flex(500, { sx: .94, sy: 1.08 }).flex(700, {});
    c.at(700, 'body', { f: 'stand' }).at(700, 'clawL', { y: 0 }).at(700, 'clawR', { y: 0 });
    SLEEP_POSE(c)(800);
    c.flex(800, { sx: 1.06, sy: .94 }).flex(1000, {});
    // 循环：呼吸只动钳子（平滑），和待机一样的做法
    const sleepPose = t => { SLEEP_POSE(c)(t); c.at(t, 'eyes', { f: 'shut' }).at(t, 'clawL', { y: 0 }).at(t, 'clawR', { y: 0 }); };
    sleepPose(O);
    c.at(O + 1600, 'clawL', { y: -1 }, 'io').at(O + 1600, 'clawR', { y: -1 }, 'io');
    c.at(O + L, 'clawL', { y: 0 }, 'io').at(O + L, 'clawR', { y: 0 }, 'io');
    sym(c, O + 300, 'z', { x: 4, y: 2, dur: 1800 });
    c.at(O + L, 'eyes', { f: 'shut' });
  }

  /* ── 醒来 + 伸懒腰（醒来并进伸懒腰的开头，Lulu 2026-09-24 定）─ */
  {
    const O = 500;
    const c = def(new Clip('wake', '醒来 + 伸懒腰', O + 3200, { from: 'sleep', smooth: ['root', 'shadow'], group: 'sleep' }));
    c.beat(0, '还坐着睡').beat(100, '眼睛睁开一半').beat(200, '一下弹起来（压扁 → 拉长）').beat(O, '接着伸懒腰');
    SLEEP_POSE(c)(0); c.at(0, 'eyes', { f: 'shut' });
    c.at(100, 'eyes', { f: 'half' });
    c.at(200, 'upper', { y: 0 }).at(200, 'legs', { f: 'stand' }).at(200, 'eyes', { f: 'open', y: -1 });
    c.at(100, 'root', { y: 0 }).at(100, 'shadow', { y: 0 });
    c.at(200, 'root', { y: -1 }, 'out').at(200, 'shadow', { y: 1, f: 'w10' }, 'out');
    c.at(300, 'root', { y: 0 }, 'in').at(300, 'shadow', { y: 0, f: 'w12' }, 'in');
    c.flex(0, {}).flex(100, { sx: 1.1, sy: .9 }).flex(200, { sx: .94, sy: 1.06 }).flex(300, { sx: 1.04, sy: .97 }).flex(400, {});
    c.at(400, 'eyes', { y: 0 });
    stretchBody(c, O);
  }

  /* ════ 被戳（C 轨）════ */

  /* 第 1 档：蹦一下（开心），或者害羞捂眼 —— 两个随机一个 */
  {
    const c = def(new Clip('poke1', '戳 1：蹦一下', 600, { track: 'C', smooth: ['root', 'shadow'], group: 'touch' }));
    c.beat(0, '一缩，眯成笑眼').beat(100, '蹦起来').beat(300, '落地');
    c.at(0, 'eyes', { f: 'happy' });
    c.flex(0, { sx: 1.12, sy: .88 });
    c.at(100, 'root', { y: -3 }, 'out').at(100, 'shadow', { y: 3, f: 'w8' }, 'out').flex(100, { sx: .9, sy: 1.12 });
    c.at(300, 'root', { y: 0 }, 'in').at(300, 'shadow', { y: 0, f: 'w12' }, 'in').flex(300, { sx: 1.08, sy: .92 });
    c.flex(400, {});
    c.at(500, 'eyes', { f: 'open' });
  }
  {
    const c = def(new Clip('poke1Shy', '戳 1：害羞捂眼', 1100, { track: 'C', group: 'touch' }));
    c.beat(0, '两只钳子捂住眼睛').beat(200, '冒一颗心').beat(700, '放下来，笑眼').beat(900, '睁眼');
    // 眼睛藏到钳子后面：只看得见两只钳子贴在脸上
    c.at(0, 'clawL', { f: 'front', x: 4, y: -3 }).at(0, 'clawR', { f: 'front', x: -4, y: -3 }).at(0, 'eyes', { f: null });
    c.at(0, 'upper', { y: 1 }).at(300, 'upper', { y: 0 });
    sym(c, 200, 'heart', { x: 4, dur: 800 });
    c.at(700, 'clawL', { f: 'stub', x: 0, y: -1 }).at(700, 'clawR', { f: 'stub', x: 0, y: -1 }).at(700, 'eyes', { f: 'happy' });
    c.at(800, 'clawL', { y: 0 }).at(800, 'clawR', { y: 0 });
    c.at(900, 'eyes', { f: 'open' });
  }
  /* 第 2 档：往左躲一下 */
  {
    const c = def(new Clip('poke2', '戳 2：躲一下', 700, { track: 'C', smooth: ['root', 'shadow'], group: 'touch' }));
    c.beat(0, '眼睛看别处').beat(100, '整只往左挪开一格（身子不扭）').beat(400, '挪回来');
    c.at(0, 'eyes', { x: -1 }).at(0, 'clawL', { y: -1 });
    c.at(100, 'root', { x: -1 }, 'out');
    c.at(300, 'root', { x: -1 }).at(500, 'root', { x: 0 }, 'io');
    c.at(500, 'clawL', { y: 0 }).at(600, 'eyes', { x: 0 });
  }
  /* 第 3 档：左右晃，挤眼 */
  {
    const c = def(new Clip('poke3', '戳 3：晃一晃', 700, { track: 'C', group: 'touch' }));
    c.beat(0, '挤眼，上半身左右晃').beat(400, '停下，眨巴眼');
    c.at(0, 'eyes', { f: 'shut' });
    [1, -1, 1, -1].forEach((x, i) => c.at(i * 100, 'upper', { x }));
    c.at(400, 'upper', { x: 0 }).at(400, 'eyes', { f: 'half' }).at(600, 'eyes', { f: 'open' });
  }
  /* 第 4 档：挣扎，两只钳子乱挥 */
  {
    const c = def(new Clip('poke4', '戳 4：挣扎', 1100, { track: 'C', group: 'touch' }));
    c.beat(0, '眯眼，两只钳子一上一下乱挥，身子左右扭').beat(100, '「！」').beat(800, '停下，还眯着眼').beat(1000, '睁眼');
    c.at(0, 'eyes', { f: 'squint' });
    for (let i = 0; i < 8; i++) {
      const t = i * 100, up = i % 2 === 0;
      c.at(t, 'clawL', { y: up ? -4 : 0 }).at(t, 'clawR', { y: up ? 0 : -4 }).at(t, 'upper', { x: up ? -1 : 1 });
    }
    sym(c, 100, 'bang', { x: 5, y: 1, dur: 700 });
    c.at(800, 'clawL', { y: 0 }).at(800, 'clawR', { y: 0 }).at(800, 'upper', { x: 0 });
    c.at(1000, 'eyes', { f: 'open' });
  }
  /* 第 5 档：转身生气（旧版「转身 → 赌气 → 转回来」一整段，3.4 秒） */
  {
    const c = def(new Clip('sulk', '戳 5：转身生气', 3400, { track: 'C', group: 'touch' }));
    c.beat(0, '转向右').beat(200, '背过身去，一动不动').beat(400, '青筋一跳一跳').beat(3000, '转向左').beat(3200, '转回正面');
    c.at(0, 'body', { f: 'turnR' }).at(0, 'eyes', { x: 1 });
    c.at(200, 'body', { f: 'stand' }).at(200, 'eyes', { f: null });
    sym(c, 400, 'vein', { x: 4, y: 2, dur: 2400 });
    c.at(3000, 'body', { f: 'turnL' }).at(3000, 'eyes', { f: 'open', x: -1 });
    c.at(3200, 'body', { f: 'stand' }).at(3200, 'eyes', { x: 0 });
  }

  /* ── 被按住：手指 / 鼠标按下还没拖（Lulu 2026-09-24）──
     以前一按下就摆「被拎起来」的姿势，按住想轻抚时会先吊起来再切轻抚。
     现在按下只被压扁一点、贴在地上（影子还在），挪动超过 5px 才拎起来，按住 0.6 秒才轻抚。 */
  {
    const c = def(new Clip('press', '被按住', 300, { track: 'C', hold: true, group: 'touch' }));
    c.beat(0, '被按下去：身子一沉、腿收一点、眯眼').beat(200, '停在这里等：松手是戳，拖动是拎起来，按住 0.6 秒是轻抚');
    c.at(0, 'upper', { y: 1 }).at(0, 'legs', { f: 'crouch' }).at(0, 'eyes', { f: 'half' });
    c.flex(0, { sx: 1.1, sy: .9 }).flex(100, { sx: 1.04, sy: .96 }).flex(200, {});
  }

  /* ════ 抓、丢（C 轨）════
     抓起来以后整只按钮会被拖走，所以影子一离地就收起来，不跟着飞 */
  {
    const c = def(new Clip('grab', '被抓起来', 400, { track: 'C', next: 'drag', noShadow: true, group: 'touch' }));
    c.beat(0, '一缩').beat(100, '被拎起来，身子抻长，腿垂下去').beat(200, '晃一下');
    c.at(0, 'eyes', { f: 'squint' }).at(0, 'shadow', { f: null });
    c.flex(0, { sx: 1.1, sy: .9 }).flex(100, { sx: .84, sy: 1.2 }).flex(200, { sx: 1.04, sy: .97 }).flex(300, {});
    c.at(100, 'legs', { f: 'dangle' }).at(100, 'clawL', { y: -2 }).at(100, 'clawR', { y: -2 });
    c.at(200, 'legs', { f: 'dangle2' }).at(300, 'legs', { f: 'dangle' });
    c.at(400, 'legs', { f: 'dangle' }).at(400, 'clawL', { y: -4 }).at(400, 'clawR', { y: 0 }).at(400, 'upper', { x: -1 }).at(400, 'eyes', { f: 'squint' });
  }
  {
    const c = def(new Clip('drag', '吊着（拖动中）', 800, { loop: true, track: 'C', noShadow: true, group: 'touch' }));
    c.beat(0, '被拎着：两只钳子一上一下乱挥（和戳 4 的挣扎同一个节奏），身子左右扭，腿轮流蹬（循环）');
    // 钳子和身子每 100ms 换一次（钳子上下差 4 格）；腿每 200ms 换一次，和钳子错开节奏——
    // 腿跟钳子同一拍一起甩的话，四肢同时在动，看着像两对钳子（Lulu 2026-09-24）。眼睛一直是 ><，不闭眼
    c.at(0, 'shadow', { f: null }).at(0, 'eyes', { f: 'squint' });
    for (let i = 0; i < 8; i++) {
      const t = i * 100, a = i % 2 === 0;
      if (i % 2 === 0) c.at(t, 'legs', { f: i % 4 === 0 ? 'dangle' : 'dangle2' });
      c.at(t, 'clawL', { y: a ? -4 : 0 }).at(t, 'clawR', { y: a ? 0 : -4 }).at(t, 'upper', { x: a ? -1 : 1 });
    }
    c.at(800, 'legs', { f: 'dangle' }).at(800, 'clawL', { y: -4 }).at(800, 'clawR', { y: 0 }).at(800, 'upper', { x: -1 });
  }
  {
    const c = def(new Clip('fly', '被丢出去（空中）', 400, { loop: true, track: 'C', noShadow: true, group: 'touch' }));
    c.beat(0, '在空中：两只钳子举起来（循环）');
    c.at(0, 'shadow', { f: null }).at(0, 'eyes', { f: 'open', y: -1 });
    c.at(0, 'clawL', { f: 'up' }).at(0, 'clawR', { f: 'up' });
    c.at(200, 'clawL', { y: 1 }).at(200, 'clawR', { y: 1 });
    c.at(400, 'clawL', { y: 0 }).at(400, 'clawR', { y: 0 });
  }
  {
    const c = def(new Clip('land', '落地', 900, { track: 'C', smooth: ['root', 'shadow'], group: 'touch' }));
    c.beat(0, '砸在地上，压扁（腿被压没）').beat(200, '缓一下').beat(300, '弹起来，举钳').beat(500, '站稳').beat(700, '放下钳子');
    c.at(0, 'body', { f: 'squash2' }).at(0, 'legs', { f: 'crouch' }).at(0, 'eyes', { f: 'shut', y: 3 }).at(0, 'shadow', { f: 'w14' });
    c.flex(0, { sx: 1.12, sy: .92 }).flex(200, { sx: 1.06, sy: .96 });
    c.at(200, 'body', { f: 'squash' }).at(200, 'legs', { f: 'stand' }).at(200, 'eyes', { y: 2 });
    c.at(300, 'body', { f: 'stand' }).at(300, 'legs', { f: 'stand' }).at(300, 'eyes', { f: 'open', y: -1 });
    c.at(200, 'root', { y: 0 }).at(200, 'shadow', { y: 0 });
    c.at(300, 'root', { y: -2 }, 'out').at(300, 'shadow', { y: 2, f: 'w10' }, 'out').flex(300, { sx: .92, sy: 1.1 });
    raise(c, 400, 'clawL'); raise(c, 400, 'clawR');
    c.at(500, 'root', { y: 0 }, 'in').at(500, 'shadow', { y: 0, f: 'w12' }, 'in').flex(500, { sx: 1.05, sy: .95 });
    c.flex(600, {});
    c.at(600, 'eyes', { y: 0 });
    lower(c, 700, 'clawL'); lower(c, 700, 'clawR');
  }
  {
    const c = def(new Clip('stomp', '被丢烦了：跺脚', 800, { track: 'C', smooth: ['root', 'shadow'], group: 'touch' }));
    c.beat(0, '眯眼，钳子一抬').beat(100, '跳起来').beat(200, '重重一跺，「！」').beat(500, '钳子放下');
    c.at(0, 'eyes', { f: 'squint' }).at(0, 'clawL', { y: -2 }).at(0, 'clawR', { y: -2 });
    c.at(100, 'root', { y: -2 }, 'out').at(100, 'shadow', { y: 2, f: 'w10' }, 'out').flex(100, { sx: .94, sy: 1.08 });
    c.at(200, 'root', { y: 0 }, 'in').at(200, 'shadow', { y: 0, f: 'w14' }, 'in').flex(200, { sx: 1.24, sy: .78 });
    c.at(200, 'clawL', { y: 1 }).at(200, 'clawR', { y: 1 });
    sym(c, 200, 'bang', { x: 5, y: 1, dur: 500 });
    c.flex(300, { sx: .98, sy: 1.02 }).flex(400, {});
    c.at(400, 'shadow', { f: 'w12' });
    c.at(500, 'clawL', { y: 0 }).at(500, 'clawR', { y: 0 });
    c.at(700, 'eyes', { f: 'open' });
  }

  const pool = {};
  for (const c of Object.values(CLIPS)) {
    pool[c.id] = { id: c.id, name: c.name, dur: c.dur, loop: c.loop, intro: c.intro, track: c.track, group: c.group, next: c.next };
  }
  const made = new Map();
  /* 某个动作的 CSS：第一次要播时才生成，之后用缓存 */
  function cssFor(id) {
    if (!CLIPS[id]) return '';
    if (!made.has(id)) made.set(id, genClipCSS(CLIPS[id]));
    return made.get(id);
  }
  return { css: genRestCSS(), cssFor, clips: pool, parts: PARTS.slice(), selfCheck };

  /* 静止拼图 = 现网 open 帧，返回不一致的格数（0 才对） */
  function selfCheck() {
    const grid = new Map();
    PARTS.forEach(p => { if (p !== 'shadow') pixelsOf(p, REST_F[p]).forEach(([x, y, ch]) => grid.set(`${x},${y}`, ch)); });
    let diff = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      const want = { '#': '#', 'o': 'o', '.': undefined }[OPEN_REF[y][x]];
      if (grid.get(`${x},${y}`) !== want) diff++;
    }
    return diff + [...grid.keys()].filter(k => { const [x, y] = k.split(',').map(Number); return x < 0 || x > 15 || y < 0 || y > 9; }).length;
  }
}
