import { officialIcons } from './official-icons.js?v=20260928b';
import { createDrawerLayouts, actionLabel } from './official-drawers.js?v=20260928b';
import { tr } from './official-i18n.js?v=20260928b';
/* Live adaptation of design-v4. Native drawers stay beneath their toggles:
 * ST resolves toggle.parent().find('.drawer-content'), and plugins delegate to
 * their original containers. Never import the preview's snapshots or fake data.
 */
export function installOfficialLayout(win = window) {
  const doc = win.document, root = doc.documentElement;
  const ids = [
    ['left-nav-panel', '预设', 'Presets'], ['rm_api_block', 'API 连接', 'API connection'],
    ['AdvancedFormatting', '格式化', 'Formatting'], ['WorldInfo', '世界书', 'World info'],
    ['Backgrounds', '背景', 'Backgrounds'], ['rm_extensions_block', '扩展', 'Extensions'],
    ['right-nav-panel', '角色卡', 'Characters'], ['PersonaManagement', '用户角色', 'Personas'],
    ['user-settings-block', '偏好设置', 'Preferences'],
  ];
  const zh = () => (doc.querySelector('#ui_language_select')?.value || win.localStorage.getItem('language') || win.navigator.language || 'en').startsWith('zh');
  const t = (cn, en) => zh() ? cn : en;
  const make = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, fn, cls = 'cw-v4-button') => { const n = make('button', cls, text); n.type = 'button'; n.addEventListener('click', fn); return n; };
  const icon = name => { const n=make('span','cw-v4-icon'); n.setAttribute('aria-hidden','true'); n.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${officialIcons[name] || officialIcons.gear}</svg>`; return n; };
  for (const [name,path] of Object.entries(officialIcons)) root.style.setProperty('--cw-v4-icon-'+name,`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`)}")`);
  const enabled = () => root.dataset.claudeStructure === 'rail' && root.dataset.claudeSkin === 'classic';
  // The mobile skin can also run in a wide desktop window. Match the CSS
  // breakpoint rather than treating the skin preference as viewport size.
  // Phones use the phone layout at any width (the stylesheets are pinned the
  // same way); on a PC a narrow window still gets the phone arrangement by width.
  const mobile = () => root.dataset.claudeLayout === 'mobile' || win.innerWidth <= 700;
  let shell, current, requestedPanel, previousFocus, raf = 0, destroyed = false;
  const observers = [], disposers = [], dialogs = new Set(), panels = new Map();
  const formattedForms = new WeakSet();
  const enhancedMenus = new WeakSet();
  const formSet = new Set();
  const on = (node, event, fn, options) => { node.addEventListener(event, fn, options); disposers.push(() => node.removeEventListener(event, fn, options)); };
  const observe = (node, fn, options) => { const mo = new win.MutationObserver(fn); mo.observe(node, options); observers.push(mo); return mo; };
  const nativeToggle = panel => panel.closest('.drawer')?.querySelector(':scope > .drawer-toggle');
  /* Preferences: the design's PAGES table (app.js). R.* take the real
   * controls out of ST's panel and put them into "title left, control right"
   * rows; labels and descriptions come from the native text and titles, as in
   * the design. Everything unmapped ends up in Advanced › Other. */
  const PAGES = [
    {key:'look',title:'外观',icon:'palette',group:'偏好设置',lede:'主题、显示样式、尺寸与颜色',sections:[
      ['主题',()=>{const sel=take('themes');addClass(sel,'cw-v4-wide');const r1=prow(t('UI 主题','UI Theme'),'当前使用的界面主题预设',[sel],'cw-v4-stack');
        const r2=R.btns('主题文件',['ui-preset-update-button','ui-preset-save-button','ui_preset_import_button','ui_preset_export_button','ui-preset-delete-button'],{icons:{'ui-preset-update-button':'save','ui-preset-save-button':'saveplus','ui_preset_import_button':'import','ui_preset_export_button':'export','ui-preset-delete-button':'trash'},desc:'覆盖保存 · 另存为新主题 · 导入 · 导出 · 删除',cls:''});
        addClass(doc.getElementById('ui-preset-delete-button'),'cw-v4-danger');const file=take('ui_preset_import_file');if(file&&r2)pm(file,r2);return [r1,r2];}],
      ['显示样式',()=>[R.sel('avatar_style'),R.sel('chat_display'),R.sel('media_display'),R.sel('toastr_position'),R.tog('waifuMode')]],
      ['尺寸',()=>[R.range('chat_width_slider','chat_width_slider_counter'),R.range('font_scale','font_scale_counter'),R.range('blur_strength','blur_strength_counter'),R.range('shadow_width','shadow_width_counter')]],
      ['颜色',()=>['main-text-color-picker','italics-color-picker','underline-color-picker','quote-color-picker','shadow-color-picker','chat-tint-color-picker','blur-tint-color-picker','border-color-picker','user-mes-blur-tint-color-picker','bot-mes-blur-tint-color-picker'].map(id=>R.color(id))],
    ]},
    {key:'ui',title:'界面',icon:'window',group:'偏好设置',lede:'动效、消息上显示的信息、交互方式',sections:[
      ['性能与效果',()=>['reduced_motion','fast_ui_mode','noShadowsmode'].map(i=>R.tog(i))],
      ['消息信息',()=>['messageTimestampsEnabled','messageTimerEnabled','messageModelIconEnabled','messageTokensEnabled','mesIDDisplayEnabled','show_swipe_num_all_messages','hideChatAvatarsEnabled'].map(i=>R.tog(i))],
      ['交互',()=>['expandMessageActions','click_to_edit','compact_input_area','enableZenSliders','enableLabMode'].map(i=>R.tog(i))],
    ]},
    {key:'char',title:'角色处理',icon:'card',group:'偏好设置',lede:'角色列表、导入与角色卡内容',sections:[
      ['角色列表',()=>[R.sel('aux_field'),R.tog('fuzzy_search_checkbox'),R.tog('hotswapEnabled'),R.tog('bogus_folders',(r,lab)=>{const v=lab.querySelector('.tags_view');if(v){const info=r.querySelector('.cw-v4-row-info');let d=info.querySelector('p');if(!d){d=make('p','');info.append(d);}pm(v,d);addClass(v,'cw-v4-linkish');v.dataset.cwLabel=L('管理标签');}}),R.tog('show_card_avatar_urls'),R.tog('zoomed_avatar_magnification')]],
      ['导入',()=>[R.sel('tag_import_setting'),R.tog('world_import_dialog'),R.tog('never_resize_avatars'),R.tog('background_thumbnails_animation')]],
      ['提示词',()=>[R.tog('prefer_character_prompt'),R.tog('prefer_character_jailbreak'),R.tog('spoiler_free_mode')]],
    ]},
    {key:'chat',title:'聊天',icon:'chat',group:'偏好设置',lede:'发送、消息显示、滑动与群聊',sections:[
      ['发送与输入',()=>[R.sel('send_on_enter'),R.tog('continue_on_send'),R.tog('quick_continue'),R.tog('quick_impersonate'),R.tog('restore_user_input'),R.tog('enable_auto_select_input'),R.tog('enable_md_hotkeys')]],
      ['消息',()=>[R.range('chat_truncation','chat_truncation_counter'),R.sel('example_messages_behavior'),R.tog('auto-load-chat-checkbox'),R.tog('auto_scroll_chat_to_bottom'),R.tog('auto_save_msg_edits'),R.tog('confirm_message_delete'),R.tog('auto_fix_generated_markdown'),R.tog('forbid_external_media'),R.tog('allow_name2_display'),R.tog('allow_name1_display'),R.tog('encode_tags'),R.tog('pin_styles')]],
      ['滑动',()=>[R.tog('swipes-checkbox'),R.tog('gestures-checkbox'),R.sel('image_overswipe')]],
      ['群聊',()=>[R.tog('disable_group_trimming'),R.tog('show_group_chat_queue')]],
    ]},
    {key:'gen',title:'生成与流式',icon:'wave',group:'偏好设置',lede:'流式输出、提示音、自动重滑与自动续写',sections:[
      ['流式输出',()=>[R.range('streaming_fps','streaming_fps_counter'),R.tog('smooth_streaming'),R.tog('smooth_streaming_no_think'),R.range('smooth_streaming_speed',null,{label:t('平滑流式速度','Smooth Streaming Speed'),desc:'',hint:true}),R.tog('stream_fade_in')]],
      ['提示音',()=>[R.tog('play_message_sound'),R.tog('play_sound_unfocused')]],
      ['自动重滑（Auto-swipe）',()=>[R.tog('auto_swipe'),R.num('auto_swipe_minimum_length'),R.area('auto_swipe_blacklist','','逗号分隔','cw-v4-area cw-v4-words'),R.num('auto_swipe_blacklist_threshold')]],
      ['自动续写（Auto-Continue）',()=>[R.tog('auto_continue_enabled'),R.tog('auto_continue_allow_chat_completions'),R.num('auto_continue_target_length')]],
    ]},
    {key:'adv',title:'高级',icon:'terminal',group:'系统',lede:'宏与脚本、自动补全、窗口拖动、自定义 CSS、调试',sections:[
      ['宏与 STscript',()=>[R.tog('experimental_macro_engine'),R.tog('stscript_parser_flag_strict_escaping'),R.tog('stscript_parser_flag_replace_getvar')]],
      ['自动补全',()=>{const rows=[R.sel('stscript_autocomplete_state'),R.tog('stscript_autocomplete_autoHide'),R.tog('stscript_autocomplete_showInAllMacroFields'),R.sel('stscript_matching'),R.sel('stscript_autocomplete_style'),R.sel('stscript_autocomplete_select'),R.range('stscript_autocomplete_font_scale','stscript_autocomplete_font_scale_counter')];
        const w=make('div','cw-v4-width-pair');prefParts.push(w);for(const id of ['stscript_autocomplete_width_left','stscript_autocomplete_width_right','stscript_autocomplete_width_left_values','stscript_autocomplete_width_right_values']){const n=take(id);if(n)pm(n,w);}
        const r=prow(t('宽度','Width'),'左右两侧宽度',[]);r.lastElementChild.append(w);return [...rows,r];}],
      ['窗口拖动（MovingUI）',()=>{const r=R.sel('movingUIPresets');const b=take('movingui-preset-save-button');if(r&&b){addClass(b,'cw-v4-pref-btn','cw-v4-icononly');const ic=icon('saveplus');b.prepend(ic);prefParts.push(ic);pm(b,r.querySelector('.cw-v4-row-controls'));}
        return [R.tog('movingUImode'),R.btns('重置面板位置',['movingUIreset'],{cls:''}),r];}],
      ['自定义 CSS',()=>{const ex=prefPanel.querySelector('#CustomCSS-block .editor_maximize');const r=R.area('customCSS',t('自定义 CSS','Custom CSS'),'对整个酒馆界面生效');if(r&&ex){addClass(ex,'cw-v4-pref-btn','cw-v4-icononly');const ic=icon('expand');ex.prepend(ic);prefParts.push(ic);pm(ex,r.querySelector('.cw-v4-row-title'));}return [r];}],
      ['调试与维护',()=>[R.btns('工具',['reload_chat','debug_menu','data_maid_button'],{desc:'重新载入当前聊天 · 调试菜单 · 清理备份和无用文件',cls:'cw-v4-stack'}),R.tog('console_log_prompts'),R.tog('request_token_probabilities'),R.tog('relaxed_api_urls')]],
    ]},
    {key:'acct',title:'账户与语言',icon:'user',group:'系统',lede:'',sections:[
      ['语言',()=>[R.sel('ui_language_select',{label:t('界面语言','UI Language'),desc:'「默认」跟随浏览器语言'})]],
      ['账户',()=>{const r=R.btns('账户',['account_button','admin_button','logout_button'],{cls:''});const v=take('version_display');addClass(v,'cw-v4-version');return [r,v?prow(t('版本','Version'),'',[v]):null];}],
    ]},
  ];
  const L = s => tr(zh(), s);
  let prefPage = 'look', searchQuery = '', prefPanel = null;
  const prefMoves = [], prefParts = [], prefClasses = [];
  const chatMoves=[];
  function pm(node,host){if(!node||node===host)return;if(node.parentNode){const mark=doc.createComment('cw-v4-pref-return');node.before(mark);prefMoves.push([node,mark]);}host.append(node);}
  const take = id => { const n=doc.getElementById(id); return n && prefPanel?.contains(n) && !n.closest('.cw-v4-pref-pages') ? n : null; };
  const addClass=(n,...c)=>{if(!n)return;n.classList.add(...c);prefClasses.push([n,c]);};
  const clean = s => (s || '').replace(/\s+/g, ' ').replace(/[:：]\s*$/, '').trim();
  function textOf(n){if(!n)return '';const c=n.cloneNode(true);c.querySelectorAll('input,select,textarea,i,a,audio,.fa-solid,.fa-brands,div.fa-solid').forEach(x=>x.remove());return clean(c.textContent);}
  const titleOf=(...els)=>{for(const e of els){const v=e?.getAttribute?.('title')||'';if(v&&!v.startsWith('['))return v.split('\n').map(l=>l.trim()).filter(Boolean).join('\n');}return '';};
  function tagsOf(n){if(!n)return [];const pc=n.querySelector('.fa-desktop'),mob=n.querySelector('.fa-mobile-screen-button'),lab=n.querySelector('.fa-flask');const out=[];if(pc&&!mob)out.push(['仅电脑','']);if(mob&&!pc)out.push(['仅手机','']);if(lab)out.push(['实验',' cw-v4-tag-exp']);return out;}
  // row(): "title + description" on the left, controls on the right.
  function prow(label,desc,ctls,cls='',tags=[]){
    const r=make('div','cw-v4-row cw-v4-pref-row'+(cls?' '+cls:'')),info=make('div','cw-v4-row-info'),box=make('div','cw-v4-row-controls');
    const title=make('div','cw-v4-row-title',label||'');for(const [tag,c] of tags)title.append(make('span','cw-v4-tag'+c,L(tag)));info.append(title);
    if(desc)info.append(make('p','',L(desc)));
    r.append(info,box);for(const c of ctls)if(c)pm(c,box);return r;
  }
  const R = {
    tog(id,extra){const el=take(id);if(!el)return null;const lab=el.closest('label')||el.parentElement;const text=[...lab.children].find(c=>!['INPUT','I','A','AUDIO'].includes(c.tagName));
      const r=prow(textOf(text)||labelFor(el),titleOf(lab),[el],'',tagsOf(lab));lab.querySelectorAll('audio').forEach(a=>pm(a,r));if(extra)extra(r,lab);return r;},
    sel(id,o={}){const el=take(id);if(!el)return null;const wrap=el.closest('div')||el.parentElement;const lab=prefPanel.querySelector(`label[for="${id}"]`)||[...wrap.children].find(c=>c!==el&&/^(SPAN|SMALL|LABEL)$/.test(c.tagName))||wrap.querySelector('label');
      return prow(o.label||textOf(lab)||labelFor(el),o.desc??titleOf(el,wrap,wrap.parentElement),[el],'cw-v4-stackm');},
    range(id,num,o={}){const el=take(id);if(!el)return null;const n=num?take(num):null,box=el.parentElement;const lab=box.querySelector('small span, label, small');const info=box.querySelector('.fa-circle-info');
      let desc=o.desc??titleOf(info,box);const more=[...box.querySelectorAll(':scope > small')].slice(1).map(s=>clean(s.textContent)).join(' ');if(more)desc=desc?`${desc} ${more}`:more;
      const rb=make('div','cw-v4-rangebox');prefParts.push(rb);const hint=o.hint?box.querySelector('.slider_hint'):null;pm(el,rb);if(hint)pm(hint,rb);
      addClass(n,'cw-v4-num');
      const r=prow(o.label||textOf(lab),desc,[],'cw-v4-range cw-v4-stackm',tagsOf(box.querySelector('small')));r.lastElementChild.append(rb);if(n)pm(n,r.lastElementChild);return r;},
    num(id,label){const el=take(id);if(!el)return null;let lab=el.previousElementSibling;while(lab&&!/^(SMALL|SPAN|LABEL)$/.test(lab.tagName))lab=lab.previousElementSibling;addClass(el,'cw-v4-num');return prow(label||textOf(lab)||labelFor(el),titleOf(el),[el]);},
    btns(label,ids,o={}){const els=ids.map(id=>{const b=take(id);if(!b)return null;addClass(b,'cw-v4-pref-btn');
        if(o.icons?.[id]){addClass(b,'cw-v4-icononly');const ic=icon(o.icons[id]);b.prepend(ic);prefParts.push(ic);}
        else b.querySelectorAll('i').forEach(i=>{const g={'fa-recycle':'reset','fa-user-shield':'shield','fa-user-tie':'user','fa-right-from-bracket':'logout'};const k=Object.keys(g).find(c=>i.classList.contains(c));if(k){const ic=icon(g[k]);i.before(ic);prefParts.push(ic);}});
        return b;});
      return prow(label?L(label):'',o.desc||'',els,o.cls??'cw-v4-stackm');},
    color(id){const el=take(id);if(!el)return null;return prow(textOf(el.nextElementSibling),'',[el]);},
    area(id,label,desc,cls='cw-v4-area'){const el=take(id);if(!el)return null;addClass(el,...cls.split(' '));el.dataset.cwV4Text='1';let lab=el.previousElementSibling;while(lab&&!/^(SMALL|SPAN|LABEL)$/.test(lab.tagName))lab=lab.previousElementSibling;if(!lab)lab=el.parentElement?.previousElementSibling;return prow(label||textOf(lab),desc,[el],'cw-v4-stack');},
  };
  const drawerLayouts=createDrawerLayouts({win,t,L,make,button,icon,openEditor,closeSettings});
  function restorePrefs() {
    const panel = panels.get('user-settings-block'), pages = panel?.querySelector('.cw-v4-pref-pages');
    if (!pages) return;
    const remaining = pages.querySelector('.cw-v4-pref-remaining');
    if (remaining) panel.append(...remaining.childNodes);
    for (const [node,marker] of [...prefMoves].reverse()) if (marker.parentNode) marker.replaceWith(node);
    prefParts.forEach(n=>n.remove());prefParts.length=0;
    for(const [n,c] of prefClasses.splice(0))n.classList.remove(...c);
    doc.getElementById('customCSS')?.removeAttribute('data-cw-v4-text');doc.getElementById('auto_swipe_blacklist')?.removeAttribute('data-cw-v4-text');
    prefMoves.length = 0; pages.remove();
  }
  function restoreAdaptedContainers() {
    doc.querySelectorAll('.cw-v4-swipes,.cw-v4-model').forEach(n=>n.remove());
    for(const [node,mark] of chatMoves.splice(0).reverse())if(mark.parentNode)mark.replaceWith(node);
    drawerLayouts.restore();
    restorePrefs();
    for (const panel of panels.values()) {
      panel.querySelector(':scope>.cw-v4-page-title')?.remove();
      panel.querySelectorAll('.cw-v4-more:not(.cw-v4-created)').forEach(menu => {
        menu.before(...menu.querySelector('.cw-v4-more-list').childNodes); menu.remove();
      });
      panel.querySelectorAll('.cw-v4-action-label').forEach(n=>n.remove());
      if (panel.classList.contains('cw-v4-inactive')) panel.classList.remove('cw-v4-inactive');
    }
    for (const form of formSet) {
      form.querySelectorAll(':scope > .cw-v4-api-row').forEach(row=>{row.before(...row.firstElementChild.childNodes,...row.lastElementChild.childNodes);row.remove();});
      formattedForms.delete(form);
    }
    formSet.clear();
  }
  function selectPrefs(key) {
    prefPage = key;
    shell?.classList.remove('cw-v4-show-nav');
    const p = panels.get('user-settings-block');
    p?.querySelectorAll('.cw-v4-pref-page').forEach(n => { n.hidden = !searchQuery && !mobile() && n.dataset.page !== key; });
    shell?.querySelectorAll('[data-pref]').forEach(b => b.classList.toggle('cw-v4-selected', b.dataset.pref === key));
    if (current?.id !== 'user-settings-block') activate('user-settings-block');
    if (p && !mobile()) p.scrollTop = 0;
    schedule();
  }
  function buildPrefs(panel) {
    if (panel.querySelector('.cw-v4-pref-pages')) return;
    prefPanel = panel;
    const pages = make('div','cw-v4-pref-pages');
    for (const p of PAGES) {
      const page = make('section','cw-v4-pref-page'); page.dataset.page = p.key;
      page.append(make('h2','cw-v4-pref-title',L(p.title)));
      if (p.lede) page.append(make('p','cw-v4-lede',L(p.lede)));
      for (const [title,build] of p.sections) {
        const sec = make('div','cw-v4-section cw-v4-pref-sec'); sec.append(make('h2','',L(title)));
        for (const r of build()) if (r) sec.append(r);
        page.append(sec);
      }
      pages.append(page);
    }
    // Safety net: anything the table missed still gets a row, so no native
    // control disappears (plugins can add settings here too).
    const hidden = n => { for (let x = n; x && x !== panel; x = x.parentElement) if (x.hidden || x.classList.contains('displayNone') || x.style.display === 'none') return true; return false; };
    const left = [...panel.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea,.menu_button,toolcool-color-picker')].filter(n => n.id && !pages.contains(n) && !hidden(n) && n.id !== 'settingsSearch' && !n.closest('.menu_button:not(#' + CSS.escape(n.id) + ')'));
    if (left.length) {
      const other = make('div','cw-v4-section cw-v4-pref-sec'); other.append(make('h2','',L('其他')));
      for (const n of left) other.append(prow(labelFor(n) || n.id, '', [n]));
      pages.querySelector('[data-page="adv"]')?.append(other);
    }
    const remaining = make('div','cw-v4-pref-remaining');
    while (panel.firstChild) remaining.append(panel.firstChild);
    pages.append(remaining); panel.append(pages);
    selectPrefs(prefPage);
  }
  const isOpen = p => p.classList.contains('openDrawer') && !p.classList.contains('closedDrawer');
  function closeSettings() {
    for (const dialog of dialogs) dialog.close();
    for (const p of panels.values()) if (isOpen(p)) nativeToggle(p)?.click();
  }
  function activate(id) {
    requestedPanel = id;
    const p = panels.get(id);
    if (p && !isOpen(p)) {
      // ST waits for its closing animation when another unpinned drawer is
      // open. Close it synchronously first, keeping our shared shell mounted.
      for (const old of panels.values()) if (old !== p && isOpen(old) && !old.classList.contains('pinnedOpen')) nativeToggle(old)?.click();
      nativeToggle(p)?.click();
    }
  }
  function buildShell() {
    shell = make('div', 'cw-v4-shell'); shell.id = 'cw-v4-settings'; shell.hidden = true;
    on(shell, 'mousedown', e => e.stopPropagation());
    on(shell, 'touchstart', e => e.stopPropagation(), {passive:true});
    shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-label', t('偏好设置', 'Preferences'));
    const nav = make('nav', 'cw-v4-nav'); nav.setAttribute('aria-label', t('设置页面', 'Settings pages'));
    const searchBox=make('label','cw-v4-search'); const search=make('input',''); search.type='search'; search.placeholder=L('搜索设置'); search.setAttribute('aria-label',search.placeholder); searchBox.append(icon('search'),search); nav.append(searchBox);
    on(search,'input',()=>{searchQuery=search.value.trim().toLocaleLowerCase();if(searchQuery)activate('user-settings-block');schedule();});
    nav.append(make('div', 'cw-v4-group', L('酒馆')));
    ids.forEach(([id, cn, en], i) => {
      if (i === 8) { nav.append(make('div', 'cw-v4-group', L('偏好设置'))); return; }
      const b = button('', () => activate(id), 'cw-v4-navitem'); b.append(icon(['sliders','plug','type','book','image','puzzle','card','user'][i]),make('span','',L(cn))); b.dataset.panel = id; nav.append(b);
    });
    for (const p of PAGES) {
      if (p.key === 'adv') nav.append(make('div','cw-v4-group',L('系统')));
      const b = button('', () => {search.value='';searchQuery='';selectPrefs(p.key);}, 'cw-v4-navitem cw-v4-pref-nav'); b.append(icon(p.icon),make('span','',L(p.title))); b.dataset.pref = p.key; nav.append(b);
    }
    const head = make('header', 'cw-v4-head');
    const back = button('', () => shell.classList.toggle('cw-v4-show-nav'), 'cw-v4-menu'); back.append(icon('menu')); back.setAttribute('aria-label', t('设置导航', 'Settings navigation'));
    const title = make('h1', 'cw-v4-title');
    const close = button('', closeSettings, 'cw-v4-close'); close.append(icon('close')); close.setAttribute('aria-label', t('关闭设置', 'Close settings'));
    head.append(back, title, close);
    const grip = make('div', 'cw-v4-grip'); grip.title = t('拖动移动 · 双击复位', 'Drag to move · Double click to reset');
    shell.append(nav, head, grip); doc.body.append(shell);
    const backdrop = make('div','cw-v4-backdrop');
    doc.querySelector('#top-settings-holder')?.append(backdrop);
    on(backdrop,'mousedown',e=>e.stopPropagation());
    on(backdrop,'click',closeSettings);
    disposers.push(()=>backdrop.remove());
    on(grip, 'dblclick', resetGeometry);
    on(grip, 'pointerdown', e => drag(e, 'move'));
    for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = make('div', `cw-v4-resize cw-v4-${edge}`);
      on(handle, 'pointerdown', e => drag(e, edge)); shell.append(handle);
    }
  }
  function resetGeometry() {
    for (const k of ['x','y','w','h']) root.style.removeProperty('--cw-v4-' + k);
  }
  function drag(e, mode) {
    if (mobile() || e.button !== 0 || e.isPrimary === false) return;
    e.preventDefault(); const b = shell.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const handle = e.currentTarget; handle.setPointerCapture?.(e.pointerId);
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      let x = b.x, y = b.y, w = b.width, h = b.height;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      const minW = Math.min(620, win.innerWidth), minH = Math.min(420, win.innerHeight);
      if (mode === 'move') { x = Math.max(0, Math.min(win.innerWidth-w, x+dx)); y = Math.max(0, Math.min(win.innerHeight-h, y+dy)); }
      else {
        if (mode.includes('e')) w = Math.min(win.innerWidth-x, Math.max(minW,w+dx));
        if (mode.includes('s')) h = Math.min(win.innerHeight-y, Math.max(minH,h+dy));
        if (mode.includes('w')) { x = Math.max(0, Math.min(b.right-minW,x+dx)); w = b.right-x; }
        if (mode.includes('n')) { y = Math.max(0, Math.min(b.bottom-minH,y+dy)); h = b.bottom-y; }
      }
      for (const [k,v] of Object.entries({x,y,w,h})) root.style.setProperty('--cw-v4-'+k, v+'px');
    };
    const end = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); handle.removeEventListener('lostpointercapture', end); };
    handle.addEventListener('pointermove', move); ['pointerup','pointercancel','lostpointercapture'].forEach(type => handle.addEventListener(type,end));
  }
  // Dialog stays inside the original parent (form, world entry, or extension
  // container). Delegated events and closest() relationships remain intact.
  // opts.head replaces the title, opts.foot goes left of Done, opts.onClose
  // runs after the node is back in place (design openDialog).
  function openEditor(node, title, desc, opts = {}) {
    if (!node.isConnected || node.classList.contains('cw-v4-editing')) return;
    const anchor = doc.createComment('cw-v4-return'); node.before(anchor);
    const dialog = make('dialog', 'cw-v4-editor popup');
    const head = make('header', 'cw-v4-editor-head'); head.append(opts.head || make('h2', '', title));
    const close = button('', () => dialog.close(),'cw-v4-button cw-v4-editor-x');close.append(icon('close'));close.setAttribute('aria-label',L('关闭'));head.append(close);
    const footer=make('footer','cw-v4-editor-footer');if(opts.foot){footer.append(opts.foot,make('span','cw-v4-grow'));}footer.append(button(L('完成'),()=>dialog.close(),'cw-v4-button cw-v4-primary'));
    const body = make('div', 'cw-v4-editor-body');
    if (desc) body.append(make('p','cw-v4-editor-desc',desc));
    if (node.matches('textarea')) dialog.classList.add('cw-v4-text-editor');
    anchor.after(dialog); body.append(node); dialog.append(head, body,footer);
    // Select2 normally attaches results to body, which is behind a modal's
    // top layer. Preserve its existing adapter/options and change only host.
    const pickerHosts=[];
    node.querySelectorAll('select').forEach(select=>{
      const adapter=win.jQuery?.(select).data?.('select2')?.dropdown;
      if(adapter?.$dropdownParent){pickerHosts.push([adapter,adapter.$dropdownParent,select]);adapter.$dropdownParent=win.jQuery(dialog);}
    });
    const oldHidden = node.hidden, oldDisplay = node.style.display, oldPriority=node.style.getPropertyPriority('display');
    node.hidden = false; node.style.setProperty('display', 'block','important'); node.classList.add('cw-v4-editing');
    const focus = doc.activeElement;
    dialogs.add(dialog);
    dialog.addEventListener('close', () => {
      for(const [adapter,parent,select] of pickerHosts){win.jQuery(select).select2('close');adapter.$dropdownParent=parent;}
      node.hidden = oldHidden; node.style.setProperty('display',oldDisplay,oldPriority); node.classList.remove('cw-v4-editing');
      if (anchor.parentNode) anchor.replaceWith(node);
      try { opts.onClose?.(); } catch (error) { console.warn('[Claude Web] editor close', error); }
      dialog.remove(); dialogs.delete(dialog); focus?.isConnected && focus.focus(); schedule();
    }, {once:true});
    dialog.showModal(); (node.matches('textarea') ? node : close).focus();
  }
  function labelFor(node) {
    const label = node.id && doc.querySelector(`label[for="${win.CSS.escape(node.id)}"]`);
    return (label?.textContent || node.getAttribute('aria-label') || node.previousElementSibling?.textContent || node.title || node.name || node.id || '').trim().slice(0,120);
  }
  function enhance(panel) {
    drawerLayouts.mount(panel);
    if (panel.id === 'user-settings-block') buildPrefs(panel);
    if (panel.id === 'rm_api_block') {
      panel.querySelectorAll('#openai_api > form,#openai_api > [id$="_form"],#azure_openai_settings').forEach(form => {
        if (formattedForms.has(form)) return;
        formattedForms.add(form);
        formSet.add(form);
        let row;
        for (const child of [...form.children]) {
          if (child.matches('h3,h4,h5')) {
            row = make('div','cw-v4-api-row'); const title = make('div','cw-v4-api-label'); child.before(row);title.append(child);row.append(title,make('div','cw-v4-api-controls'));
          } else if(child.querySelector(':scope>h3,:scope>h4,:scope>h5')) {
            row=null;child.classList.add('cw-v4-api-inline-row');
          } else if(child.matches('label.checkbox_label,.checkbox_label')) {
            row=null;
          } else if(row&&child.matches('small,ol,ul,p,a,.neutral_warning'))row.firstElementChild.append(child);
          else if (row && !child.matches('input[type=hidden]')) row.lastElementChild.append(child);
        }
        // Usage links and step lists read as the row's description. Only the
        // leading text-only nodes move, so restoring keeps the native order.
        form.querySelectorAll(':scope > .cw-v4-api-row').forEach(r=>{
          const [label,controls]=r.children;
          while(controls.firstElementChild&&!controls.firstElementChild.matches('input,select,textarea,button,.menu_button,:has(input,select,textarea,button,.menu_button)')&&controls.firstElementChild.textContent.trim()){controls.firstElementChild.classList.add('cw-v4-api-note');label.append(controls.firstElementChild);}
        });
      });
    }
    // Keep source-specific and plugin ancestors: ST toggles their visibility.
    panel.querySelectorAll('label.checkbox_label:not([data-v-app] *):not(:has(.sr-only))').forEach(n => n.classList.add('cw-v4-setting-row'));
    panel.querySelectorAll('.range-block').forEach(n => n.classList.add('cw-v4-range-row'));
    // Move real buttons, including data attributes and their visibility state.
    // Menus remain inside each original action group for delegated listeners.
    const moreSelector = '[data-preset-manager-new],[data-preset-manager-rename],[data-preset-manager-import],[data-preset-manager-export],[data-preset-manager-restore],[data-preset-manager-delete],#new_oai_preset,#import_oai_preset,#export_oai_preset,#delete_oai_preset,#create_connection_profile,#view_connection_profile,#edit_connection_profile,#reload_connection_profile,#delete_connection_profile,#personas_backup,#personas_restore';
    const actionGroups = new Map();
    panel.querySelectorAll(moreSelector).forEach(n => {
      if (n.closest('.cw-v4-more,dialog')) return;
      const parent = n.parentElement;
      if (!actionGroups.has(parent)) actionGroups.set(parent,[]);
      actionGroups.get(parent).push(n);
    });
    for (const [parent,actions] of actionGroups) {
      if (actions.length < 2) continue;
      const menu = make('details','cw-v4-more'), summary = make('summary','','⋯');
      summary.setAttribute('aria-label',t('更多操作','More actions'));
      const list = make('div','cw-v4-more-list');
      actions[0].before(menu);menu.append(summary,list);
      for (const action of actions) {
        const label = actionLabel(action,t);
        if (label && !action.textContent.trim()) { const text=make('span','cw-v4-action-label',label);action.append(text); }
        list.append(action);
      }
    }
    panel.querySelectorAll('.cw-v4-more').forEach(menu=>{
      if(enhancedMenus.has(menu))return;enhancedMenus.add(menu);
      const list=menu.querySelector(':scope>.cw-v4-more-list'),summary=menu.querySelector('summary');
      if(!list||!list.showPopover)return;
      list.setAttribute('popover','manual');
      on(menu,'toggle',()=>{
        if(!menu.open){if(list.matches(':popover-open'))list.hidePopover();return;}
        doc.querySelectorAll('.cw-v4-more[open]').forEach(other=>{if(other!==menu)other.open=false;});
        list.showPopover();
        const anchor=summary.getBoundingClientRect(),box=list.getBoundingClientRect();
        list.style.left=Math.max(8,Math.min(anchor.right-box.width,win.innerWidth-box.width-8))+'px';
        list.style.top=Math.max(8,Math.min(anchor.bottom+6,win.innerHeight-box.height-8))+'px';
      });
      on(doc,'click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
      on(doc,'keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;e.preventDefault();e.stopPropagation();}},true);
      on(list,'click',e=>{if(e.target.closest('.menu_button,button'))menu.open=false;});
      disposers.push(()=>{if(list.matches(':popover-open'))list.hidePopover();});
    });
    // Native textareas continue to save using their original input handlers.
    panel.querySelectorAll('textarea').forEach(ta => {
      if (ta.dataset.cwV4Text || ta.matches('.select2-search__field') || ta.closest('.select2-container,[data-v-app],#extensions_settings,#extensions_settings2,.world_entry,dialog') || ta.id === 'settingsSearch' || ta.classList.contains('displayNone') || ta.style.display === 'none') return;
      ta.dataset.cwV4Text = '1';
      const row = make('div', 'cw-v4-text-row'), preview = make('span', 'cw-v4-text-preview');
      const title = labelFor(ta);
      const edit = button(t('编辑','Edit'), () => openEditor(ta, title));
      const paint = () => { const text = ta.value.trim() || t('（空）','(Empty)'); if (preview.textContent !== text) preview.textContent = text; };
      paint(); on(ta,'input',paint); on(ta,'change',paint);
      row.append(preview,edit); ta.before(row); ta.classList.add('cw-v4-text-source');
      // The preview is refreshed when opening settings as programmatic preset
      // loads need not emit an input event.
      ta._cwV4Paint = paint;
    });
    panel.querySelectorAll('.world_entry').forEach(entry => {
      if (entry.querySelector('.cw-v4-entry-edit')) return;
      const content = entry.querySelector('.inline-drawer-content');
      const header = entry.querySelector('.inline-drawer-header');
      if (!content || !header) return;
      const edit = button(t('配置','Configure'), e => { e.stopPropagation(); openEditor(content, t('世界书条目','World info entry')); }, 'cw-v4-button cw-v4-entry-edit');
      header.append(edit);
    });
    if (panel.id === 'rm_extensions_block') {
      panel.querySelectorAll('#extensions_settings > div, #extensions_settings2 > div').forEach(ext => {
        if (ext.dataset.cwV4Extension || ext.closest('dialog') || !ext.querySelector('.inline-drawer-header')) return;
        ext.dataset.cwV4Extension = '1';
        const header = ext.querySelector('.inline-drawer-header');
        const title = header.querySelector('b,strong')?.textContent.trim() || header.textContent.trim();
        const edit = button(t('配置','Configure'), e => { e.stopPropagation(); openEditor(ext,title); }, 'cw-v4-button cw-v4-extension-edit');
        header.append(edit);
      });
    }
  }
  // Desktop chat header (design chat.js): "name · date ⌄" opens ST's chat
  // files, ⋯ opens ST's options menu. Hidden on the welcome page and phones.
  function syncChatHead(ctx) {
    let head = doc.querySelector('.cw-v4-chat-head');
    const show = enabled() && !mobile() && !doc.body.classList.contains('clawd-welcome') && !!ctx?.chatId;
    if (!show) { head?.remove(); return; }
    if (!head) {
      head = make('header','cw-v4-chat-head');
      const title = button('', () => doc.getElementById('option_select_chat')?.click(), 'cw-v4-chat-title');
      title.append(make('span','cw-v4-chat-name'), make('span','cw-v4-chat-date'), icon('down'));
      const more = button('', () => doc.getElementById('options_button')?.click(), 'cw-v4-chat-more'); more.append(icon('dots')); more.setAttribute('aria-label', L('聊天操作'));
      head.append(title, make('span','cw-v4-grow'), more);
      doc.getElementById('sheld')?.append(head);
    }
    const name = (ctx.groupId ? ctx.groups?.find(g => g.id === ctx.groupId)?.name : ctx.name2) || '';
    const m = String(ctx.chatId).match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m/);
    const date = m ? new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]).toLocaleString(zh() ? 'zh-CN' : 'en-US', { month: zh() ? 'numeric' : 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const set = (sel, v) => { const n = head.querySelector(sel); if (n.textContent !== v) n.textContent = v; };
    set('.cw-v4-chat-name', name.trim()); set('.cw-v4-chat-date', date);
    const left = Math.max(0, Math.round(doc.getElementById('top-settings-holder')?.getBoundingClientRect().right || 0)) + 'px';
    if (head.style.left !== left) head.style.left = left;
  }
  // Model name after the time, in place of ST's provider icon (which is "?"
  // for custom endpoints). Follows ST's "Model icon" switch via body.no-modelIcons.
  const shortModel = id => String(id).split('/').pop().replace(/[-_@](?:\d{8}|\d{4}-\d{2}-\d{2})$/, '');
  function syncModelNames(chat, ctx) {
    chat.querySelectorAll('.mes[is_user="false"]:not([is_system="true"])').forEach(mes => {
      const time = mes.querySelector('.ch_name .timestamp'); if (!time) return;
      const model = ctx?.chat?.[Number(mes.getAttribute('mesid'))]?.extra?.model || '';
      let tag = mes.querySelector('.cw-v4-model');
      if (!model) { tag?.remove(); return; }
      if (!tag) { tag = make('span', 'cw-v4-model'); }
      if (tag.previousElementSibling !== time) time.after(tag);
      const text = shortModel(model);
      if (tag.textContent !== text) tag.textContent = text;
      if (tag.title !== model) tag.title = model;
    });
  }
  function syncChat() {
    const chat = doc.querySelector('#chat'); if (!chat) return;
    if (enabled()) syncModelNames(chat, win.SillyTavern?.getContext?.());
    if(enabled())chat.querySelectorAll('.mes[is_user="false"] .mes_buttons').forEach(bar=>{
      for(const selector of ['.mes_copy','.mes_narrate']){const n=bar.querySelector(selector);if(n&&n.parentElement!==bar){const mark=doc.createComment('cw-v4-chat-return');n.before(mark);chatMoves.push([n,mark]);bar.append(n);}}
      const message=bar.closest('.mes'),source=message.querySelector('.swipes-counter');
      let swipes=bar.querySelector('.cw-v4-swipes');
      if(source&&message.querySelector(':scope>.claude-swipe-right-proxy')){
        if(!swipes){
          swipes=make('div','cw-v4-swipes');const count=make('span','cw-v4-swipe-count');
          for(const [direction,glyph,cn,en] of [['left','‹','上一条回复','Previous reply'],['right','›','下一条回复','Next reply']]){
            const arrow=button(glyph,e=>{e.stopPropagation();message.querySelector(`:scope>.claude-swipe-${direction}-proxy`)?.click();},`cw-v4-swipe-${direction}`);
            arrow.setAttribute('aria-label',t(cn,en));swipes.append(arrow);if(direction==='left')swipes.append(count);
          }bar.prepend(swipes);
        }
        const count=swipes.querySelector('.cw-v4-swipe-count'),value=source.textContent.trim();if(count.textContent!==value)count.textContent=value;
        for(const direction of ['left','right']){const original=message.querySelector(`:scope>.claude-swipe-${direction}-proxy`),arrow=swipes.querySelector(`.cw-v4-swipe-${direction}`);if(arrow.disabled!==Boolean(original?.disabled))arrow.disabled=Boolean(original?.disabled);}
      }else swipes?.remove();
    });
    const ctx = win.SillyTavern?.getContext?.();
    const group = ctx?.groupId != null && ctx.groupId !== '';
    doc.body.classList.toggle('cw-v4-group-chat', group);
    const input = doc.querySelector('#send_textarea');
    doc.body.classList.toggle('cw-v4-filled', Boolean(input?.value.trim()));
    syncChatHead(ctx);
    const chrome = doc.querySelector('.clawd-mobile-chrome');
    if (chrome && !chrome.querySelector('.cw-v4-temporary')) {
      const temp = button('', async () => {
        temp.disabled = true;
        try {
          const st = await import(new URL('/script.js', win.location.href).href);
          await st.newAssistantChat({temporary:true});
        } catch (error) { win.toastr?.error?.(t('无法打开临时聊天','Could not open a temporary chat')); console.warn('[Claude Web] temporary chat',error); }
        finally { temp.disabled = false; }
      }, 'cw-v4-temporary');
      temp.setAttribute('aria-label',t('临时聊天','Temporary chat'));temp.title=t('临时聊天','Temporary chat');
      temp.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 2-4-2-3 2Z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></svg>';
      chrome.append(temp);
    }
    const last = [...chat.querySelectorAll('.mes[is_user="false"]:not([is_system="true"])')].at(-1);
    let disclaimer = chat.querySelector('.cw-v4-disclaimer');
    if (!last || doc.body.classList.contains('clawd-welcome') || !enabled()) { disclaimer?.remove(); return; }
    if (!disclaimer) { disclaimer = make('div','cw-v4-disclaimer'); chat.append(disclaimer); }
    const name = last.querySelector('.name_text')?.textContent.trim() || ctx?.name2 || 'AI';
    const text = `${name} is AI and can make mistakes.`;
    if (disclaimer.textContent !== text) disclaimer.textContent = text;
    if (disclaimer !== chat.lastElementChild) chat.append(disclaimer);
    const offset=Math.max(0,last.getBoundingClientRect().left-chat.getBoundingClientRect().left-parseFloat(win.getComputedStyle(chat).paddingLeft||0));
    const inset=`${offset}px`;if(disclaimer.style.marginLeft!==inset)disclaimer.style.marginLeft=inset;
    if (input) { const placeholder = t(`回复 ${name}`,`Reply to ${name}`); if (input.placeholder !== placeholder) input.placeholder = placeholder; }
  }
  function sync() {
    raf = 0; if (destroyed) return;
    root.toggleAttribute('data-cw-v4', enabled());
    if (!enabled()) { if (shell) shell.hidden = true; for (const dialog of dialogs) dialog.close(); restoreAdaptedContainers(); root.removeAttribute('data-cw-v4-settings'); return; }
    if (!shell) buildShell();
    const settingsSearch=shell.querySelector('.cw-v4-search'),searchHost=mobile()?shell:shell.querySelector('.cw-v4-nav');
    if(settingsSearch.parentElement!==searchHost)searchHost.prepend(settingsSearch);
    ids.forEach(([id]) => {
      const p = doc.getElementById(id); if (!p || panels.get(id) === p) return;
      panels.set(id,p); p.classList.add('cw-v4-panel');
      const glyph=nativeToggle(p)?.querySelector('.drawer-icon');
      const glyphName=['sliders','plug','type','book','image','puzzle','card','user','gear'][ids.findIndex(s=>s[0]===id)];
      glyph?.style.setProperty('--cw-v4-nav-icon',`var(--cw-v4-icon-${glyphName})`);
      observe(p, records => { if (records.some(r => r.type === 'childList' || r.target === p)) schedule(); }, {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    });
    const open = [...panels.values()].filter(isOpen);
    const p = open.find(n => n.id === requestedPanel) || (open.includes(current) ? current : open[0]);
    for (const panel of panels.values()) panel.classList.toggle('cw-v4-inactive', isOpen(panel) && panel !== p);
    if (p) {
      if (!current) previousFocus = doc.activeElement;
      if (current !== p) { current = p; shell.classList.remove('cw-v4-show-nav'); }
      root.setAttribute('data-cw-v4-settings','open'); shell.hidden = false;
      if (shell.dataset.panel !== p.id) shell.dataset.panel = p.id;
      const spec = ids.find(([id]) => id === p.id);
      // Phones show every preference page on one screen titled "Preferences" (design mpage).
      const titleText = L(p.id === 'user-settings-block' ? (mobile() ? '偏好设置' : PAGES.find(x=>x.key===prefPage)?.title||'偏好设置') : spec[1]);
      if (shell.querySelector('.cw-v4-title').textContent !== titleText) shell.querySelector('.cw-v4-title').textContent = titleText;
      shell.querySelectorAll('[data-pref]').forEach(b => b.classList.toggle('cw-v4-selected', p.id === 'user-settings-block' && b.dataset.pref === prefPage));
      shell.querySelectorAll('[data-panel]').forEach(b => { const active = b.dataset.panel === p.id; if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
      enhance(p);
      if(p.id!=='user-settings-block'){
        let pageTitle=p.querySelector(':scope>.cw-v4-page-title');
        if(!pageTitle){pageTitle=make('h2','cw-v4-page-title');p.prepend(pageTitle);}
        if(pageTitle.textContent!==titleText)pageTitle.textContent=titleText;
      }
      if (p.id === 'user-settings-block') p.querySelectorAll('.cw-v4-pref-page').forEach(n => {
        // Search matches a row by its title/description or by its section name, as in the design.
        let hits=0;
        n.querySelectorAll('.cw-v4-pref-sec').forEach(sec=>{
          const inSec=!!searchQuery&&sec.firstElementChild.textContent.toLocaleLowerCase().includes(searchQuery);let secHits=0;
          sec.querySelectorAll(':scope>.cw-v4-pref-row').forEach(row=>{const ok=!searchQuery||inSec||row.querySelector('.cw-v4-row-info')?.textContent.toLocaleLowerCase().includes(searchQuery);if(row.hidden===!!ok)row.hidden=!ok;if(ok)secHits++;});
          if(sec.hidden===!!secHits)sec.hidden=!secHits;hits+=secHits;
        });
        const hide=searchQuery ? !hits : !mobile()&&n.dataset.page!==prefPage;if(n.hidden!==hide)n.hidden=hide;
      });
      p.querySelectorAll('textarea[data-cw-v4-text]').forEach(ta => ta._cwV4Paint?.());
      p.querySelectorAll('input[type=range]').forEach(fill);
    } else {
      if (current) { current = null; previousFocus?.isConnected && previousFocus.focus(); }
      shell.hidden = true; root.removeAttribute('data-cw-v4-settings');
    }
    syncChat();
  }
  // Sliders draw the travelled part with --fill (design native.css).
  const fill = r => { const min=+r.min||0, max=+r.max||100, v=((+r.value-min)/((max-min)||1)*100).toFixed(2)+'%'; if (r.style.getPropertyValue('--fill')!==v) r.style.setProperty('--fill',v); };
  function schedule() { if (!raf && !destroyed) raf = win.requestAnimationFrame(sync); }
  const start = () => {
    const keepStyleAfterTheme=()=>{
      const style=doc.querySelector('link[href*="/styles/official-layout.css"]');
      if(!style)return;
      const themes=[...doc.querySelectorAll('link[rel="stylesheet"]')].filter(n=>/\/styles\/(day|night)-(pc|mobile)\.css/.test(n.href));
      if(themes.some(n=>style.compareDocumentPosition(n)&win.Node.DOCUMENT_POSITION_FOLLOWING))doc.head.append(style);
    };
    keepStyleAfterTheme();
    observe(doc.head,keepStyleAfterTheme,{childList:true});
    sync();
    observe(root, schedule, {attributes:true,attributeFilter:['data-claude-structure','data-claude-skin']});
    observe(doc.body, schedule, {attributes:true,attributeFilter:['class']});
    const chat = doc.getElementById('chat'); if (chat) observe(chat, schedule, {childList:true,subtree:true});
    on(doc,'input', e => { if (e.target.id === 'send_textarea') syncChat(); else if (e.target.type === 'range' && e.target.closest?.('.cw-v4-panel,.cw-v4-editor')) fill(e.target); });
    on(doc,'change', e => { if (e.target.id === 'ui_language_select') schedule(); });
    on(doc,'click', e => { const toggle=e.target.closest?.('.drawer-toggle'); const panel=toggle?.parentElement.querySelector(':scope > .drawer-content'); if(panel && panels.has(panel.id)) requestedPanel=panel.id; },true);
    on(doc,'keydown', e => { if (e.key === 'Escape' && current && !doc.querySelector('dialog[open]') && !e.defaultPrevented) { closeSettings(); e.preventDefault(); } });
    on(win,'resize', () => { resetGeometry(); schedule(); });
    // Read-only keyboard flag for the short-screen (phone landscape) composer.
    // The input keeps focus after Back hides the keyboard, so focus alone is not enough.
    const vk = win.navigator.virtualKeyboard;
    const syncKeyboard = () => {
      const vv = win.visualViewport;
      const height = Math.max(vk?.boundingRect?.height || 0, vv ? win.innerHeight - vv.height : 0);
      const open = height > 80 && doc.activeElement?.id === 'send_textarea';
      if (root.hasAttribute('data-cw-v4-kb') !== open) root.toggleAttribute('data-cw-v4-kb', open);
    };
    if (win.visualViewport) on(win.visualViewport, 'resize', syncKeyboard);
    if (vk?.addEventListener) on(vk, 'geometrychange', syncKeyboard);
    on(doc, 'focusin', () => win.setTimeout(syncKeyboard, 350));
    on(doc, 'focusout', () => win.setTimeout(syncKeyboard, 50));
    disposers.push(() => root.removeAttribute('data-cw-v4-kb'));
    const ctx = win.SillyTavern?.getContext?.();
    for (const key of ['CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_SWIPED','SETTINGS_LOADED','APP_READY']) {
      const event = ctx?.eventTypes?.[key]; if (event && ctx.eventSource?.on) { ctx.eventSource.on(event,schedule); disposers.push(() => ctx.eventSource.removeListener?.(event,schedule)); }
    }
  };
  if (doc.readyState === 'loading') on(doc,'DOMContentLoaded',start,{once:true}); else start();
  return { refresh: sync, destroy() { destroyed = true; observers.forEach(m=>m.disconnect()); disposers.forEach(f=>f()); if (raf) win.cancelAnimationFrame(raf); for (const d of dialogs) d.close(); restoreAdaptedContainers(); shell?.remove(); doc.querySelector('.cw-v4-chat-head')?.remove(); root.removeAttribute('data-cw-v4'); root.removeAttribute('data-cw-v4-settings'); } };
}
