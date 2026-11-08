/* 2.0.341 世界书重排（稿 世界书重排-20261102/design-worldinfo-v1.html）。
 * 五个画面：首页（正在生效 + 全部世界书）、书页（条目列表）、条目页、内容放大、激活设置。
 * 所有读写都走原生控件或原生导出函数：CW 只搬位置、换外观；条目字段靠原生控件自己的
 * input/change 保存，CW 不存数据。搬走的原生节点都留 return 标记，关闭/销毁时放回。 */
export function createWorldPage(h) {
  const {win,t,L,make,button,icon,get,move,cleanup,state,menu,act,openEditor,showToggle,phoneWide}=h,doc=win.document;
  const WI_URL=()=>new URL('/scripts/world-info.js',win.location.href).href;
  let wi=null,wiLoading=null;
  const loadWI=()=>wiLoading||=import(WI_URL()).then(m=>{wi=m;return m;}).catch(()=>null);
  const ctx=()=>win.SillyTavern?.getContext?.();
  const text=(n,v)=>{if(n&&n.textContent!==v)n.textContent=v;};
  const setHidden=(n,v)=>{if(n&&n.hidden!==v)n.hidden=v;};
  const svg=(paths,{fill=false,w=1.8}={})=>{const s=doc.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill',fill?'currentColor':'none');if(!fill){s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width',String(w));s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');}s.setAttribute('aria-hidden','true');s.innerHTML=paths;return s;};
  // Icons drawn in the design (I.globe/card/chat/gear/book/back/expand/shrink/imp).
  const ICON={
    globe:()=>svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',{w:1.7}),
    card:()=>svg('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9.5" cy="11" r="2"/><path d="M14 10h3M14 13h3M7 16h6"/>',{w:1.7}),
    chat:()=>svg('<path d="M5 6h14v10H9l-4 3z"/>',{w:1.7}),
    gear:()=>svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',{w:1.7}),
    book:()=>svg('<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',{w:1.7}),
    chev:()=>{const s=svg('<path d="m9 6 6 6-6 6"/>',{w:1.9});s.classList.add('cww-chev');return s;},
    back:()=>svg('<path d="m15 6-6 6 6 6"/>',{w:1.9}),
    plus:()=>svg('<path d="M12 5v14M5 12h14"/>',{w:1.9}),
    imp:()=>svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>'),
    expand:()=>svg('<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>'),
    shrink:()=>svg('<path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5"/>'),
    search:()=>svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/>'),
    more:()=>svg('<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',{fill:true}),
  };
  const btn=(label,fn,cls='cwr-btn',ico)=>{const b=button('',fn,cls);if(ico)b.append(ico);if(label)b.append(make('span','',label));return b;};
  const iconBox=ico=>{const n=make('span','cww-ico');n.append(ico);return n;};
  const STATE={constant:['常驻','Constant','const'],normal:['关键词','Keyword','key'],vectorized:['向量','Vector','vec']};
  const POS={'0':['角色定义前','Before character'],'1':['角色定义后','After character'],'5':['示例消息前','Before examples'],'6':['示例消息后','After examples'],'2':['作者注释前',"Before Author's Note"],'3':['作者注释后',"After Author's Note"],'4':['@深度','@Depth'],'7':['输出口','Outlet']};

  /* ---------- 原生数据（只读） ---------- */
  const editor=()=>get('world_editor_select');
  const books=()=>[...(editor()?.options||[])].filter(o=>o.value!=='').map(o=>({name:o.textContent.trim(),value:o.value}));
  const currentBook=()=>{const s=editor();return s&&s.value!==''?s.selectedOptions[0]?.textContent.trim()||'':'';};
  const globalBooks=()=>[...(get('world_info')?.selectedOptions||[])].map(o=>o.textContent.trim());
  function charInfo(){
    const c=ctx();if(!c)return {none:true};
    if(c.groupId!=null&&c.groupId!==undefined&&c.groupId!=='')return {group:true};
    const ch=c.characters?.[c.characterId];if(!ch||c.characterId===undefined)return {none:true};
    const main=ch.data?.extensions?.world||'',file=String(ch.avatar||'').replace(/\.[^/.]+$/,'');
    const extra=wi?.world_info?.charLore?.find(x=>x.name===file)?.extraBooks||[];
    return {name:ch.name,main,extra,books:[main,...extra].filter(Boolean),id:c.characterId};
  }
  const chatBook=()=>{const c=ctx();return c?.chatId?String(c.chatMetadata?.world_info||''):null;};
  const personaBook=()=>String(ctx()?.powerUserSettings?.persona_description_lorebook||'');
  function whereOf(name){const w=[];if(globalBooks().includes(name))w.push('global');if(charInfo().books?.includes(name))w.push('char');if(chatBook()===name)w.push('chat');return w;}
  const WHERE={global:['全局生效','Global'],char:['角色生效','Character'],chat:['聊天生效','Chat']};
  const badges=w=>w.map(k=>make('span','cww-badge'+(k==='global'?' cww-badge-g':''),t(...WHERE[k])));
  // Entry counts only for books already loaded by ST (never fetch a book for the list).
  const counts=new Map();
  function countOf(name){if(counts.has(name))return counts.get(name);if(!wi?.worldInfoCache?.has?.(name))return null;const data=wi.worldInfoCache.get(name);const n=data?.entries?Object.keys(data.entries).length:null;counts.set(name,n);return n;}
  const stats=new Map();
  function statsOf(name){if(stats.has(name))return stats.get(name);if(!wi?.worldInfoCache?.has?.(name))return null;const data=wi.worldInfoCache.get(name),v=Object.values(data?.entries||{}),r={all:v.length,const:v.filter(e=>e.constant).length,vec:v.filter(e=>!e.constant&&e.vectorized).length,off:v.filter(e=>e.disable).length};r.key=r.all-r.const-r.vec;stats.set(name,r);return r;}

  let ui=null;
  /* ---------- 视图切换 ---------- */
  function go(view){
    if(!ui)return;
    if(ui.view==='entry'&&view!=='entry')closeEntry();
    ui.view=view;ui.panel.dataset.cwwView=view;
    for(const [k,n]of Object.entries(ui.views))setHidden(n,k!==view);
    if(view!=='home')stopSelecting(false);
    ui.panel.scrollTop=0;ui.page.closest('.cw-v4-panel')?.scrollTo?.(0,0);
    paint();
  }
  function openBook(value){
    const s=editor();if(!s)return;
    if(s.value!==String(value)){s.value=String(value);win.jQuery?win.jQuery(s).trigger('change'):s.dispatchEvent(new win.Event('change',{bubbles:true}));}
    ui.filter='all';go('book');
  }

  /* ---------- 首页 ---------- */
  function whereRow(kind,ico,title,meta,onClick){
    const r=make('div','cw-v4-row cww-row cww-where-row'),info=make('div','cw-v4-row-info'),nm=make('div','cw-v4-row-title',title),mt=make('p','',meta),val=make('div','cww-val');
    info.append(nm,mt);r.append(iconBox(ico),info,val,ICON.chev());r.tabIndex=0;r.setAttribute('role','button');r.dataset.cwwWhere=kind;
    const run=e=>{if(r.getAttribute('aria-disabled')==='true')return;onClick(e);};
    r.addEventListener('click',run);r.addEventListener('keydown',e=>{if(e.target===r&&['Enter',' '].includes(e.key)){e.preventDefault();run(e);}});
    return {r,nm,mt,val};
  }
  const pills=(host,names,empty)=>{const key=(names.join('\n')||'-')+'|'+empty;if(host.dataset.key===key)return;host.dataset.key=key;host.replaceChildren(...(names.length?names.map(n=>make('span','cww-bk',n)):[make('span','cww-bk cww-bk-none',empty)]));};
  function buildHome(s,view){
    const head=make('div','cwr-list-head cww-head'),actions=make('div','cwr-list-actions');head.append(make('h2','',t('世界书','World Info')),actions);
    const imp=get('world_import_button'),create=get('world_create_button');
    if(imp){act(s,imp,'导入');move(s,imp,actions);}
    if(create){act(s,create,'新建世界书',true,true);move(s,create,actions);}
    view.append(head,make('p','cwr-lede cww-sub',t('世界书在三个地方生效：全局（每段聊天都用）、绑在角色上、绑在这段聊天上。','World Info applies in three places: globally (every chat), bound to a character, or bound to this chat.')));
    const where=make('section','cw-v4-section cww-where');where.append(make('h2','',t('正在生效','Active now')));const card=make('div','cw-v4-card');where.append(card);view.append(where);
    const picker=get('WIMultiSelector'),park=make('div','cw-v4-park');view.append(park);if(picker)move(s,picker,park);
    ui.global=whereRow('global',ICON.globe(),t('全局','Global'),t('每段聊天都会用','Used in every chat'),()=>picker&&openEditor(picker,t('全局世界书','Global World Info')));
    ui.char=whereRow('char',ICON.card(),t('当前角色','Current character'),t('只在和这个角色聊天时用','Only in chats with this character'),()=>{const b=get('world_button');b?.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));});
    ui.chat=whereRow('chat',ICON.chat(),t('当前聊天','Current chat'),t('只在这一段聊天里用','Only in this chat'),()=>{const b=doc.querySelector('.chat_lorebook_button');b?.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));});
    ui.act=whereRow('act',ICON.gear(),t('激活设置','Activation settings'),'',()=>go('act'));ui.act.val.remove();
    card.append(ui.global.r,ui.char.r,ui.chat.r,ui.act.r);
    // 全部世界书
    const all=make('section','cw-v4-section cww-books'),h2=make('h2','',t('全部世界书','All World Info')),n=make('span','cww-n'),side=make('span','cww-sec-actions');h2.append(n);all.append(h2);
    const pick=btn(t('选择','Select'),()=>startSelecting(),'cww-text-btn'),pickAll=btn(t('全选','Select all'),()=>selectAll(),'cww-text-btn'),done=btn(t('完成','Done'),()=>stopSelecting(true),'cww-text-btn');
    side.append(pick,pickAll,make('span','cww-dot-sep','·'),done);h2.append(side);
    const tools=make('div','cww-tools'),find=make('label','cwr-search-box cww-find'),q=make('input','cwr-search');q.type='search';q.placeholder=t('搜索世界书','Search World Info');q.setAttribute('aria-label',q.placeholder);find.append(icon('search'),q);tools.append(find);
    const list=make('div','cw-v4-card cww-book-list'),empty=make('p','cwr-empty cww-empty',t('没有匹配的世界书','No matching World Info'));
    all.append(tools,list,empty);view.append(all);
    q.addEventListener('input',()=>paintBooks());
    // 手机：列表下面再放一组「新建 / 导入」。
    const opts=make('div','cw-v4-card cww-opts cww-phone-only');
    for(const [label,id,ico] of [[t('新建世界书','New World Info'),'world_create_button',ICON.plus()],[t('导入','Import'),'world_import_button',ICON.imp()]]){const r=make('div','cw-v4-row cww-row');r.append(iconBox(ico),make('div','cw-v4-row-title',label));r.tabIndex=0;r.setAttribute('role','button');r.addEventListener('click',()=>get(id)?.click());opts.append(r);}
    view.append(opts);
    // 选择模式：底部浮条，和预设的多选浮条同一个组件。
    const bar=make('div','cwr-selection-bar cww-selection-bar'),cnt=make('span','');bar.hidden=true;
    bar.append(cnt,btn(t('取消','Cancel'),()=>stopSelecting(true),'cwr-btn cwr-ghost'),btn(t('导出','Export'),()=>exportSelected(),'cwr-btn'),btn(t('删除','Delete'),()=>removeSelected(),'cwr-btn cwr-danger'));
    const status=make('p','cwr-status cww-status');status.setAttribute('role','status');
    view.append(status,bar);
    Object.assign(ui,{bookCount:n,bookQuery:q,bookList:list,bookEmpty:empty,pickBtn:pick,pickAllBtn:pickAll,pickDone:done,secSep:side.querySelector('.cww-dot-sep'),selBar:bar,selCount:cnt,status});
  }
  function bookRow(b){
    const r=make('div','cw-v4-row cww-row cww-book'),info=make('div','cw-v4-row-info'),meta=make('p','cww-meta'),check=make('input','cwr-check cww-check');check.type='checkbox';check.tabIndex=-1;check.setAttribute('aria-label',t(`选择${b.name}`,`Select ${b.name}`));
    info.append(make('div','cw-v4-row-title',b.name),meta);const ico=iconBox(ICON.book());r.append(check,ico,info,ICON.chev());r.tabIndex=0;r.setAttribute('role','button');r.dataset.cwwBook=b.name;
    const run=()=>{if(ui.selecting){ui.selected.has(b.name)?ui.selected.delete(b.name):ui.selected.add(b.name);paintBooks();return;}openBook(b.value);};
    r.addEventListener('click',e=>{if(e.target.closest('a'))return;run();});r.addEventListener('keydown',e=>{if(e.target===r&&['Enter',' '].includes(e.key)){e.preventDefault();run();}});
    return {r,meta,check,b};
  }
  function paintBooks(){
    if(!ui)return;
    const all=books(),q=ui.bookQuery.value.trim().toLocaleLowerCase(),list=all.filter(b=>!q||b.name.toLocaleLowerCase().includes(q));
    text(ui.bookCount,String(all.length));
    const rows=list.map(b=>{let row=ui.bookRows.get(b.name);if(!row||row.b.value!==b.value){row=bookRow(b);ui.bookRows.set(b.name,row);}return row;});
    const want=rows.map(x=>x.r);if(want.length!==ui.bookList.children.length||want.some((n,i)=>ui.bookList.children[i]!==n))ui.bookList.replaceChildren(...want);
    for(const row of rows){const n=countOf(row.b.name),w=whereOf(row.b.name),key=n+'|'+w.join(',');if(row.meta.dataset.key!==key){row.meta.dataset.key=key;row.meta.replaceChildren(...(n!=null?[make('span','',t(`${n} 条`,`${n} entries`))]:[]),...badges(w));}
      const picked=ui.selected.has(row.b.name);if(row.check.checked!==picked)row.check.checked=picked;row.r.classList.toggle('cww-picked',picked);}
    for(const name of [...ui.bookRows.keys()])if(!all.some(b=>b.name===name))ui.bookRows.delete(name);
    for(const name of [...ui.selected])if(!all.some(b=>b.name===name))ui.selected.delete(name);
    setHidden(ui.bookEmpty,rows.length>0);
    ui.views.home.classList.toggle('cww-selecting',ui.selecting);
    setHidden(ui.pickBtn,ui.selecting||!all.length);setHidden(ui.pickAllBtn,!ui.selecting);setHidden(ui.pickDone,!ui.selecting);setHidden(ui.secSep,!ui.selecting);
    const size=ui.selected.size;setHidden(ui.selBar,!ui.selecting||!size);text(ui.selCount,t(`已选 ${size} 本`,`${size} selected`));for(const b of ui.selBar.querySelectorAll('button'))b.disabled=!!ui.busy;
    paintMobileHead();
  }
  function paintWhere(){
    const g=globalBooks();pills(ui.global.val,g,t('未选','None'));
    const c=charInfo(),ch=ui.char;
    if(c.none||c.group){text(ch.nm,t('当前角色','Current character'));text(ch.mt,c.group?t('群聊里没有单个角色','Group chats have no single character'):t('没有打开聊天','No chat open'));pills(ch.val,[],t('—','—'));ch.r.setAttribute('aria-disabled','true');}
    else{text(ch.nm,t(`当前角色 · ${c.name}`,`Current character · ${c.name}`));text(ch.mt,t('只在和这个角色聊天时用','Only in chats with this character'));pills(ch.val,c.books,t('未绑定','Not bound'));ch.r.removeAttribute('aria-disabled');}
    const cb=chatBook(),cr=ui.chat;
    if(cb===null){text(cr.mt,t('没有打开聊天','No chat open'));pills(cr.val,[],t('—','—'));cr.r.setAttribute('aria-disabled','true');}
    else{text(cr.mt,t('只在这一段聊天里用','Only in this chat'));pills(cr.val,cb?[cb]:[],t('未绑定','Not bound'));cr.r.removeAttribute('aria-disabled');}
    const d=get('world_info_depth')?.value,b=get('world_info_budget')?.value,r=get('world_info_recursive')?.checked;
    text(ui.act.mt,t(`扫描深度 ${d} · 上下文 ${b}% · 递归 ${r?'开':'关'}`,`Scan depth ${d} · Context ${b}% · Recursion ${r?'on':'off'}`));
  }
  /* 选择模式（批量导出 / 删除，Lulu 11-03 稿 design-batch-delete-v1） */
  function startSelecting(){ui.selecting=true;ui.selected.clear();paintBooks();}
  function stopSelecting(repaint){if(!ui||!ui.selecting&&!ui.selected.size)return;ui.selecting=false;ui.selected.clear();if(repaint)paintBooks();}
  function selectAll(){const q=ui.bookQuery.value.trim().toLocaleLowerCase(),list=books().filter(b=>!q||b.name.toLocaleLowerCase().includes(q)),every=list.length&&list.every(b=>ui.selected.has(b.name));for(const b of list)every?ui.selected.delete(b.name):ui.selected.add(b.name);paintBooks();}
  async function exportNames(names){
    const m=wi||await loadWI(),u=await import(new URL('/scripts/utils.js',win.location.href).href);if(!m)throw Error(t('酒馆的世界书模块没有加载','The native World Info module is unavailable'));
    for(const name of names){const data=await m.loadWorldInfo(name);if(!data)throw Error(t(`读不到「${name}」`,`Could not read “${name}”`));u.download(JSON.stringify(data),`${name}.json`,'application/json');}
  }
  async function exportSelected(){if(!ui||ui.busy||!ui.selected.size)return;try{await exportNames([...ui.selected]);text(ui.status,t(`已导出 ${ui.selected.size} 本`,`Exported ${ui.selected.size}`));}catch(e){text(ui.status,e.message);win.toastr?.error?.(e.message);}}
  function confirmDelete(names){return new Promise(resolve=>{
    const d=make('dialog','cwr-confirm'),list=make('div','cwr-confirm-names'),warn=make('div','cwr-warnings');
    for(const type of ['click','mousedown','touchstart'])d.addEventListener(type,e=>e.stopPropagation());
    d.append(make('h2','',t(`删除 ${names.length} 本世界书？`,`Delete ${names.length} World Info books?`)),make('p','cwr-muted',t('删除以后不能撤销','This cannot be undone')),list);
    for(const name of names)list.append(make('div','',name));
    const g=globalBooks(),c=charInfo(),cb=chatBook(),pb=personaBook();
    for(const name of names){const where=[];if(g.includes(name))where.push(t('全局','global'));if(c.books?.includes(name))where.push(t(`角色「${c.name}」`,`character “${c.name}”`));if(cb===name)where.push(t('当前聊天','this chat'));if(pb===name)where.push(t('用户角色','persona'));
      if(where.length)warn.append(make('p','',t(`「${name}」正在${where.join('、')}上生效`,`“${name}” is active for ${where.join(', ')}`)));}
    if(warn.childElementCount)d.append(warn);
    const backup=make('label','cwr-backup'),check=make('input','');check.type='checkbox';check.checked=false;backup.append(check,make('span','',t('删除前先导出一份备份','Export a backup before deleting')));d.append(backup);
    const actions=make('div','cwr-confirm-actions');let settled=false;const done=v=>{if(settled)return;settled=true;d.close();d.remove();resolve(v);};
    actions.append(button(t('取消','Cancel'),()=>done(null),'cwr-btn'),button(t('删除','Delete'),()=>done({backup:check.checked}),'cwr-btn cwr-danger-primary'));d.append(actions);d.addEventListener('cancel',e=>{e.preventDefault();done(null);});doc.body.append(d);d.showModal();
  });}
  async function removeSelected(){
    if(!ui||ui.busy)return;const current=ui,names=[...ui.selected];if(!names.length)return;
    const consent=await confirmDelete(names);if(!consent||ui!==current)return;current.busy=true;paintBooks();const removed=[];let failed=null;
    try{const m=wi||await loadWI();if(!m?.deleteWorldInfo)throw Error(t('酒馆没有提供删除世界书的接口','The native delete function is unavailable'));
      if(consent.backup)await exportNames(names);
      for(const name of names){failed=name;
        // Same clean-up as the native single delete: extra character books first.
        const lore=m.world_info?.charLore;if(Array.isArray(lore)){let touched=false;for(let i=lore.length-1;i>=0;i--){const x=lore[i];if(x.extraBooks?.includes(name)){touched=true;x.extraBooks=x.extraBooks.filter(e=>e!==name);if(!x.extraBooks.length)lore.splice(i,1);}}if(touched)ctx()?.saveSettingsDebounced?.();}
        if(await m.deleteWorldInfo(name)!==true)throw Error(t(`删除「${name}」失败`,`Failed to delete “${name}”`));
        removed.push(name);current.selected.delete(name);counts.delete(name);stats.delete(name);failed=null;}
      const msg=t(`已删除 ${removed.length} 本${consent.backup?'，备份已下载':''}`,`Deleted ${removed.length}${consent.backup?'; backup downloaded':''}`);text(current.status,msg);win.toastr?.success?.(msg);current.selecting=false;
    }catch(e){const rest=names.filter(n=>!removed.includes(n)&&n!==failed),msg=t(`已删除：${removed.join('、')||'无'}；${failed?`「${failed}」失败，已停下；`:''}没动：${rest.join('、')||'无'}。${e.message}`,`Deleted: ${removed.join(', ')||'none'}. ${failed?`Stopped at “${failed}”. `:''}Not attempted: ${rest.join(', ')||'none'}. ${e.message}`);text(current.status,msg);current.status.setAttribute('role','alert');win.toastr?.error?.(msg);}
    finally{current.busy=false;if(ui===current){ui.selected.clear();paintBooks();}}
  }

  /* ---------- 书页 ---------- */
  function buildBook(s,view){
    const back=btn(t('世界书','World Info'),()=>go('home'),'cwr-back cww-back',ICON.back());
    const head=make('div','cwr-list-head cww-head'),title=make('h2',''),actions=make('div','cwr-list-actions');head.append(title,actions);
    const more=menu(s,[['重命名',get('world_popup_name_button')],['复制一份',get('world_duplicate')],['导出',get('world_popup_export')],['用关键词填充空标题',get('world_backfill_memos')],['把当前排序写入「顺序」',get('world_apply_current_sorting')],['刷新',get('world_refresh')],['删除这本世界书',get('world_popup_delete'),true]]);
    more.classList.add('cww-book-more');
    const add=get('world_popup_new');if(add){act(s,add,'新建条目',true,true);}
    actions.append(more);if(add)move(s,add,actions);
    const sub=make('p','cwr-lede cww-sub cww-book-sub');
    const tools=make('div','cww-tools'),find=make('label','cwr-search-box cww-find'),search=get('world_info_search');find.append(icon('search'));
    if(search){const old=search.placeholder;search.placeholder=t('搜索条目名字或关键词','Search entry names or keywords');cleanup(s,()=>{search.placeholder=old;});search.classList.add('cwr-search');cleanup(s,()=>search.classList.remove('cwr-search'));move(s,search,find);}
    tools.append(find);const sort=get('world_info_sort_order');if(sort){const box=make('span','cww-sort');tools.append(box);move(s,sort,box);}
    const chips=make('div','cww-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label',t('筛选','Filter'));
    ui.chipBtns={};for(const k of ['all','const','key','vec','off']){const b=make('button','cww-chip');b.type='button';b.dataset.filter=k;b.addEventListener('click',()=>{ui.filter=k;paint();});chips.append(b);ui.chipBtns[k]=b;}
    const list=make('div','cw-v4-card cww-entry-list'),empty=make('p','cwr-empty cww-empty',t('没有符合条件的条目','No matching entries'));
    // Native list stays live (parked); CW rows mirror it. A Vue-rendered list (Bai Bai)
    // is shown as it is: never compete for its nodes.
    const nativeHost=make('div','cww-native-list'),pager=get('world_info_pagination'),entries=get('world_popup_entries_list');
    if(entries)move(s,entries,nativeHost);if(pager)move(s,pager,view);
    const hiddenTools=make('div','cw-v4-park');for(const id of ['OpenAllWIEntries','CloseAllWIEntries'])if(get(id))move(s,get(id),hiddenTools);
    const opts=make('div','cw-v4-card cww-opts cww-phone-only'),r=make('div','cw-v4-row cww-row');r.append(iconBox(ICON.plus()),make('div','cw-v4-row-title',t('新建条目','New entry')));r.tabIndex=0;r.setAttribute('role','button');r.addEventListener('click',()=>get('world_popup_new')?.click());opts.append(r);
    view.append(back,head,sub,tools,chips,list,empty,nativeHost,hiddenTools);if(pager)view.append(pager);view.append(opts);
    Object.assign(ui,{bookTitle:title,bookSub:sub,entryList:list,entryEmpty:empty,nativeHost,chips});
    // Rows are rebuilt from the native list once per frame; CW's own nodes live outside it.
    if(entries){const mo=new win.MutationObserver(()=>queue());mo.observe(entries,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});cleanup(s,()=>mo.disconnect());}
    const onInput=e=>{if(e.target.closest?.('#world_popup_entries_list'))queue();};doc.addEventListener('input',onInput,true);doc.addEventListener('change',onInput,true);cleanup(s,()=>{doc.removeEventListener('input',onInput,true);doc.removeEventListener('change',onInput,true);});
  }
  const q=(entry,n)=>entry.querySelector(`[name="${n}"]`);
  function entryData(entry){
    const st=STATE[q(entry,'entryStateSelector')?.value]||STATE.normal;
    const keyField=entry.querySelector('textarea[name="key"]');
    let keys=keyField?keyField.value:entry._cwwKeys;
    if(keys==null){const uid=entry.getAttribute('uid')??entry.dataset.uid,book=currentBook();if(book&&wi?.worldInfoCache?.has?.(book)){const k=keyCache(book)?.[uid];keys=Array.isArray(k)?k.join(', '):'';entry._cwwKeys=keys;}else keys='';}
    const pos=q(entry,'position')?.value,depth=q(entry,'depth')?.value,order=q(entry,'order')?.value;
    const kill=q(entry,'entryKillSwitch'),on=!kill?.classList.contains('fa-toggle-off');
    return {st,keys:String(keys||'').split(',').map(x=>x.trim()).filter(Boolean),pos,depth,order,on,name:q(entry,'comment')?.value.trim()||''};
  }
  // ST's cache clones on every get(); read each book's keys once per paint batch.
  let keyMemo=null;
  function keyCache(book){if(keyMemo?.book===book)return keyMemo.map;const data=wi.worldInfoCache.get(book),map={};for(const [uid,e]of Object.entries(data?.entries||{}))map[uid]=e.key;keyMemo={book,map};return map;}
  function entryRow(entry){
    let row=ui.entryRows.get(entry);if(row)return row;
    const r=make('div','cw-v4-row cww-row cww-entry'),sw=make('button','cww-tg');sw.type='button';sw.setAttribute('role','switch');sw.setAttribute('aria-label',t('启用','Enabled'));
    const info=make('div','cw-v4-row-info'),nm=make('div','cw-v4-row-title'),meta=make('p','cww-meta'),dot=make('span','cww-dot'),stText=make('span',''),keys=make('span','cww-keys'),pos=make('div','cww-pos');
    meta.append(dot,stText,keys);info.append(nm,meta);r.append(sw,info,pos);r.tabIndex=0;r.setAttribute('role','button');
    sw.addEventListener('click',e=>{e.stopPropagation();q(entry,'entryKillSwitch')?.click();queue();});
    const open=()=>openEntry(entry);r.addEventListener('click',open);r.addEventListener('keydown',e=>{if(e.target===r&&e.key==='Enter'){e.preventDefault();open();}});
    row={r,sw,nm,dot,stText,keys,pos};ui.entryRows.set(entry,row);return row;
  }
  function paintEntryRow(entry,row,d){
    text(row.nm,d.name||t('（无标题）','(Untitled)'));
    if(row.dot.dataset.kind!==d.st[2])row.dot.dataset.kind=d.st[2];text(row.stText,t(d.st[0],d.st[1]));
    text(row.keys,'· '+(d.st[2]==='const'?t('常驻，不需要关键词','Always on; no keywords needed'):d.st[2]==='vec'?t('按语义相似度触发','Triggered by similarity'):(d.keys.join(t('、',', '))||t('还没有关键词','No keywords yet'))));
    const p=POS[d.pos],posText=(p?t(...p):'')+(d.pos==='4'?' '+(d.depth??''):'');const key=posText+'|'+d.order;
    if(row.pos.dataset.key!==key){row.pos.dataset.key=key;row.pos.replaceChildren(doc.createTextNode(posText),make('br',''),doc.createTextNode(t(`顺序 ${d.order??''}`,`Order ${d.order??''}`)));}
    row.sw.setAttribute('aria-checked',String(d.on));row.r.classList.toggle('cww-off',!d.on);
  }
  function paintBook(){
    const name=currentBook();
    if(!name){if(ui.view==='book')go('home');return;}
    text(ui.bookTitle,name);
    const list=get('world_popup_entries_list'),vue=!!list?.querySelector('[data-v-app],.bai-bai-wi-vue-host,[class*="bai-bai-world"]');
    ui.panel.classList.toggle('cww-native-entries',vue);
    const st=statsOf(name),entries=[...(list?.querySelectorAll(':scope > .world_entry')||[])],w=whereOf(name);
    const total=st?.all??entries.length,subKey=total+'|'+w.join(',');
    if(ui.bookSub.dataset.key!==subKey){ui.bookSub.dataset.key=subKey;ui.bookSub.replaceChildren(make('span','',t(`${total} 条`,`${total} entries`)),...(w.length?badges(w):[make('span','',t('· 现在没有在哪里生效','· Not active anywhere'))]));}
    const label={all:t('全部','All'),const:t('常驻','Constant'),key:t('关键词','Keyword'),vec:t('向量','Vector'),off:t('已停用','Disabled')};
    for(const [k,b]of Object.entries(ui.chipBtns)){text(b,label[k]+(k!=='all'&&st?' '+st[k]:''));b.setAttribute('aria-pressed',String(ui.filter===k));}
    if(vue){setHidden(ui.entryList,true);setHidden(ui.entryEmpty,true);return;}
    keyMemo=null;
    const rows=[];for(const entry of entries){const d=entryData(entry),f=ui.filter,show=f==='all'||(f==='off'?!d.on:d.st[2]===f);const row=entryRow(entry);paintEntryRow(entry,row,d);if(show)rows.push(row.r);}
    if(rows.length!==ui.entryList.children.length||rows.some((n,i)=>ui.entryList.children[i]!==n))ui.entryList.replaceChildren(...rows);
    setHidden(ui.entryList,!rows.length);setHidden(ui.entryEmpty,rows.length>0||!entries.length&&ui.filter==='all');
    if(!entries.length&&ui.filter==='all'){setHidden(ui.entryEmpty,false);text(ui.entryEmpty,t('这本书还没有条目','No entries yet'));}else text(ui.entryEmpty,t('没有符合条件的条目','No matching entries'));
    const pager=get('world_info_pagination');if(pager){const single=!pager.querySelector('.paginationjs')||(!!pager.querySelector('.paginationjs-prev.disabled')&&!!pager.querySelector('.paginationjs-next.disabled'));pager.classList.toggle('cw-v4-single-page',single);}
    // Rebuilt native entries leave stale rows behind; WeakMap releases them.
    if(ui.view==='book'&&entries.length&&!wi)loadWI().then(()=>queue());
  }

  /* ---------- 条目页 ---------- */
  function buildEntryView(view){ui.entryHost=view;}
  function openEntry(entry){
    if(!ui||!entry?.isConnected)return;
    closeEntry();
    const drawer=entry.querySelector('.inline-drawer');
    // ST builds the editor lazily on its own toggle event.
    if(!entry.querySelector('.world_entry_edit'))drawer?.dispatchEvent(new win.CustomEvent('inline-drawer-toggle',{bubbles:true,detail:{open:true}}));
    const form=entry.querySelector('.world_entry_edit');if(!form)return;
    const es={moves:[],created:[],undo:[],entry},view=ui.entryHost;ui.editing=es;
    const M=(n,host,before)=>{if(!n)return null;const mark=doc.createComment('cww-entry-return');n.before(mark);es.moves.push([n,mark]);before?host.insertBefore(n,before):host.append(n);return n;};
    const Q=n=>q(entry,n);
    const add=n=>{es.created.push(n);return n;};
    const field=(host,label,hint,nodes,cls='')=>{const f=make('div','cww-field'+(cls?' '+cls:'')),lab=make('div','cww-lab');if(label instanceof win.Node)lab.append(label);else lab.textContent=label;f.append(lab);if(hint){const hn=make('div','cww-hint');if(hint instanceof win.Node)hn.append(hint);else hn.textContent=hint;f.append(hn);}const box=make('div','cww-ctl');f.append(box);for(const n of [].concat(nodes))if(n)n instanceof win.Node&&!n.parentNode?box.append(n):M(n,box);host.append(f);return f;};
    const sec=(title,extra)=>{const s=make('section','cw-v4-section cww-esec'),h=make('h2','',title);if(extra)h.append(extra);s.append(h);const c=make('div','cw-v4-card');s.append(c);return {s,c};};
    const num=n=>{const x=Q(n);if(x){x.classList.add('cw-v4-num','cww-num');es.undo.push(()=>x.classList.remove('cw-v4-num','cww-num'));}return x;};
    const book=currentBook();
    const back=add(btn(book,()=>go('book'),'cwr-back cww-back',ICON.back()));
    // 名字单独一行，可以直接改（原生 comment 文本框）。
    const sh=add(make('div','cww-sheet-h')),comment=Q('comment');
    if(comment){comment.classList.add('cww-memo');es.undo.push(()=>comment.classList.remove('cww-memo'));M(comment,sh);if(!comment.placeholder){comment.placeholder=t('条目名字','Entry name');es.undo.push(()=>comment.removeAttribute('placeholder'));}}
    const hdr=entry.querySelector('.inline-drawer-header');
    const emenu=menu(es,[['复制这条',hdr?.querySelector('.duplicate_entry_button')],['移到其他世界书',hdr?.querySelector('.move_entry_button')]]);emenu.classList.add('cww-entry-more');sh.append(emenu);
    // 启用开关 + 常驻 / 关键词 / 向量。
    const bar=add(make('div','cww-statusbar')),onl=make('label','cww-on-l'),sw=make('button','cww-tg');sw.type='button';sw.setAttribute('role','switch');onl.append(sw,make('span','',t('启用','Enabled')));
    const kill=Q('entryKillSwitch');sw.addEventListener('click',()=>{kill?.click();paintStatus();});
    const seg=make('div','cww-seg');seg.setAttribute('role','group');seg.setAttribute('aria-label',t('触发方式','Trigger'));
    const stateSel=Q('entryStateSelector');const segBtns={};
    for(const [v,[zh,en,k]]of Object.entries(STATE)){const b=make('button','');b.type='button';const d=make('span','cww-dot');d.dataset.kind=k;b.append(d,make('span','',t(zh,en)));b.addEventListener('click',()=>{if(!stateSel||stateSel.value===v)return;stateSel.value=v;stateSel.dispatchEvent(new win.Event('input',{bubbles:true}));stateSel.dispatchEvent(new win.Event('change',{bubbles:true}));paintStatus();});seg.append(b);segBtns[v]=b;}
    if(stateSel){const park=add(make('div','cw-v4-park'));M(stateSel,park);bar.append(park);}
    bar.append(onl,seg);
    const keyHint=make('span','');
    function paintStatus(){sw.setAttribute('aria-checked',String(!kill?.classList.contains('fa-toggle-off')));const v=stateSel?.value;for(const [k,b]of Object.entries(segBtns))b.setAttribute('aria-pressed',String(k===v));
      text(keyHint,v==='constant'?t('常驻条目每次都会发送，关键词可以不填。','Constant entries are always sent; keywords are optional.'):v==='vectorized'?t('向量条目按语义相似度触发，关键词可选。','Vectorized entries trigger by similarity; keywords are optional.'):t('聊天里出现任意一个关键词时发送这条。','Sent when any keyword appears in the chat.'));}
    // 触发
    const keyNodes=n=>[entry.querySelector(`select[name="${n}"]`),entry.querySelector(`select[name="${n}"]+.select2-container`),entry.querySelector(`textarea[name="${n}"]`),entry.querySelector(`.${n==='key'?'keyprimary':'keysecondary'} .switch_input_type_icon`)].filter(Boolean);
    const trig=sec(t('触发','Trigger'));
    field(trig.c,t('关键词','Keywords'),keyHint,keyNodes('key'),'cww-keys-field');
    const logicLab=make('span','cww-lab-row');logicLab.append(make('span','',t('可选过滤器','Optional filter')),make('span','cww-grow'));const logic=Q('entryLogicType');if(logic){M(logic,logicLab);}
    field(trig.c,logicLab,t('和上面的关键词一起判断；留空就不用。','Checked together with the keywords above; leave empty to skip.'),keyNodes('keysecondary'),'cww-keys-field');
    // 内容
    const content=Q('content'),cm=content?.nextElementSibling?.matches('.tt-codemirror-editor')?content.nextElementSibling:null,counter=form.querySelector('.world_entry_form_token_counter');
    const expand=btn(t('放大','Expand'),()=>openBig(),'cwr-btn cww-expand',ICON.expand());
    const con=sec(t('内容','Content'),expand);con.s.classList.add('cww-content-sec');
    const cf=field(con.c,'','',[content,cm].filter(Boolean),'cww-content-field');cf.querySelector('.cww-lab').remove();
    const tok=make('div','cww-tok');cf.append(tok);if(counter){M(counter,tok);tok.dataset.pre=t('约 ','~');tok.dataset.suf=t(' Token',' tokens');}
    // 插入位置（两列）
    const ins=sec(t('插入位置','Insertion'));const grid=make('div','cww-grid4');ins.c.append(grid);
    field(grid,t('位置','Position'),'',[Q('position')]);field(grid,t('深度','Depth'),'',[num('depth')]);field(grid,t('顺序','Order'),'',[num('order')]);
    const prob=make('span','cww-inline');field(grid,t('触发概率','Trigger %'),'',[prob]);M(Q('useProbability'),prob);M(num('probability'),prob);prob.append(make('span','cww-unit','%'));
    const outlet=field(grid,t('输出口名称','Outlet name'),t('只在「输出口」位置时生效','Only for the Outlet position'),[Q('outletName')],'cww-wide');
    // 高级（默认收起）
    const fold=add(make('button','cww-fold'));fold.type='button';const foldT=make('span','cww-fold-t');fold.append(make('span','',t('高级','Advanced')),foldT);
    const adv=sec('');adv.s.classList.add('cww-adv');adv.s.querySelector('h2').remove();
    const setRow=(label,desc,nodes)=>{const r=make('div','cw-v4-row cww-set-row'),info=make('div','cw-v4-row-info'),c=make('div','cw-v4-row-controls');info.append(make('div','cw-v4-row-title',label));if(desc)info.append(make('p','',desc));r.append(info,c);for(const n of [].concat(nodes))if(n){n.type==='checkbox'?M(showToggle(es,n),c):M(n,c);}adv.c.append(r);return r;};
    setRow(t('不被其他条目递归触发','Not triggered by recursion'),'',[Q('excludeRecursion')]);
    setRow(t('不触发其他条目（防止递归）','Prevent further recursion'),'',[Q('preventRecursion')]);
    const delayBox=make('span','cww-inline');setRow(t('只在递归时触发','Delay until recursion'),t('可指定递归层级','Optional recursion level'),[delayBox]);M(Q('delay_until_recursion'),delayBox);M(num('delayUntilRecursionLevel'),delayBox);
    setRow(t('无视预算','Ignore budget'),'',[Q('ignoreBudget')]);
    const grp=make('span','cww-inline');setRow(t('分组','Group'),t('同组里只发送一条；可设组内优先和权重','One entry per group; priority and weight optional'),[grp]);M(Q('group'),grp);M(Q('groupOverride'),grp);M(num('groupWeight'),grp);
    const timed=make('span','cww-inline');setRow(t('粘性 / 冷却 / 延迟','Sticky / Cooldown / Delay'),t('触发后保持几轮、隔几轮再触发、从第几轮起','Keep for N turns, wait N turns, start after N'),[timed]);for(const n of ['sticky','cooldown','delay'])M(num(n),timed);
    const cf2=make('span','cww-inline cww-charfilter');setRow(t('只对这些角色生效','Only for these characters'),t('留空 = 所有角色','Empty = all characters'),[cf2]);
    const cfSel=Q('characterFilter');if(cfSel){M(cfSel,cf2);const c2=cfSel.nextElementSibling;if(c2?.matches('.select2-container'))M(c2,cf2);}
    const ex=Q('character_exclusion');if(ex){const l=make('label','cww-mini');cf2.append(l);M(ex,l);l.append(t('排除','Exclude'));}
    const scan=make('span','cww-inline');setRow(t('扫描设置','Scan settings'),t('留空或「跟随全局」：扫描深度、大小写、整词匹配、组评分','Blank or “use global”: scan depth, case, whole words, group scoring'),[scan]);for(const n of ['scanDepth','caseSensitive','matchWholeWords','useGroupScoring'])M(n==='scanDepth'?num(n):Q(n),scan);
    setRow(t('自动化 ID','Automation ID'),'',[Q('automationId')]);
    const trg=Q('triggers');if(trg){const tr=setRow(t('生成类型','Generation types'),t('只在这些生成方式下触发','Only for these generation types'),[]);const c=tr.querySelector('.cw-v4-row-controls');M(trg,c);const c2=trg.nextElementSibling;if(c2?.matches('.select2-container'))M(c2,c);}
    for(const [n,l] of [['matchPersonaDescription','也匹配用户角色描述'],['matchCharacterDescription','也匹配角色描述'],['matchCharacterPersonality','也匹配角色性格'],['matchCharacterDepthPrompt','也匹配角色备注'],['matchScenario','也匹配场景'],['matchCreatorNotes','也匹配作者的注释']])setRow(L(l),'',[Q(n)]);
    // ST hides some checkboxes until their section expands; show them as switches here.
    const shown=[];adv.c.querySelectorAll('input[type=checkbox]').forEach(c=>{if(c.style.display==='none'||c.hidden||c.classList.contains('displayNone')){shown.push([c,c.style.display,c.hidden]);c.style.display='';c.hidden=false;c.classList.add('cw-v4-icon-toggle');}});
    es.undo.push(()=>{for(const [c,d,hd]of shown){c.style.display=d;c.hidden=hd;c.classList.remove('cw-v4-icon-toggle');}});
    const paintFold=()=>{const open=!!ui.advOpen;fold.setAttribute('aria-expanded',String(open));text(foldT,open?t('收起','Collapse'):t('展开（递归、分组、粘性、角色过滤……）','Expand (recursion, groups, sticky, character filter…)'));setHidden(adv.s,!open);};
    fold.addEventListener('click',()=>{ui.advOpen=!ui.advOpen;paintFold();});
    // 底部：删除这条（左）· 完成（右，电脑）。
    const foot=add(make('div','cww-footbar')),del=btn(t('删除这条','Delete entry'),()=>{const d=hdr?.querySelector('.delete_entry_button');go('book');d?.click();},'cwr-btn cww-danger');
    foot.append(del,btn(t('完成','Done'),()=>go('book'),'cwr-btn cww-primary cww-desk-only'));
    view.replaceChildren(back,sh,bar,trig.s,con.s,ins.s,fold,adv.s,foot);
    for(const x of [trig.s,con.s,ins.s,adv.s])es.created.push(x);
    paintStatus();paintFold();
    const posSel=Q('position');const paintOutlet=()=>setHidden(outlet,posSel?.value!=='7');paintOutlet();posSel?.addEventListener('change',paintOutlet);es.undo.push(()=>posSel?.removeEventListener('change',paintOutlet));
    stateSel?.addEventListener('input',paintStatus);es.undo.push(()=>stateSel?.removeEventListener('input',paintStatus));
    const tokPaint=()=>{if(!counter&&content){text(tok,t(`约 ${Math.round(content.value.length/1.6)} Token`,`~${Math.round(content.value.length/1.6)} tokens`));}};tokPaint();content?.addEventListener('input',tokPaint);es.undo.push(()=>content?.removeEventListener('input',tokPaint));
    es.content=content;es.cm=cm;es.counter=counter;es.contentHost=cf;es.title=()=>comment?.value.trim()||t('（无标题）','(Untitled)');
    ui.view='entry';ui.panel.dataset.cwwView='entry';for(const [k,n]of Object.entries(ui.views))setHidden(n,k!=='entry');ui.panel.scrollTop=0;
    paintMobileHead();
    if(cm)measureCM(content);
  }
  function closeEntry(){
    const es=ui?.editing;if(!es)return;closeBig();ui.editing=null;
    for(const f of es.undo.splice(0).reverse())try{f();}catch{}
    // menu()/showToggle() from the drawer helpers record into es as a drawer state.
    for(const f of (es.cleanups||[]).splice(0))try{f();}catch{}
    for(const n of es.iconToggles||[])n.classList.remove('cw-v4-icon-toggle');
    // Both helpers push to the same array in call order: undo it in reverse.
    for(const [node,mark]of es.moves.splice(0).reverse())if(mark.parentNode)mark.replaceWith(node);
    for(const n of es.created)n.remove();
    ui.entryHost.replaceChildren();
    // Moved select2 companions are re-laid out by ST on next open; repaint the row.
    queue();
  }
  let cmModule=null;
  function measureCM(content){win.requestAnimationFrame(()=>{if(cmModule)cmModule.getMountedCodeMirrorEditor?.(content)?.requestMeasure?.();else import(new URL('/scripts/tauri/codemirror-editor.js',win.location.href).href).then(m=>{cmModule=m;m.getMountedCodeMirrorEditor?.(content)?.requestMeasure?.();}).catch(()=>{});});}
  /* ---------- 内容放大：整块面板变成编辑区，只有一条头 ---------- */
  function openBig(){
    const es=ui?.editing;if(!es?.content||ui.big)return;
    const host=doc.getElementById('cw-v4-settings')||ui.panel,big=make('div','cww-big'),bh=make('div','cww-bh'),title=make('div','cww-bh-t',t(`${es.title()} · 内容`,`${es.title()} · Content`)),tok=make('span','cww-tok');
    for(const type of ['click','mousedown','touchstart','pointerdown'])big.addEventListener(type,e=>e.stopPropagation());
    bh.append(btn(t('收起','Collapse'),()=>closeBig(),'cwr-btn cww-shrink',ICON.shrink()),title,tok);big.append(bh);if(es.counter){tok.dataset.pre=t('约 ','~');tok.dataset.suf=t(' Token',' tokens');}
    const marks=[];const take=n=>{if(!n)return;const m=doc.createComment('cww-big-return');n.before(m);marks.push([n,m]);};
    take(es.content);take(es.cm);take(es.counter);
    big.append(es.content);if(es.cm)big.append(es.cm);if(es.counter)tok.append(es.counter);else text(tok,t(`约 ${Math.round(es.content.value.length/1.6)} Token`,`~${Math.round(es.content.value.length/1.6)} tokens`));
    host.append(big);ui.big={big,marks};ui.panel.classList.add('cww-big-open');host.classList.add('cww-big-host');
    const esc=e=>{if(e.key==='Escape'&&!doc.querySelector('.select2-container--open')){e.preventDefault();e.stopImmediatePropagation();closeBig();}};win.addEventListener('keydown',esc,true);ui.big.esc=esc;
    es.content.focus({preventScroll:true});if(es.cm)measureCM(es.content);
  }
  function closeBig(){
    const b=ui?.big;if(!b)return;ui.big=null;win.removeEventListener('keydown',b.esc,true);
    for(const [n,m]of b.marks.reverse())if(m.parentNode)m.replaceWith(n);
    b.big.remove();ui.panel.classList.remove('cww-big-open');doc.getElementById('cw-v4-settings')?.classList.remove('cww-big-host');
    if(ui.editing?.cm)measureCM(ui.editing.content);
  }

  /* ---------- 激活设置：扫描（两列）、递归、匹配 ---------- */
  function buildAct(s,view){
    const back=btn(t('世界书','World Info'),()=>go('home'),'cwr-back cww-back',ICON.back()),head=make('div','cwr-list-head cww-head');head.append(make('h2','',t('激活设置','Activation settings')));
    view.append(back,head,make('p','cwr-lede cww-sub',t('对所有世界书生效。不确定的保持默认就行。','Applies to all World Info. Keep the defaults if unsure.')));
    const sec=title=>{const x=make('section','cw-v4-section');x.append(make('h2','',title));const c=make('div','cw-v4-card');x.append(c);view.append(x);return c;};
    const numField=(host,id,label,hint)=>{const counter=get(id+'_counter')||get(id);const f=make('div','cww-field'),box=make('div','cww-ctl');f.append(make('div','cww-lab',label),make('div','cww-hint',hint),box);host.append(f);if(counter){counter.classList.add('cw-v4-num','cww-num');cleanup(s,()=>counter.classList.remove('cw-v4-num','cww-num'));move(s,counter,box);}
      // The slider stays live but hidden: the counter is the visible control and
      // writes through ST's own delegated handler (2.0.340 A).
      const slider=get(id);if(slider&&slider!==counter){const park=make('div','cw-v4-park');f.append(park);move(s,slider,park);}return f;};
    const scan=sec(t('扫描','Scan')),grid=make('div','cww-grid4');scan.append(grid);
    numField(grid,'world_info_depth',t('扫描深度','Scan depth'),t('往回看几条消息找关键词','How many messages to scan'));
    numField(grid,'world_info_budget',t('上下文占比 %','Context %'),t('世界书最多占上下文多少','Maximum share of the context'));
    numField(grid,'world_info_budget_cap',t('预算上限','Budget cap'),t('0 = 不额外限制（Token）','0 = no extra limit (tokens)'));
    numField(grid,'world_info_min_activations',t('最少激活','Min activations'),t('至少激活几条','Activate at least N entries'));
    numField(grid,'world_info_min_activations_depth_max',t('最少激活时最多扫到','Max depth for min activations'),t('0 = 不限','0 = unlimited'));
    const setRow=(host,label,desc,node)=>{if(!node)return;const r=make('div','cw-v4-row cww-set-row'),info=make('div','cw-v4-row-info'),c=make('div','cw-v4-row-controls');info.append(make('div','cw-v4-row-title',label));if(desc)info.append(make('p','',desc));r.append(info,c);host.append(r);move(s,node.type==='checkbox'?showToggle(s,node):node,c);return r;};
    const rec=sec(t('递归','Recursion'));
    setRow(rec,t('递归扫描','Recursive scan'),t('被激活的条目里的关键词，也能触发别的条目','Keywords in activated entries can trigger others'),get('world_info_recursive'));
    const steps=get('world_info_max_recursion_steps_counter')||get('world_info_max_recursion_steps');if(steps){steps.classList.add('cw-v4-num','cww-num');cleanup(s,()=>steps.classList.remove('cw-v4-num','cww-num'));setRow(rec,t('最多递归几步','Max recursion steps'),t('0 = 不限','0 = unlimited'),steps);const sl=get('world_info_max_recursion_steps');if(sl&&sl!==steps){const park=make('div','cw-v4-park');rec.append(park);move(s,sl,park);}}
    const match=sec(t('匹配','Matching'));
    setRow(match,t('区分大小写','Case-sensitive'),'',get('world_info_case_sensitive'));
    setRow(match,t('匹配整个词','Match whole words'),'',get('world_info_match_whole_words'));
    setRow(match,t('包含名字','Include names'),'',get('world_info_include_names'));
    setRow(match,t('超出预算时提醒','Alert on overflow'),'',get('world_info_overflow_alert'));
    setRow(match,t('组评分','Group scoring'),'',get('world_info_use_group_scoring'));
    setRow(match,t('插入顺序策略','Insertion strategy'),t('多本世界书一起用时，谁先谁后','Which book goes first'),get('world_info_character_strategy'));
  }

  /* ---------- 手机顶栏 ---------- */
  function paintMobileHead(){
    if(!ui)return;const v=ui.view,head=doc.querySelector('.cw-v4-shell .cw-v4-head');
    const want=phoneWide()&&head&&ui.panel.classList.contains('openDrawer')&&!ui.panel.classList.contains('cw-v4-inactive');
    if(!want){ui.mobileHead?.remove();return;}
    let m=ui.mobileHead;if(!m){m=ui.mobileHead=make('div','cwr-mobile-head cww-mobile-head');}
    const key=v+'|'+currentBook()+'|'+ui.selecting+'|'+ui.selected.size;
    if(m.dataset.key!==key||!m.isConnected){m.dataset.key=key;const back=(label,to)=>{const b=btn(label,()=>go(to),'cwr-head-back cww-head-back',ICON.back());return b;};
      if(v==='home'&&ui.selecting)m.replaceChildren(button(t('取消','Cancel'),()=>stopSelecting(true),'cwr-head-back'),make('h1','',t(`已选 ${ui.selected.size} 本`,`${ui.selected.size} selected`)),button(t('全选','Select all'),()=>selectAll(),'cwr-head-action'));
      else if(v==='home'){const menuBtn=button('',()=>doc.querySelector('.cw-v4-shell .cw-v4-head .cw-v4-menu')?.click(),'cwr-head-back cww-head-ic');menuBtn.append(svg('<path d="M4 7h16M4 12h11M4 17h16"/>'));menuBtn.setAttribute('aria-label',t('菜单','Menu'));const plus=button('',()=>get('world_create_button')?.click(),'cwr-head-action cww-head-ic');plus.append(ICON.plus());plus.setAttribute('aria-label',t('新建世界书','New World Info'));m.replaceChildren(menuBtn,make('h1','',t('世界书','World Info')),plus);}
      else if(v==='book'){const more=button('',()=>{const d=ui.views.book.querySelector('.cww-book-more');if(d)d.open=!d.open;},'cwr-head-action cww-head-ic');more.append(ICON.more());more.setAttribute('aria-label',t('更多','More'));m.replaceChildren(back(t('世界书','World Info'),'home'),make('h1','',currentBook()),more);}
      else if(v==='entry')m.replaceChildren(back(currentBook(),'book'),make('h1',''),button(t('完成','Done'),()=>go('book'),'cwr-head-action cww-head-done'));
      else m.replaceChildren(back(t('世界书','World Info'),'home'),make('h1','',t('激活设置','Activation settings')),make('span','cww-head-spacer'));
    }
    if(!m.isConnected)head.append(m);
  }

  /* ---------- 换角色后第一次打开：自动切到角色的主世界书 ---------- */
  function autoOpenCharacterBook(){
    const c=ctx();if(!c||!ui)return;
    const id=c.groupId?'g:'+c.groupId:c.characterId!==undefined?'c:'+c.characterId+':'+(c.characters?.[c.characterId]?.avatar||''):'';
    if(id===ui.autoKey)return;ui.autoKey=id;
    if(!c.chatId||c.groupId)return;const info=charInfo();if(!info.main)return;
    const b=books().find(x=>x.name===info.main);if(!b)return;
    openBook(b.value);
  }

  /* ---------- 绘制 ---------- */
  let frame=0;
  function queue(){if(!frame&&ui)frame=win.requestAnimationFrame(()=>{frame=0;paint();});}
  function paint(){
    if(!ui)return;
    if(ui.editing&&!ui.editing.entry.isConnected){ui.view='book';closeEntry();for(const [k,n]of Object.entries(ui.views))setHidden(n,k!=='book');ui.panel.dataset.cwwView='book';}
    if(ui.view==='home'){paintWhere();paintBooks();}
    else if(ui.view==='book')paintBook();
    else paintMobileHead();
    if(ui.view!=='home')paintMobileHead();
  }
  function build(panel,s,page){
    destroy();
    ui={panel,page,s,view:'home',views:{},bookRows:new Map(),entryRows:new WeakMap(),selected:new Set(),selecting:false,filter:'all',autoKey:null,wasOpen:false};
    panel.classList.add('cww-world');cleanup(s,()=>{panel.classList.remove('cww-world','cww-native-entries','cww-big-open');delete panel.dataset.cwwView;});
    for(const k of ['home','book','entry','act']){const v=make('div','cww-view cww-v-'+k);v.dataset.cwwView=k;page.append(v);ui.views[k]=v;}
    buildHome(s,ui.views.home);buildBook(s,ui.views.book);buildEntryView(ui.views.entry);buildAct(s,ui.views.act);
    const sel=editor(),onBook=()=>{counts.delete(currentBook());stats.delete(currentBook());keyMemo=null;queue();};
    sel?.addEventListener('change',onBook);cleanup(s,()=>sel?.removeEventListener('change',onBook));
    const gl=get('world_info'),onGlobal=()=>queue();gl?.addEventListener('change',onGlobal);cleanup(s,()=>gl?.removeEventListener('change',onGlobal));
    const c=ctx(),types=c?.eventTypes||{},src=c?.eventSource,subs=[];
    const on=(type,fn)=>{if(src?.on&&type){src.on(type,fn);subs.push([type,fn]);}};
    const fresh=()=>{counts.clear();stats.clear();keyMemo=null;queue();};
    on(types.WORLDINFO_UPDATED,(name)=>{counts.delete(name);stats.delete(name);if(name===currentBook())keyMemo=null;queue();});
    on(types.CHAT_CHANGED,()=>queue());on(types.WORLDINFO_SETTINGS_UPDATED,fresh);on(types.SETTINGS_UPDATED,()=>queue());
    cleanup(s,()=>{for(const [type,fn]of subs)src.removeListener?.(type,fn);});
    // Load ST's module once for counts and keys (read-only); no network for the list.
    loadWI().then(()=>queue());
    ui.views.home.hidden=false;for(const k of ['book','entry','act'])ui.views[k].hidden=true;panel.dataset.cwwView='home';
    cleanup(s,destroy);
  }
  function sync(panel){
    if(!ui||ui.panel!==panel)return;
    const open=panel.classList.contains('openDrawer')&&!panel.classList.contains('cw-v4-inactive');
    if(open&&!ui.wasOpen){ui.wasOpen=true;stopSelecting(false);if(currentBook()&&ui.view==='home'){} autoOpenCharacterBook();}
    if(!open&&ui.wasOpen){ui.wasOpen=false;if(ui.view==='entry')go('book');closeBig();ui.mobileHead?.remove();}
    queue();
  }
  function destroy(){
    if(!ui)return;const u=ui;closeBig();closeEntry();u.mobileHead?.remove();if(frame){win.cancelAnimationFrame(frame);frame=0;}ui=null;
  }
  return {build,sync,destroy,go:v=>go(v),state:()=>ui&&{view:ui.view,book:currentBook(),selecting:ui.selecting,selected:[...ui.selected]}};
}
