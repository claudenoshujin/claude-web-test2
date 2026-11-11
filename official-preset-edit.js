/* 2.0.341 预设页 v2「编辑一条提示词」（稿 界面优化与新功能-20261103/design-preset-page-v2.html）。
 * 就是原生提示词编辑弹窗 #completion_prompt_manager_popup 换了外观：弹窗打开编辑时，把它的原生字段搬进预设面板里的一页，
 * 弹窗本身藏起来；「完成」点原生保存，返回点原生关闭；弹窗关掉（或切到「查看实际内容」）时字段放回原处。CW 不存任何数据。 */
export function createPresetEdit({win,t,make,button,icon,phoneWide}) {
  const doc=win.document,$=id=>doc.getElementById(id);
  const P='completion_prompt_manager_popup';
  const svg=(paths,w=1.8)=>{const s=doc.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width',String(w));s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');s.setAttribute('aria-hidden','true');s.innerHTML=paths;return s;};
  const ICO={back:'<path d="m15 6-6 6 6 6"/>',eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',more:'',trash:'<path d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',expand:'<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',shrink:'<path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5"/>'};
  const dots=()=>{const s=doc.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','currentColor');s.setAttribute('aria-hidden','true');s.innerHTML='<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>';return s;};
  const text=(n,v)=>{if(n&&n.textContent!==v)n.textContent=v;};
  const setHidden=(n,v)=>{if(n&&n.hidden!==v)n.hidden=v;};
  let panel=null,observer=null,lastId=null,ed=null,onClick=null,pmModule=null;
  const row=id=>id&&doc.querySelector(`#completion_prompt_manager_list [data-pm-identifier="${CSS.escape(id)}"]`);
  const visible=n=>!!n&&n.isConnected&&win.getComputedStyle(n).display!=='none';
  function install(p){
    if(panel===p)return;destroy();panel=p;
    const pop=$(P);if(!pop)return;
    // The row the user opened (native reads the identifier from the clicked row too).
    onClick=e=>{const a=e.target.closest?.('.prompt-manager-edit-action');if(a)lastId=a.closest('[data-pm-identifier]')?.dataset.pmIdentifier||null;else if(e.target.closest?.('.fa-plus-square,.fa-square-plus')||e.target.querySelector?.(':scope>.fa-plus-square,:scope>.fa-square-plus'))lastId=null;};
    doc.addEventListener('click',onClick,true);
    let frame=0;observer=new win.MutationObserver(()=>{if(!frame)frame=win.requestAnimationFrame(()=>{frame=0;sync();});});
    observer.observe(pop,{attributes:true,attributeFilter:['class','style']});for(const id of [P+'_edit',P+'_inspect']){const n=$(id);if(n)observer.observe(n,{attributes:true,attributeFilter:['class','style']});}
    sync();
  }
  function editing(){const pop=$(P);// The popup itself is display:none while CW shows the page, so only its state and edit section count.
    return !!pop&&pop.classList.contains('openDrawer')&&(ed||visible(pop))&&visible($(P+'_edit'))&&!!panel?.classList.contains('openDrawer');}
  function sync(){if(editing()){if(!ed)open();}else if(ed)close();}
  function open(){
    const pop=$(P),form=$(P+'_edit');if(!form||!panel)return;
    const moves=[],undo=[];const M=(n,host)=>{if(!n)return null;const mark=doc.createComment('cwp-return');n.before(mark);moves.push([n,mark]);host.append(n);return n;};
    const cls=(n,...c)=>{if(!n)return n;const added=c.filter(x=>!n.classList.contains(x));n.classList.add(...added);undo.push(()=>n.classList.remove(...added));return n;};
    const F=n=>$(P+'_entry_form_'+n);
    const id=lastId,isNew=!id,rowNow=()=>row(id);
    const name=F('name'),role=F('role'),trig=F('injection_trigger'),pos=F('injection_position'),depth=F('injection_depth'),order=F('injection_order'),forbid=F('forbid_overrides'),prompt=F('prompt');
    // Fields ST hides for this prompt (markers have no editable content; some have no override switch).
    const hasPrompt=visible(prompt?.closest('.completion_prompt_manager_popup_entry_form_control')||prompt),hasForbid=visible($('completion_prompt_manager_forbid_overrides_block')),hasTrig=visible(trig?.closest('.completion_prompt_manager_popup_entry_form_control')||trig);
    const marker=!!rowNow()?.querySelector('.fa-thumb-tack,.fa-thumbtack');
    // ST 1.18 对占位条目不藏内容框，只是把它设成不可用；这里照方案只写一句说明（也不给「放大」）。
    const editable=hasPrompt&&!marker&&!prompt?.disabled;
    const scrollBox=panel,scroll=scrollBox.scrollTop;
    const page=make('section','cwp-edit cwr-subpage'),field=(host,label,hint,nodes,extra='')=>{const f=make('div','cww-field'+(extra?' '+extra:'')),lab=make('div','cww-lab',label);f.append(lab);if(hint)f.append(make('div','cww-hint',hint));const box=make('div','cww-ctl');f.append(box);for(const n of [].concat(nodes))if(n)n.parentNode?M(n,box):box.append(n);host.append(f);return f;};
    const card=(host,c='')=>{const n=make('div','cw-v4-card cww-ecard'+(c?' '+c:''));host.append(n);return n;};
    const secH=(title,extra)=>{const h=make('h2','cww-sub-h',title);if(extra){h.append(make('span','cww-grow'),extra);}page.append(h);return h;};
    const swRow=(host,title,desc)=>{const r=make('div','cw-v4-row cww-set-row'),info=make('div','cw-v4-row-info'),c=make('div','cw-v4-row-controls'),p=make('p','',desc||'');info.append(make('div','cw-v4-row-title',title));if(desc)info.append(p);r.append(info,c);host.append(r);return {r,p,c};};
    const close=$(P+'_entry_form_close'),save=$(P+'_entry_form_save');
    const back=button('',()=>close?.click(),'cwr-back cww-back cwp-back');back.append(svg(ICO.back,1.9),make('span','',t('预设 · 提示词','Preset · Prompts')));
    // 标题：可直接改的名字 + 查看实际内容 + ⋯（从列表删除）。
    const head=make('div','cww-etitle cwp-title');if(name){cls(name,'cww-memo','cwp-name');M(name,head);}
    const inspectBtn=()=>rowNow()?.querySelector('.prompt-manager-inspect-action');
    const view=button('',()=>inspectBtn()?.click(),'cwr-btn cwp-inspect');view.append(svg(ICO.eye),make('span','',t('查看实际内容','View actual content')));
    const more=make('details','cw-v4-more cwr-pop cwp-more'),sum=make('summary','','⋯');sum.setAttribute('aria-label',t('更多','More'));const list=make('div','cw-v4-more-list');more.append(sum,list);
    const del=button('',async()=>{more.open=false;const r=rowNow(),d=r?.querySelector('.prompt-manager-detach-action');if(!d)return;if(!win.confirm(t('把这条提示词从当前列表里删掉？原提示词保留，可以再插入。','Remove this prompt from the list? It stays available to insert again.')))return;close?.click();win.setTimeout(()=>rowNow()?.querySelector('.prompt-manager-detach-action')?.click(),60);},'cw-v4-more-item cw-v4-danger');del.append(svg(ICO.trash),make('span','',t('从列表删除','Remove from list')));list.append(del);
    // ST only offers Remove for prompts it allows deleting (isPromptDeletionAllowed); system prompts have none.
    if(!rowNow()?.querySelector('.prompt-manager-detach-action')){del.disabled=true;del.title=t('酒馆自带的提示词不能从列表删除，可以关掉它','Built-in prompts cannot be removed; turn them off instead');
      // 复看 #4：灰掉时在下面写明原因（悬停提示在手机上看不到）。
      list.append(make('div','cwp-more-note',t('系统自带的提示词不能删，可以关掉它','Built-in prompts can’t be removed; turn them off instead')));}
    // 原生 isPromptInspectionAllowed 对所有条目都返回 true，占位条目也能查看实际内容（复看 #3）。
    if(!isNew)head.append(view);if(!isNew)head.append(more);
    const viewPhone=button('',()=>inspectBtn()?.click(),'cwr-btn cwp-inspect-phone');viewPhone.append(svg(ICO.eye),make('span','',t('查看实际内容','View actual content')));
    page.append(back,head);if(!isNew)page.append(viewPhone);
    // 「查看实际内容」只在这条进了上次的发送时有内容（原生 handleInspect 的条件）。
    const markInspect=()=>{if(!pmModule){import(new URL('/scripts/openai.js',win.location.href).href).then(m=>{pmModule=m;markInspect();},()=>{});return;}let can=false;try{can=pmModule.promptManager?.messages?.hasItemWithIdentifier(id)===true;}catch{}for(const b of [view,viewPhone]){b.disabled=!can;b.title=can?'':t('这条现在不会发送，没有实际内容可看','Not sent right now, so there is nothing to inspect');}};if(!isNew)markInspect();
    // 1 启用：和列表行上同一个开关。
    if(!isNew){const c1=card(page),en=swRow(c1,t('启用','Enabled'),''),sw=make('button','cww-tg');en.r.querySelector('.cw-v4-row-info').append(en.p);// 说明跟着开关变（稿：这条会发送给模型 / 关掉后保留内容，但不会发送）
      sw.type='button';sw.setAttribute('role','switch');sw.setAttribute('aria-label',t('启用','Enabled'));en.c.append(sw);
      const paintOn=()=>{const tg=rowNow()?.querySelector('.prompt-manager-toggle-action'),on=!!tg&&!tg.classList.contains('fa-toggle-off')&&!rowNow()?.classList.contains('completion_prompt_manager_prompt_disabled');sw.setAttribute('aria-checked',String(on));text(en.p,on?t('这条会发送给模型','Sent to the model'):t('关掉后保留内容，但不会发送','Kept, but not sent'));};
      sw.addEventListener('click',()=>{rowNow()?.querySelector('.prompt-manager-toggle-action')?.click();win.setTimeout(paintOn,120);});paintOn();ed&&(ed.paintOn=paintOn);page._paintOn=paintOn;}
    // 2 发送方式：身份 · 位置（相对 / 聊天中）；聊天中多一行深度 · 顺序；生成方式胶囊；不让角色卡覆盖。
    secH(t('发送方式','How it is sent'));const c2=card(page);const g=make('div','cww-grid cww-c2');c2.append(g);
    if(role)cls(role,'cww-sel');field(g,t('身份','Role'),t('这段话算谁说的','Who says this'),[role]);
    const seg=make('div','cww-seg cwp-seg');const segBtns=[];for(const [v,zh,en] of [['0','相对','Relative'],['1','聊天中','In chat']]){const b=make('button','',t(zh,en));b.type='button';b.dataset.v=v;b.addEventListener('click',()=>{if(!pos||pos.value===v)return;pos.value=v;pos.dispatchEvent(new win.Event('change',{bubbles:true}));pos.dispatchEvent(new win.Event('input',{bubbles:true}));paintPos();});seg.append(b);segBtns.push(b);}
    const posPark=make('div','cww-park');if(pos)M(pos,posPark);
    field(g,t('位置','Position'),t('放在列表里的位置，或插进聊天记录','In the list, or inserted into the chat'),[seg,posPark]);
    if(depth)cls(depth,'cw-v4-num','cww-num');if(order)cls(order,'cw-v4-num','cww-num');
    const dF=field(g,t('深度','Depth'),t('插在倒数第几条消息前','Before the Nth last message'),[depth]),oF=field(g,t('顺序','Order'),t('同一深度里谁先谁后','Order within the same depth'),[order]);
    function paintPos(){const inChat=pos?.value==='1';for(const b of segBtns)b.setAttribute('aria-pressed',String(b.dataset.v===(pos?.value||'0')));setHidden(dF,!inChat);setHidden(oF,!inChat);}
    if(hasTrig&&trig){const pills=make('div','cww-pills'),park=make('div','cww-park');const c=win.jQuery?.(trig).data?.('select2')?.$container?.[0]||(trig.nextElementSibling?.matches?.('.select2-container')?trig.nextElementSibling:null);M(trig,park);if(c)M(c,park);
      const GEN={normal:['正常发送','Normal'],continue:['继续','Continue'],impersonate:['AI 帮答','Impersonate'],swipe:['滑动','Swipe'],regenerate:['重新生成','Regenerate'],quiet:['静默生成','Quiet']};
      for(const o of trig.options){if(!o.value)continue;const b=make('button','cww-pk',t(...(GEN[o.value]||[o.textContent.trim(),o.textContent.trim()])));b.type='button';const paintP=()=>b.setAttribute('aria-pressed',String(o.selected));b.addEventListener('click',()=>{o.selected=!o.selected;if(win.jQuery)win.jQuery(trig).trigger('change');else trig.dispatchEvent(new win.Event('change',{bubbles:true}));paintP();});paintP();pills.append(b);}
      field(c2,t('只在这些生成方式下发送','Only for these generation types'),t('都不选 = 所有方式','None = all types'),[pills,park]);}
    if(hasForbid&&forbid){const fr=swRow(c2,t('不让角色卡覆盖','Do not let the character card override'),t('角色卡里写了同名提示词时，仍用这一条','Keep this one even if the card has the same prompt'));M(forbid,fr.c);cls(forbid,'cwp-forbid');}
    // 3 内容：原生 prompt 文本框 + 放大；占位条目只写一句说明。
    let big=null;
    const expand=button('',()=>openBig(),'cwr-btn cww-btn-sm cww-expand cwp-expand');expand.append(svg(ICO.expand),make('span','',t('放大','Expand')));
    secH(t('内容','Content'),editable?expand:null);const c3=card(page);
    const tokenText=()=>{const tk=rowNow()?.querySelector('.prompt_manager_prompt_tokens')?.textContent.trim();return /\d/.test(tk||'')?t(`约 ${tk} Token`,`~${tk} tokens`):t('Token 尚未统计','Tokens not counted');};
    if(editable&&prompt){const f=field(c3,'',null,[prompt],'cww-content-field cwp-content');f.querySelector('.cww-lab').remove();cls(prompt,'cwp-prompt');f.append(make('div','cww-tok',tokenText()));}
    else c3.append(make('div','cww-field cwp-marker-note',t('这是占位项，内容由酒馆在发送时自动填入（例如用户角色描述），这里不能编辑。','This is a placeholder; SillyTavern fills it in when sending, so it cannot be edited here.')));
    function openBig(){if(big||!prompt)return;const host=$('cw-v4-settings')||panel,b=make('div','cww-big'),bh=make('div','cww-bh'),sh=button('',()=>closeBig(),'cwr-btn cww-shrink');sh.append(svg(ICO.shrink),make('span','',t('收起','Collapse')));bh.append(sh,make('div','cww-bh-t',t(`${name?.value||''} · 内容`,`${name?.value||''} · Content`)),make('span','cww-tok',tokenText()));b.append(bh);
      for(const type of ['click','mousedown','touchstart','pointerdown'])b.addEventListener(type,e=>e.stopPropagation());const mark=doc.createComment('cwp-big');prompt.before(mark);b.append(prompt);host.append(b);host.classList.add('cww-big-host');panel.classList.add('cww-big-open');
      const esc=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeBig();}};win.addEventListener('keydown',esc,true);big={b,mark,esc,host};prompt.focus({preventScroll:true});}
    function closeBig(){if(!big)return;win.removeEventListener('keydown',big.esc,true);if(big.mark.parentNode)big.mark.replaceWith(prompt);big.b.remove();big.host.classList.remove('cww-big-host');panel.classList.remove('cww-big-open');big=null;}
    // 完成：照原生保存流程走。
    // 吸底渐变渐到页面底色（面板实际底色，随设备 / 配色变），不是卡片色——夜间否则是一条亮带（同世界书 round2 #10）。
    const foot=make('div','cww-footbar cwp-foot');{const pg=win.getComputedStyle(panel).backgroundColor;if(pg&&pg!=='rgba(0, 0, 0, 0)'&&pg!=='transparent')foot.style.setProperty('--cwp-page',pg);}const done=button(t('完成','Done'),()=>save?.click(),'cwr-btn cww-primary cww-desk-only');foot.append(done);page.append(foot);
    panel.append(page);panel.classList.add('cwp-edit-open');doc.documentElement.classList.add('cwp-editing');panel.scrollTop=0;
    paintPos();
    // 手机顶栏：‹ 提示词 · ⋯ · 完成
    let mhead=null;const shellHead=doc.querySelector('.cw-v4-shell .cw-v4-head');
    if(phoneWide()&&shellHead){mhead=make('div','cwr-mobile-head cww-mobile-head cwp-mobile-head');const bk=button('',()=>close?.click(),'cwr-head-back cww-head-back');bk.append(svg(ICO.back,1.9),make('span','',t('提示词','Prompts')));const right=make('span','cww-head-right');if(!isNew){const m2=button('',()=>{more.cwAnchor=m2;more.open=!more.open;},'cwr-head-action cww-head-ic');m2.append(dots());m2.setAttribute('aria-label',t('更多','More'));right.append(m2);}right.append(button(t('完成','Done'),()=>save?.click(),'cwr-head-action cww-head-done'));mhead.append(bk,make('h1',''),right);shellHead.append(mhead);}
    ed={page,moves,undo,closeBig,mhead,scroll,scrollBox,id};
  }
  function close(){
    const e=ed;if(!e)return;ed=null;e.closeBig();
    for(const f of e.undo.splice(0).reverse())try{f();}catch{}
    for(const [n,mark]of e.moves.splice(0).reverse())if(mark.parentNode)mark.replaceWith(n);
    e.page.remove();e.mhead?.remove();panel?.classList.remove('cwp-edit-open');doc.documentElement.classList.remove('cwp-editing');
    // 列表滚动位置不变：保存会让原生整表重画，等它画完再放回去。
    const box=e.scrollBox,y=e.scroll;let n=0;const put=()=>{if(!box?.isConnected)return;box.scrollTop=y;if(++n<6)win.requestAnimationFrame(put);};put();win.setTimeout(put,250);
  }
  function destroy(){close();observer?.disconnect();observer=null;if(onClick)doc.removeEventListener('click',onClick,true);onClick=null;panel=null;}
  return {install,destroy};
}
