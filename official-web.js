/* 2.0.315（Lulu 2026-10-11 定，预览 Claude outputs/design-web-v1/design-web-v3.html）：
 * 电脑端从 Claude Desktop 的样子改成照 claude.ai 网页版。只在 rail + classic 的电脑布局里生效，
 * 手机不动。这里只加装饰和入口，不碰酒馆原生节点；样式全在 styles/official-web.css，
 * 靠 html[data-cw-web] 开关——条件不满足时摘掉属性、删掉自己加的节点，什么都不留。
 * 「首页项目⌄ / 分享 / 搜索框 / 底部图标」现在只是样子（Lulu：先做个样子）；
 * 「新建对话」真能用，等于侧栏原有的新对话按钮。
 * 2.0.316（Lulu 看了 315）：去掉「项目 / 作品」；「更多」做成真的折叠——收起时把「背景」「扩展」藏到它下面，
 * 状态记在 localStorage；日期分组一律英文（Today / Yesterday / Oct 8 / Older），照官网。
 * 2.0.317（Lulu）：「更多」收格式化、偏好设置、背景、扩展四项（留预设、API、世界书、角色卡）；
 * 搜索框变成真输入框——按角色名、聊天名、预览筛最近对话，Esc 清空。 */
export function installOfficialWeb(win = window) {
  const doc = win.document, root = doc.documentElement;
  const SV = (p, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    filter: '<path d="M7 4v6M7 14v6M17 4v2M17 10v10"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="8" r="2"/>',
    file: '<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/>',
    apps: '<circle cx="7.5" cy="7.5" r="2.6"/><circle cx="16.5" cy="7.5" r="2.6"/><circle cx="7.5" cy="16.5" r="2.6"/><path d="M16.5 13.5v6M13.5 16.5h6"/>',
  };
  const zh = () => (doc.querySelector('#ui_language_select')?.value || win.localStorage.getItem('language') || win.navigator.language || 'en').startsWith('zh');
  const t = (cn, en) => zh() ? cn : en;
  const make = (tag, cls, html) => { const n = doc.createElement(tag); n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const row = (cls, icon, text, extra = '') => make('div', 'cw-web-row ' + cls, SV(icon) + `<span class="cw-web-label">${text}</span>` + extra);
  const deco = n => { n.setAttribute('aria-hidden', 'true'); return n; };

  const active = () => root.dataset.cwV4 != null && root.dataset.claudeEnabled !== 'off'
    && root.dataset.claudeStructure === 'rail' && root.dataset.claudeSkin === 'classic'
    && root.dataset.claudeLayout !== 'mobile' && win.innerWidth > 700;

  const mine = () => doc.querySelectorAll('.cw-web-x');
  const teardown = () => { mine().forEach(n => n.remove()); delete root.dataset.cwWeb; delete root.dataset.cwWebMore; };
  // 「更多」：收起时 CSS 把背景、扩展两行压成 0 高（不 display:none 整个 .drawer——它们的设置页是 fixed 的、挂在里面，
  // 开着的页不能跟着消失）。展开 / 收起记住。
  const MORE_KEY = 'claude-web:web-more';
  const moreOpen = () => { try { return win.localStorage.getItem(MORE_KEY) === 'open'; } catch { return false; } };
  const syncMore = () => {
    const open = moreOpen();
    if ((root.dataset.cwWebMore === 'open') !== open) { if (open) root.dataset.cwWebMore = 'open'; else delete root.dataset.cwWebMore; }
    const m = doc.querySelector('#top-settings-holder > .cw-web-more'); if (m && m.getAttribute('aria-expanded') !== String(open)) m.setAttribute('aria-expanded', String(open));
  };
  const toggleMore = () => { try { win.localStorage.setItem(MORE_KEY, moreOpen() ? 'closed' : 'open'); } catch {} syncMore(); };

  // 最近对话按日期分组：一组「角色 + 它下面的重复行」跟着这组第一行的日期走，不拆开。
  const dayLabel = iso => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso); if (isNaN(d)) return null; d.setHours(0, 0, 0, 0);
    const days = Math.round((today - d) / 864e5);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return 'Older';
  };
  // 搜索：一组（角色行 + 它下面的重复行）里只要有一行对上，就留下这组的头一行；对上的行都留；
  // 整组都没对上就连同日期标题一起藏。筛的是侧栏里已经列出来的最近对话。
  let query = '';
  const rowText = r => [r.querySelector('.characterName')?.textContent, r.querySelector('.chatName')?.title, r.querySelector('.chatMeta')?.textContent, r.querySelector('.chatPreview')?.textContent].join(' ').toLowerCase();
  const filterRecents = list => {
    const q = query.trim().toLowerCase();
    const kids = [...list.children];
    let header = null, headerHits = 0, head = null, headHit = false, groupHit = false;
    const flushGroup = () => { if (head) { const keep = headHit || groupHit; head.classList.toggle('cw-web-miss', !keep); if (keep) headerHits++; } head = null; headHit = groupHit = false; };
    const flushHeader = () => { flushGroup(); if (header) header.classList.toggle('cw-web-miss', !!q && !headerHits); header = null; headerHits = 0; };
    for (const n of kids) {
      if (n.classList.contains('cw-web-date')) { flushHeader(); header = n; continue; }
      if (!n.classList.contains('recentChat')) continue;
      const hit = !q || rowText(n).includes(q);
      if (n.classList.contains('cw-rec-rep')) { n.classList.toggle('cw-web-miss', !hit); if (hit) groupHit = true; continue; }
      flushGroup(); head = n; headHit = hit;
    }
    flushHeader();
  };
  const groupRecents = list => {
    const want = []; let last = null;
    for (const r of list.children) {
      if (!r.classList.contains('recentChat') || r.classList.contains('cw-rec-rep')) continue;
      const g = dayLabel(r.querySelector('.chatDate')?.title || ''); if (!g || g === last) continue;
      last = g; want.push([r, g]);
    }
    const have = [...list.querySelectorAll(':scope > .cw-web-date')];
    const same = have.length === want.length && have.every((h, i) => h.nextElementSibling === want[i][0] && h.dataset.label === want[i][1]);
    if (same) return;
    have.forEach(h => h.remove());
    want.forEach(([r, g], i) => {
      const h = deco(make('div', 'cw-web-date cw-web-x', `<span>${g}</span>` + (i === 0 ? SV(P.filter, 'cw-web-filter') : '')));
      h.dataset.label = g; r.before(h);
    });
  };

  const ensure = () => {
    if (!active()) { if (root.dataset.cwWeb != null) teardown(); return; }
    if (root.dataset.cwWeb == null) root.dataset.cwWeb = '';
    const holder = doc.getElementById('top-settings-holder'); if (!holder) return;
    const tool = holder.querySelector(':scope > .cw-desk-tool');
    if (tool && !tool.querySelector('.cw-web-brand')) tool.querySelector(':scope > svg:nth-of-type(2)')?.after(deco(make('span', 'cw-web-brand cw-web-x', 'Claude')));
    let search = holder.querySelector(':scope > .cw-web-search');
    if (!search) {
      search = make('label', 'cw-web-search cw-web-x', SV(P.search));
      const input = doc.createElement('input');
      input.type = 'search'; input.className = 'cw-web-search-input'; input.placeholder = t('搜索', 'Search');
      input.setAttribute('aria-label', t('搜索最近对话', 'Search recent chats')); input.autocomplete = 'off'; input.spellcheck = false;
      input.value = query;
      const apply = () => { query = input.value; const l = doc.querySelector('#top-settings-holder .clawd-rail-recents .recentChatList'); if (l) filterRecents(l); };
      input.addEventListener('input', apply);
      input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; apply(); } });
      search.append(input);
      (tool || holder.firstElementChild)?.after(search);
      const fresh = row('cw-web-new cw-web-x', P.plus, t('新建对话', 'New chat'));
      fresh.setAttribute('role', 'button'); fresh.tabIndex = 0;
      // 和手机侧栏的「+ 新对话」同一条路（index.js startMobileNewChat）：先点酒馆原生「开始新聊天」，没有再走 /newchat。
      const go = async () => {
        const native = doc.querySelector('#option_start_new_chat, #new_chat, #newChat, [data-i18n="New Chat"], [data-i18n="Start new chat"]');
        if (native instanceof win.HTMLElement) { native.click(); return; }
        try { await win.SillyTavern?.getContext?.()?.executeSlashCommands?.('/newchat'); }
        catch (error) { console.error('[Claude Web] 新建对话失败:', error); win.toastr?.error?.(t('无法新建对话。', 'Could not start a new chat.')); }
      };
      fresh.addEventListener('click', go);
      fresh.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      search.after(fresh);
    }
    const chars = doc.getElementById('rightNavHolder');
    let more = holder.querySelector(':scope > .cw-web-more');
    if (chars && !more) {
      more = row('cw-web-more cw-web-x', P.chev, t('更多', 'More'));
      more.setAttribute('role', 'button'); more.tabIndex = 0;
      more.addEventListener('click', toggleMore);
      more.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMore(); } });
      chars.after(more);
    }
    syncMore();
    // 侧栏各项靠 CSS order 排；「更多」跟角色卡同一个 order、DOM 紧跟其后，就排在它下面。样式表晚到时 order 会变，每次对一遍。
    const order = chars && win.getComputedStyle(chars).order;
    if (more && order && more.style.order !== order) more.style.order = order;
    const persona = doc.querySelector('#persona-management-button > .drawer-toggle');
    if (persona && !persona.querySelector('.cw-web-apps')) persona.append(deco(make('span', 'cw-web-apps cw-web-x', SV(P.apps))));
    const list = holder.querySelector('.clawd-rail-recents .recentChatList');
    if (list) { groupRecents(list); filterRecents(list); }
    const form = doc.getElementById('send_form');
    if (form && !form.querySelector(':scope > .cw-web-proj')) form.append(deco(make('div', 'cw-web-proj cw-web-x', `<span>${t('项目', 'Project')}</span>` + SV(P.down))));
    if (!doc.querySelector('body > .cw-web-share')) doc.body.append(deco(make('div', 'cw-web-share cw-web-x', SV(P.file) + `<b>${t('分享', 'Share')}</b>`)));
  };

  if (!doc.getElementById('cw-web-style')) {
    const link = doc.createElement('link'); link.id = 'cw-web-style'; link.rel = 'stylesheet';
    link.href = new URL('styles/official-web.css?v=2.0.317', import.meta.url).href; doc.head.append(link);
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = win.requestAnimationFrame(() => { raf = 0; ensure(); }); };
  const mos = [];
  const watch = (node, opts) => { if (!node) return; const mo = new win.MutationObserver(schedule); mo.observe(node, opts); mos.push(mo); };
  watch(root, { attributes: true, attributeFilter: ['data-cw-v4', 'data-claude-enabled', 'data-claude-structure', 'data-claude-skin', 'data-claude-layout'] });
  watch(doc.body, { childList: true });
  let holderSeen = null, recSeen = null;
  const watchHolder = () => {
    // 侧栏的直接子节点（装饰被删后补回）+ 最近列表的重绘；不看整棵子树，打开的设置页里的增删与这里无关。
    const h = doc.getElementById('top-settings-holder');
    if (h && h !== holderSeen) { holderSeen = h; watch(h, { childList: true }); }
    const rec = h?.querySelector('.clawd-rail-recents');
    if (rec && rec !== recSeen) { recSeen = rec; watch(rec, { childList: true, subtree: true }); }
  };
  const tick = () => { watchHolder(); schedule(); };
  win.addEventListener('resize', schedule);
  const boot = win.setInterval(tick, 1000);
  tick();
  return () => {
    win.clearInterval(boot); win.removeEventListener('resize', schedule);
    mos.forEach(m => m.disconnect()); if (raf) win.cancelAnimationFrame(raf); teardown(); doc.getElementById('cw-web-style')?.remove();
  };
}

if (typeof window !== 'undefined' && !window.__cwOfficialWeb) window.__cwOfficialWeb = installOfficialWeb(window);
