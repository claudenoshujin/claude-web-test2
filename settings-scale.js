/* 电脑端设置窗口等比缩放（修改单 qa-pages-v2d/窗口尺寸对比-20261111/修改单-设置窗口等比缩放-20261111.md）。
   设计尺寸固定 1420×930，外壳和所有设置页加 CSS zoom（styles/settings-v2d.css），显示大小 = 设计尺寸 × 比例。
   比例 85%–100%，默认 90%，存 localStorage（不写酒馆设置）。屏幕放不下时先降比例，到 85% 再让窗口变窄；高度不够时内容区自己滚。
   拖窗口左右两边、左下右下两个角调比例，窗口始终居中；拖的过程只改一个虚线框，松手才写到根节点上（一次）。双击边缘恢复 90%。
   浏览器不支持 zoom 时整个功能关掉，窗口按 100%。 */
export function createSettingsScale({win, mobile, t}) {
  const doc = win.document, root = doc.documentElement;
  const KEY = 'claude-web:settings-scale', MIN = 0.85, MAX = 1, DEF = 0.9, W = 1420, H = 930;
  const supported = !!win.CSS?.supports?.('zoom', '1');
  const clamp = v => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));
  const read = () => { try { const v = parseFloat(win.localStorage.getItem(KEY)); return Number.isFinite(v) ? clamp(v) : DEF; } catch { return DEF; } };
  const VARS = ['--cw-sz', '--cw-sz-w', '--cw-sz-h', '--cw-sz-x', '--cw-sz-y'];
  let user = read(), applied = '', frame = 0, destroyed = false;
  // 屏幕放不下：比例取用户值和 (屏幕宽 − 48) ÷ 1420 里小的，但不低于 85%；到 85% 还放不下就让设计宽度变窄。
  function geometry(u) {
    const vw = win.innerWidth, vh = win.innerHeight, s = Math.max(MIN, Math.min(u, (vw - 48) / W));
    const w = Math.min(W, (vw - 48) / s), h = Math.min(H, (vh - 64) / s);
    return {s, w, h, left: (vw - w * s) / 2, top: (vh - h * s) / 2};
  }
  const active = () => supported && !destroyed && !mobile() && root.hasAttribute('data-cw-settings-unified');
  // 外壳和面板都加了 zoom，它们的 left / top 也按 zoom 后的坐标算：要落在屏幕 L 处，就写 L ÷ 比例。
  function apply() {
    frame = 0;
    if (!active()) { if (applied) { for (const k of VARS) root.style.removeProperty(k); root.removeAttribute('data-cw-sz'); applied = ''; } edges.hidden = true; return; }
    const g = geometry(user), key = [g.s, g.w, g.h, g.left, g.top].map(n => n.toFixed(2)).join();
    if (key !== applied) {
      applied = key;
      root.style.setProperty('--cw-sz', String(g.s));
      root.style.setProperty('--cw-sz-w', g.w.toFixed(2) + 'px'); root.style.setProperty('--cw-sz-h', g.h.toFixed(2) + 'px');
      root.style.setProperty('--cw-sz-x', (g.left / g.s).toFixed(2) + 'px'); root.style.setProperty('--cw-sz-y', (g.top / g.s).toFixed(2) + 'px');
      if (!root.hasAttribute('data-cw-sz')) root.setAttribute('data-cw-sz', '');
      place(edges, g);
    }
    edges.hidden = false;
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(apply); };
  function place(n, g) { const s = n.style; s.left = g.left + 'px'; s.top = g.top + 'px'; s.width = g.w * g.s + 'px'; s.height = g.h * g.s + 'px'; }
  const edges = {hidden: true, style: {}};
  win.addEventListener('resize', schedule);
  const mo = new win.MutationObserver(schedule); mo.observe(root, {attributes: true, attributeFilter: ['data-claude-layout', 'data-cw-settings-unified']});
  apply();
  return {
    get scale() { return active() ? geometry(user).s : 1; },
    refresh: schedule,
    destroy() { destroyed = true; win.removeEventListener('resize', schedule); mo.disconnect(); if (frame) win.cancelAnimationFrame(frame); for (const k of VARS) root.style.removeProperty(k); root.removeAttribute('data-cw-sz'); },
  };
}
