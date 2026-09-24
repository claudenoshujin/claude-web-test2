/* 一次性脚本：删掉右栏「幕次表」改成幕次目录之后失效的 .cw-chat-* 规则块。
 *
 * 背景：2.0.156 把幕次表从「这个角色的历史存档」改成「本场对话的幕次目录」
 * （照参考稿 剧场主题_THE_PLAYBILL.html）。fillAsideChats 连同它产出的
 * .cw-chat-row / -open / -top / -act / -acts / -edit / -del 一起删了，
 * 样式表里那 24 条规则从此匹配不到任何节点。
 * 本文件多次栽在「写着但永远匹配不到」的死规则上，所以一起清掉。
 *
 * 三条纪律（都是这个仓库踩出来的）：
 *   1. 扫描必须跳注释和字符串 —— 注释里的花括号会把裸计数带偏。
 *   2. 只删规则块，**不删附属注释**。上一次顺带删注释，/* 配错，
 *      删出了一个没闭合的注释。孤儿注释手工清。
 *   3. 改完必须跑跳注释的花括号平衡检查 + 四个测试套件。
 *
 * 已先行核实：24 处 .cw-chat- 全部出现在 depth 0 的选择器里，
 * 没有一条在 @media 内部，所以这里只处理顶层规则。
 */
import fs from 'node:fs';

const FILES = ['styles/day-pc.css', 'styles/night-pc.css'];
const NEEDLE = 'cw-chat-';

/** 跳过从 i 开始的注释，返回注释结束后的下标；不是注释就返回 -1。 */
function skipComment(s, i) {
  if (s[i] === '/' && s[i + 1] === '*') {
    const e = s.indexOf('*/', i + 2);
    return e < 0 ? s.length : e + 2;
  }
  return -1;
}

/** 跳过从 i 开始的字符串字面量（url() 里的引号也算），返回结束下标；不是字符串返回 -1。 */
function skipString(s, i) {
  const q = s[i];
  if (q !== '"' && q !== "'") return -1;
  let j = i + 1;
  while (j < s.length && s[j] !== q) {
    if (s[j] === '\\') j++;
    j++;
  }
  return j + 1;
}

/** 去掉注释，只留真正的选择器文本。
 *  判断「这条规则要不要删」必须用它 —— 选择器前面常连着一段注释，
 *  而注释里完全可能提到 .cw-chat-*（比如「原来这里放 .cw-chat-acts」）。
 *  拿带注释的原文去匹配，会把**注释提到过**的无辜规则一起删掉。 */
function selectorOnly(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = skipComment(s, i);
    if (c >= 0) { i = c; continue; }
    out += s[i];
    i++;
  }
  return out;
}

function strip(src) {
  let out = '';
  let i = 0;
  let removed = 0;
  let selStart = 0;          // 当前选择器的起点（上一条规则结束之后）

  while (i < src.length) {
    const c = skipComment(src, i);
    if (c >= 0) { i = c; continue; }
    const q = skipString(src, i);
    if (q >= 0) { i = q; continue; }

    if (src[i] === '{') {
      // 找到这条规则的选择器；扫到配对的 }
      const selector = src.slice(selStart, i);
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        const c2 = skipComment(src, j);
        if (c2 >= 0) { j = c2; continue; }
        const q2 = skipString(src, j);
        if (q2 >= 0) { j = q2; continue; }
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      // j 现在指向块结束之后
      if (selectorOnly(selector).includes(NEEDLE)) {
        /* 丢掉这条规则。选择器前面可能连着注释/空行 —— 注释保留（纪律 2）。
           ⚠ 这里**不能**用 selector.lastIndexOf('\n')：多行选择器
           （`… .cw-chat-top i,\n … .cw-chat-top em{`）会因此只丢掉最后一行，
           留下一个「带逗号但没有块」的残片，它会把**紧跟其后的那条规则**
           吸进自己的选择器列表 —— 花括号仍然平衡，所以平衡检查抓不到，
           但匹配范围已经错了。2026-08-25 第一版就是这么把文件改坏的。
           正确做法：只保留开头那一段「空白 + 注释」，选择器列表整个丢。 */
        let k = 0;
        for (;;) {
          if (/\s/.test(selector[k])) { k++; continue; }
          const cc = skipComment(selector, k);
          if (cc >= 0) { k = cc; continue; }
          break;
        }
        out += selector.slice(0, k);
        removed++;
        // 顺带吃掉紧跟其后的一个换行，避免留一行空行
        if (src[j] === '\n') j++;
      } else {
        out += selector + src.slice(i, j);
      }
      i = j;
      selStart = j;
      continue;
    }

    i++;
  }
  out += src.slice(selStart);
  return { out, removed };
}

/** 收集所有规则的选择器文本。用来事后确认没留下残片 ——
 *  花括号平衡检查**抓不到**「带逗号但没有块」的残片（它只是并进了下一条规则），
 *  所以必须单独验一遍：改完之后不该再有任何选择器提到 NEEDLE。 */
function selectors(s) {
  const list = [];
  let i = 0, selStart = 0;
  while (i < s.length) {
    const c = skipComment(s, i);
    if (c >= 0) { i = c; continue; }
    const q = skipString(s, i);
    if (q >= 0) { i = q; continue; }
    if (s[i] === '{') {
      list.push(selectorOnly(s.slice(selStart, i)));
      let depth = 1, j = i + 1;
      while (j < s.length && depth > 0) {
        const c2 = skipComment(s, j);
        if (c2 >= 0) { j = c2; continue; }
        const q2 = skipString(s, j);
        if (q2 >= 0) { j = q2; continue; }
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        j++;
      }
      i = j; selStart = j; continue;
    }
    i++;
  }
  return list;
}

/** 跳注释的花括号平衡检查。 */
function balanced(s) {
  let i = 0, depth = 0, min = 0;
  while (i < s.length) {
    const c = skipComment(s, i);
    if (c >= 0) { i = c; continue; }
    const q = skipString(s, i);
    if (q >= 0) { i = q; continue; }
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth < min) min = depth; }
    i++;
  }
  return depth === 0 && min === 0;
}

let fail = false;
for (const f of FILES) {
  const src = fs.readFileSync(f, 'utf8');
  const { out, removed } = strip(src);
  if (!balanced(out)) {
    console.error(`✗ ${f}: 花括号不平衡，未写回`);
    fail = true;
    continue;
  }
  const dangling = selectors(out).filter(sel => sel.includes(NEEDLE));
  if (dangling.length) {
    console.error(`✗ ${f}: 还有 ${dangling.length} 条选择器提到 ${NEEDLE}（残片），未写回`);
    dangling.forEach(d => console.error('    ' + d.trim().replace(/\s+/g, ' ').slice(0, 100)));
    fail = true;
    continue;
  }
  const before = selectors(src).length;
  const after = selectors(out).length;
  if (before - after !== removed) {
    console.error(`✗ ${f}: 规则条数对不上（${before} → ${after}，声称删了 ${removed}），未写回`);
    fail = true;
    continue;
  }
  fs.writeFileSync(f, out);
  const commentsLeft = out.split('\n').filter(l => l.includes(NEEDLE)).length;
  console.error(`✓ ${f}: 删掉 ${removed} 条规则块，规则数 ${before} → ${after}`
    + (commentsLeft ? `；还有 ${commentsLeft} 行**注释**提到 ${NEEDLE}，手工清` : ''));
}
process.exit(fail ? 1 : 0);
