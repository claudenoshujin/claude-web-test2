#!/usr/bin/env node
/* Claude Web 静态一致性检查。
 *
 * 四类检查各自可开关：
 *   node tools/consistency-check.js                         # 全部
 *   node tools/consistency-check.js --only=channels,classes # 只跑指定项
 *   node tools/consistency-check.js --no-conflicts          # 排除指定项
 *
 * 1. channels（硬失败）：生成器和对拍器必须共用同一份换皮通道名单；直接 require
 *    两个模块的导出，避免再用正则从源码中猜集合。
 * 2. classes（硬失败）：index.js 创建的框架类名必须在四份源 CSS 中有归宿，且 pc/mobile
 *    不能单边漏写。确实只属于一个布局的节点必须进入下面带理由的白名单。
 * 3. coverage（警告）：列出框架节点在 pc/mobile 两端的选择器覆盖差异。两端布局本来
 *    不同，所以这里只给维护者一张清单，不追求零警告。
 * 4. conflicts（警告）：同一文件中同一选择器重复声明几何属性时，报告行号和后写覆盖。
 *    CSS 层叠允许重复规则，因此这里只提示，不替人判断设计意图。
 *
 * 本脚本只读文件并打印结果。channels/classes 有错误时退出 1；只有警告时退出 0。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const CHECKS = ['channels', 'classes', 'coverage', 'conflicts'];
const RECENT_CLASSES = new Set([
  'chatNameContainer', 'chatName', 'chatDate', 'chatPreview', 'chatMeta', 'chatActions',
]);

/* 这些节点只会由桌面布局创建；手机端没有对应功能。 */
const PC_ONLY_CLASSES = new Map([
  ['clawd-pc-top-actions', '桌面顶栏操作区；手机端使用独立的 fixed 按钮。'],
  ['clawd-rail-grip', '桌面侧栏拖宽把手；手机端抽屉宽度固定。'],
  ['clawd-rail-resizing', '桌面侧栏拖宽期间挂在 body 上的状态；手机端没有拖宽交互。'],
]);

/* 这些节点只会由手机布局创建；桌面端使用常驻侧栏和原生顶栏。 */
const MOBILE_ONLY_CLASSES = new Map([
  ['clawd-mobile-chrome', '手机外壳容器；当前允许无样式，检查仍会明确报告。'],
  ['clawd-mobile-menu-button', '手机汉堡按钮。'],
  ['clawd-mobile-clawd-button', '手机 Clawd 快捷按钮。'],
  ['clawd-mobile-scrim', '手机抽屉遮罩。'],
  ['clawd-mobile-new-chat', '手机抽屉的新建对话入口。'],
]);

/* 这些短生命周期状态的规则由 index.js 的 installStyle() 同步注入，不属于四份皮肤源文件。
   显式列出是为了让新状态仍会被检查器拦住，不能悄悄扩大跳过范围。 */
const RUNTIME_STYLE_CLASSES = new Map([
  ['clawd-button-settle', 'Clawd 按钮入场动画状态。'],
  ['clawd-gen-timer', '生成计时器本体及其状态由运行时样式表定义。'],
  ['clawd-gen-timer-done', '生成计时器完成态。'],
  ['clawd-gen-timer-visible', '生成计时器可见态。'],
  ['clawd-react-nod', 'Clawd 点击反馈动画状态。'],
  ['clawd-react-peek', 'Clawd 点击反馈动画状态。'],
  ['clawd-saccade', 'Clawd 眼睛扫视过渡状态。'],
  /* 2.0.108：?kbdprobe=1 的读数覆盖层。它的样式全部写在 element.style 上（inline），
     不进任何样式表 —— 诊断器不该占用皮肤源文件，也不该被外部美化改到。
     类名保留是为了能一句 querySelector 找到并移除它。 */
  ['clawd-kbd-probe', '键盘诊断覆盖层；样式全部内联，故意不进四份源文件。'],
]);

const GEOMETRY = new Set([
  'position', 'top', 'right', 'bottom', 'left', 'inset',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'transform', 'translate', 'display', 'overflow', 'overflow-x', 'overflow-y',
]);

const files = {
  dayPc: path.join(root, 'styles', 'day-pc.css'),
  dayMobile: path.join(root, 'styles', 'day-mobile.css'),
  nightPc: path.join(root, 'styles', 'night-pc.css'),
  nightMobile: path.join(root, 'styles', 'night-mobile.css'),
};

function selectedChecks(argv) {
  const only = argv.find(arg => arg.startsWith('--only='));
  const enabled = new Set(only
    ? only.slice('--only='.length).split(',').map(item => item.trim()).filter(Boolean)
    : CHECKS);
  for (const arg of argv) {
    if (arg.startsWith('--no-')) enabled.delete(arg.slice('--no-'.length));
  }
  const unknown = [...enabled].filter(name => !CHECKS.includes(name));
  if (unknown.length) throw new Error(`未知检查项：${unknown.join(', ')}`);
  return enabled;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function parseCss(file) {
  const text = read(file);
  return { file, text, ast: csstree.parse(text, { positions: true, onParseError: () => {} }) };
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectorHasClass(selector, className) {
  return new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`).test(selector);
}

function ruleRecords(parsed) {
  const records = [];
  const visit = list => {
    for (const node of list.toArray()) {
      if (node.type === 'Atrule') {
        /* 不同 @keyframes 里的 0%/100% 不参与普通 CSS 层叠，不能互相算冲突。 */
        if (String(node.name).toLowerCase().endsWith('keyframes')) continue;
        if (node.block?.children) visit(node.block.children);
        continue;
      }
      if (node.type !== 'Rule' || node.prelude?.type !== 'SelectorList') continue;
    const declarations = new Map();
    for (const child of node.block.children.toArray()) {
      if (child.type !== 'Declaration') continue;
      declarations.set(String(child.property).toLowerCase(), csstree.generate(child.value));
    }
    for (const selectorNode of node.prelude.children.toArray()) {
      records.push({
        selector: normalizeSelector(csstree.generate(selectorNode)),
        declarations,
        line: node.loc?.start?.line || 0,
      });
    }
    }
  };
  visit(parsed.ast.children);
  return records;
}

function setDifference(a, b) {
  return [...a].filter(value => !b.has(value)).sort();
}

function checkChannels(errors) {
  const { SKIN_CHANNEL_PROPERTIES } = require(path.join(root, '_dev', 'build-compat-css.js'));
  const { SKIN_CHANNEL } = require(path.join(root, 'tools', 'compat-vs-full-check.js'));
  const generatorOnly = setDifference(SKIN_CHANNEL_PROPERTIES, SKIN_CHANNEL);
  const checkerOnly = setDifference(SKIN_CHANNEL, SKIN_CHANNEL_PROPERTIES);
  if (generatorOnly.length || checkerOnly.length) {
    errors.push('[channels] 换皮通道名单不一致');
    if (generatorOnly.length) console.error(`  仅生成器有：${generatorOnly.join(', ')}`);
    if (checkerOnly.length) console.error(`  仅对拍器有：${checkerOnly.join(', ')}`);
    return;
  }
  console.log(`[ok] channels：${SKIN_CHANNEL.size} 个属性完全一致`);
}

function collectIndexClasses() {
  const source = read(path.join(root, 'index.js'));
  const result = new Set();
  const addWords = value => value.split(/\s+/).filter(Boolean).forEach(name => result.add(name));
  for (const match of source.matchAll(/\.className\s*=\s*(['"])([^'"\r\n]+)\1/g)) addWords(match[2]);
  for (const call of source.matchAll(/\.classList\.add\s*\(([^)]*)\)/g)) {
    for (const literal of call[1].matchAll(/(['"])([^'"\r\n]+)\1/g)) addWords(literal[2]);
  }
  return new Set([...result]
    .filter(name => name.startsWith('clawd-') || RECENT_CLASSES.has(name))
    /* `'clawd-look-' + dir` 不是一个字面类名，实际的 l/r/u/d 状态由运行时样式定义。 */
    .filter(name => !name.endsWith('-')));
}

function classCounts(recordsByFile, className) {
  const count = key => recordsByFile[key].filter(record => selectorHasClass(record.selector, className)).length;
  return { dayPc: count('dayPc'), nightPc: count('nightPc'), dayMobile: count('dayMobile'), nightMobile: count('nightMobile') };
}

function checkClasses(recordsByFile, errors) {
  const classes = [...collectIndexClasses()].sort();
  let exposed = 0;
  for (const className of classes) {
    if (RUNTIME_STYLE_CLASSES.has(className)) continue;
    const counts = classCounts(recordsByFile, className);
    const pc = counts.dayPc + counts.nightPc;
    const mobile = counts.dayMobile + counts.nightMobile;
    const prefix = `[classes] .${className}`;
    if (!pc && !mobile) {
      if (className === 'clawd-mobile-chrome') {
        exposed += 1;
        console.warn(`[warn] ${prefix} 四份源 CSS 都没有规则（已知裸容器：${MOBILE_ONLY_CLASSES.get(className)}）`);
      } else {
        errors.push(`${prefix} 四份源 CSS 都没有规则`);
      }
      continue;
    }
    if (!pc && !MOBILE_ONLY_CLASSES.has(className)) errors.push(`${prefix} pc 0 条 / mobile ${mobile} 条，未登记为手机专属`);
    if (!mobile && !PC_ONLY_CLASSES.has(className)) errors.push(`${prefix} pc ${pc} 条 / mobile 0 条，未登记为桌面专属`);
    if (pc && (counts.dayPc === 0 || counts.nightPc === 0)) {
      errors.push(`${prefix} pc 明暗不对称：day ${counts.dayPc} / night ${counts.nightPc}`);
    }
    if (mobile && (counts.dayMobile === 0 || counts.nightMobile === 0)) {
      errors.push(`${prefix} mobile 明暗不对称：day ${counts.dayMobile} / night ${counts.nightMobile}`);
    }
  }
  console.log(`[${errors.some(item => item.startsWith('[classes]')) ? 'fail' : 'ok'}] classes：扫描 ${classes.length} 个框架类名（${RUNTIME_STYLE_CLASSES.size} 个运行时样式状态显式豁免），裸容器警告 ${exposed}`);
}

function frameworkSubjects(selector) {
  const subjects = new Set();
  for (const match of selector.matchAll(/\.((?:clawd-[\w-]+)|(?:chatNameContainer|chatName|chatDate|chatPreview|chatMeta|chatActions))(?![\w-])/g)) {
    subjects.add(`.${match[1]}`);
  }
  for (const id of ['top-settings-holder', 'form_sheld']) {
    if (new RegExp(`#${id}(?![\\w-])`).test(selector)) subjects.add(`#${id}`);
  }
  return subjects;
}

function subjectCounts(records) {
  const result = new Map();
  for (const record of records) {
    for (const subject of frameworkSubjects(record.selector)) result.set(subject, (result.get(subject) || 0) + 1);
  }
  return result;
}

function checkCoverage(recordsByFile) {
  let warnings = 0;
  for (const variant of ['day', 'night']) {
    const pc = subjectCounts(recordsByFile[`${variant}Pc`]);
    const mobile = subjectCounts(recordsByFile[`${variant}Mobile`]);
    const subjects = new Set([...pc.keys(), ...mobile.keys()]);
    console.log(`[coverage:${variant}]`);
    for (const subject of [...subjects].sort()) {
      const pcCount = pc.get(subject) || 0;
      const mobileCount = mobile.get(subject) || 0;
      if (pcCount && mobileCount) continue;
      const className = subject.startsWith('.') ? subject.slice(1) : '';
      const known = PC_ONLY_CLASSES.get(className) || MOBILE_ONLY_CLASSES.get(className);
      console.warn(`  [warn] ${subject}  pc ${pcCount} 条 / mobile ${mobileCount} 条${known ? `（已知：${known}）` : ''}`);
      warnings += 1;
    }
  }
  console.log(`[warn] coverage：${warnings} 组单边覆盖（信息性，不影响退出码）`);
}

function checkConflicts(parsedByFile, recordsByFile) {
  let warnings = 0;
  for (const key of Object.keys(parsedByFile)) {
    const groups = new Map();
    for (const record of recordsByFile[key]) {
      const geometry = new Set([...record.declarations.keys()].filter(property => GEOMETRY.has(property)));
      if (!geometry.size) continue;
      if (!groups.has(record.selector)) groups.set(record.selector, []);
      groups.get(record.selector).push({ line: record.line, geometry });
    }
    for (const [selector, occurrences] of groups) {
      if (occurrences.length < 2) continue;
      const previous = new Set();
      const overlaps = [];
      for (const occurrence of occurrences) {
        const overwritten = [...occurrence.geometry].filter(property => previous.has(property));
        if (overwritten.length) overlaps.push(`L${occurrence.line} 覆盖 ${overwritten.sort().join('/')}`);
        occurrence.geometry.forEach(property => previous.add(property));
      }
      if (!overlaps.length) continue;
      console.warn(`[warn] ${path.basename(parsedByFile[key].file)} ${selector}`);
      for (const occurrence of occurrences) {
        console.warn(`  L${occurrence.line}: ${[...occurrence.geometry].sort().join(', ')}`);
      }
      console.warn(`  后写覆盖：${overlaps.join('；')}`);
      warnings += 1;
    }
  }
  console.log(`[warn] conflicts：${warnings} 组重复几何选择器（信息性，不影响退出码）`);
}

function main() {
  const enabled = selectedChecks(process.argv.slice(2));
  const errors = [];
  const parsedByFile = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, parseCss(file)]));
  const recordsByFile = Object.fromEntries(Object.entries(parsedByFile).map(([key, parsed]) => [key, ruleRecords(parsed)]));

  if (enabled.has('channels')) checkChannels(errors);
  if (enabled.has('classes')) checkClasses(recordsByFile, errors);
  if (enabled.has('coverage')) checkCoverage(recordsByFile);
  if (enabled.has('conflicts')) checkConflicts(parsedByFile, recordsByFile);

  if (errors.length) {
    console.error(`\n一致性检查失败：${errors.length} 个硬错误`);
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n一致性检查通过：无硬错误。');
}

main();
