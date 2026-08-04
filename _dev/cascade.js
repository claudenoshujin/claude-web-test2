/* ============================================================
   层叠裁判 —— 回答「这个属性最后是谁画的」，不靠截图。

   为什么要它：
   用户消息那个「框」不是有人多画了一个边框，而是官网皮的
   `.mes[is_user="true"] .mes_block`（day-pc.css:1137）一条规则声明了
   8 个属性，而 Are.na 皮只抵消了其中 5 个。漏掉的 border-radius /
   width:fit-content / max-width 就是那个框。

   这类 bug 截图很难定位（看到的是"框"，看不到"哪三条漏了"），
   但在层叠层面是确定的：把所有命中同一个元素的规则按
   [!important, 特异性, 出现顺序] 排一遍，每个属性的赢家一目了然。

   用法：
     npm i jsdom postcss
     node cascade.js '<选择器>' [属性...]
   例：
     node cascade.js '#chat .mes[is_user="true"] .mes_block' border width max-width
     node cascade.js '#chat .mes .mes_text'          # 不给属性名 = 列出全部

   跑不动时看这里：**必须把这个脚本放在本机磁盘上跑，不能放在网络盘上跑。**
   node 解析 require 时会沿目录树往上逐级找 node_modules，网络盘上这一步
   会挂住，表现是"脚本没有任何输出、也不报错"（连 usage 都打不出来）。
   放在别处跑时用 CW_DIR 指到本目录：
     CW_DIR=/path/to/_dev node /tmp/cascade.js '.mes_block' border

   注意：它只裁决**作者样式表**的层叠，不算继承、不算浏览器默认值。
   对「我写的规则有没有被压住」这个问题足够；对「最终渲染成什么样」不够。
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const postcss = require('postcss');

const DIR = process.env.CW_DIR || __dirname;
const FIXTURE = path.join(DIR, 'fixture.html');
const CSS = path.join(DIR, '..', 'styles', 'day-pc.css');

/* ---------- 特异性 ----------
   只需要能正确排序，不需要完全实现 Selectors 4。
   :is()/:has() 取其内部最高的一项，其余伪类按类算 —— 和浏览器一致。 */
function specificity(sel) {
  let s = sel;
  let a = 0, b = 0, c = 0;

  /* :is(x,y) / :where(x) / :not(x) / :has(x) —— 先把内部算完再折进来 */
  s = s.replace(/:(is|not|has|matches)\(([^()]*)\)/g, (_, fn, inner) => {
    if (fn === 'where') return '';
    const best = inner.split(',').map(p => specificity(p.trim()))
      .sort((x, y) => (y[0] - x[0]) || (y[1] - x[1]) || (y[2] - x[2]))[0] || [0, 0, 0];
    a += best[0]; b += best[1]; c += best[2];
    return '';
  });
  s = s.replace(/:where\([^()]*\)/g, '');

  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length;
  b += (s.match(/\[[^\]]+\]/g) || []).length;
  b += (s.match(/:[a-z-]+(\([^)]*\))?/gi) || []).length;      /* 伪类 */
  c += (s.match(/::[a-z-]+/gi) || []).length;                  /* 伪元素 */
  s = s.replace(/::?[a-z-]+(\([^)]*\))?/gi, '');
  c += (s.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;   /* 类型选择器 */
  return [a, b, c];
}

function cmp(x, y) {
  if (x.important !== y.important) return x.important ? 1 : -1;
  for (let i = 0; i < 3; i++) if (x.spec[i] !== y.spec[i]) return x.spec[i] - y.spec[i];
  return x.order - y.order;
}

/* ---------- 装载 ---------- */
/* 不要开 pretendToBeVisual —— 它会起一个 requestAnimationFrame 循环，
   进程跑完也不退出，看起来像"脚本卡住没输出"，其实结果早就算完了。
   同理结尾必须显式 process.exit(0)。 */
const dom = new JSDOM(fs.readFileSync(FIXTURE, 'utf8'), {
  runScripts: 'dangerously',
});
const doc = dom.window.document;

/* 轴的现场覆盖 —— 同一个元素在不同皮/结构下命中的规则完全不同，
   裁决前必须先把轴设成你要问的那一组。
     CW_SKIN=playbill CW_STRUCTURE=linear CW_AVATARS=off node cascade.js ... */
if (process.env.CW_SKIN) doc.documentElement.dataset.claudeSkin = process.env.CW_SKIN;
if (process.env.CW_STRUCTURE) doc.documentElement.dataset.claudeStructure = process.env.CW_STRUCTURE;
if (process.env.CW_AVATARS) doc.documentElement.dataset.claudeAvatars = process.env.CW_AVATARS;

const target = process.argv[2];
if (!target) {
  console.error('用法: node cascade.js <选择器> [属性...]');
  process.exit(1);
}
const wanted = process.argv.slice(3);

const el = doc.querySelector(target);
if (!el) {
  console.error('fixture 里没有匹配 ' + target + ' 的元素。');
  console.error('—— 这本身是个结果：说明 fixture 的 DOM 和你以为的不一样，先修 fixture。');
  process.exit(1);
}

/* ---------- 简写展开 ----------
   不展开的话会得到假的漏网报告：`margin:0 !important` 明明压住了
   `margin-left:auto !important`，但两者属性名不同，逐名比对会把后者
   算成"赢家"。浏览器是按长写属性层叠的，这里跟上。
   只展开这套 CSS 里真正用到的那几个简写，不求完整。 */
const SHORTHAND = {
  margin:  ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  inset:   ['top', 'right', 'bottom', 'left'],
  border:  ['border-top', 'border-right', 'border-bottom', 'border-left',
            'border-width', 'border-style', 'border-color'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius',
                    'border-bottom-right-radius', 'border-bottom-left-radius'],
  background: ['background-color', 'background-image', 'background-position',
               'background-size', 'background-repeat'],
  font: ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
};

/* ---------- 收集所有命中的声明 ---------- */
const root = postcss.parse(fs.readFileSync(CSS, 'utf8'));
const hits = [];   /* {prop, value, important, spec, order, sel, line, media} */
let order = 0;

root.walkRules(rule => {
  /* @media 里的规则照收 —— 媒体查询不影响特异性，只影响是否生效。
     宽度相关的条件在这里记下来，由人判断当前视口下算不算数。 */
  const media = [];
  for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
    media.unshift('@' + p.name + ' ' + p.params);
  }

  rule.selectors.forEach(sel => {
    order++;
    /* 伪元素不能用 matches() 测，剥掉之后再测宿主元素。 */
    const probe = sel.replace(/::(before|after|placeholder|selection|marker|first-line|first-letter|-webkit-[\w-]+)/g, '').trim();
    if (!probe) return;
    let ok = false;
    try { ok = el.matches(probe); } catch { ok = false; }
    if (!ok) return;

    const spec = specificity(sel);
    rule.walkDecls(decl => {
      if (wanted.length && !wanted.some(w => decl.prop === w || decl.prop.startsWith(w + '-'))) return;
      const base = {
        value: decl.value,
        important: !!decl.important,
        spec, order,
        sel,
        line: decl.source.start.line,
        media: media.join(' '),
      };
      hits.push({ ...base, prop: decl.prop });
      /* 简写同时也参与所有长写属性的层叠 */
      for (const long of (SHORTHAND[decl.prop] || [])) {
        hits.push({ ...base, prop: long, via: decl.prop });
      }
    });
  });
});

/* ---------- 按属性裁决 ---------- */
const byProp = new Map();
for (const h of hits) {
  const cur = byProp.get(h.prop);
  if (!cur || cmp(h, cur) > 0) byProp.set(h.prop, h);
}

const props = [...byProp.keys()].sort();
console.log('元素：' + target);
console.log('命中声明 ' + hits.length + ' 条，涉及 ' + props.length + ' 个属性\n');

for (const p of props) {
  const win = byProp.get(p);
  const all = hits.filter(h => h.prop === p).sort(cmp).reverse();
  console.log('■ ' + p + ': ' + win.value + (win.important ? ' !important' : ''));
  all.forEach((h, i) => {
    const tag = i === 0 ? '  ✓ ' : '  ✗ ';
    console.log(tag + 'L' + h.line + '  (' + h.spec.join(',') + ')  ' + h.sel
      + (h.via ? '   [来自简写 ' + h.via + ']' : '')
      + (h.media ? '   ' + h.media : '')
      + (i === 0 ? '' : '   ← 被压'));
  });
  console.log('');
}

process.exit(0);
