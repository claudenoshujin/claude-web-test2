// Native PromptManager adapter. No prompt bodies or private manager state are written.
export function createPresetList({win,make,button,t}) {
  const doc=win.document;
  let ui=null;
  const ROW='.completion_prompt_manager_prompt[data-pm-identifier]';
  const canonical=r=>r?.matches?.(ROW)&&r.dataset.presetFavoriteMirror!=='true'&&r.closest('ul')?.matches('#completion_prompt_manager_list,.bai-bai-preset-group-list');
  const rows=()=>[...(ui?.manager.querySelectorAll('#completion_prompt_manager_list '+ROW)||[])].filter(canonical);
  const node=r=>r?.nodeType===1?r:r?.row;
  const id=r=>r?.identifier??r?.dataset?.pmIdentifier;
  const toggle=r=>node(r)?.querySelector('.prompt-manager-toggle-action');
  const allowed=r=>{if(!r)return false;const n=toggle(r);return n?!n.matches('[disabled],[aria-disabled="true"],.disabled'):!!r.prompt&&ui?.nativePM?.isPromptToggleAllowed?.(r.prompt)===true;};
  const on=r=>{const n=toggle(r);return n?n.classList.contains('fa-toggle-on'):r?.order?r.order.enabled!==false:!!node(r)&&!node(r).classList.contains('completion_prompt_manager_prompt_disabled');};
  function removeVisibleControls(u,row){if(!u.decoratedRows?.delete(row))return;row.querySelectorAll('.cw-pm-select,.cw-pm-number,.cw-pm-state').forEach(n=>n.remove());}
  function clearVisibleControls(u){u.rowObserver?.disconnect();u.rowObserver=null;u.viewportRoot=null;for(const row of u.decoratedRows||[])removeVisibleControls(u,row);u.observedRows?.clear();u.inView?.clear();}
  function trackVisibleControls(all){
    const u=ui;u.decoratedRows||=new Set();if(!win.IntersectionObserver)return false;
    const root=u.manager.querySelector('#completion_prompt_manager_list');if(!root)return false;
    if(u.viewportRoot!==root){clearVisibleControls(u);u.viewportRoot=root;u.observedRows=new Set();u.inView=new Set();u.rowObserver=new win.IntersectionObserver(records=>{if(ui!==u||u.viewportRoot!==root)return;for(const entry of records){if(!u.observedRows.has(entry.target)||!root.contains(entry.target)){u.inView.delete(entry.target);continue;}entry.isIntersecting?u.inView.add(entry.target):u.inView.delete(entry.target);}u.queuePaint?.();},{root,rootMargin:'240px 0px',threshold:0});}
    const current=new Set(all.map(node).filter(Boolean));
    for(const row of u.observedRows)if(!current.has(row)){u.rowObserver.unobserve(row);u.observedRows.delete(row);u.inView.delete(row);removeVisibleControls(u,row);}
    for(const row of current)if(!u.observedRows.has(row)){u.observedRows.add(row);u.rowObserver.observe(row);}
    return true;
  }
  function entries(){
    const mounted=new Map(rows().map(r=>[id(r),r])),pm=ui?.nativePM;
    const order=pm?.getPromptOrderForCharacter?.(pm.activeCharacter),defs=pm?.serviceSettings?.prompts;
    if(!order?.length||!Array.isArray(defs))return [...mounted].map(([identifier,row])=>({identifier,row,name:row.querySelector('.completion_prompt_manager_prompt_name')?.dataset.pmName||''}));
    const prompts=new Map(defs.map(p=>[p.identifier,p])),ctx=win.SillyTavern?.getContext?.(),settings=ctx?.chatCompletionSettings;
    const preset=ctx?.getPresetManager?.('openai')?.getCompletionPresetByName?.(settings?.preset_settings_openai);
    const groups=(settings?.extensions||preset?.extensions)?.baibaiToolkit?.presetPromptGroups?.prompts||{};
    return order.filter(e=>prompts.has(e.identifier)).map(order=>{const prompt=prompts.get(order.identifier),row=mounted.get(order.identifier);return {identifier:order.identifier,row,prompt,order,name:prompt.name||'',group:row?.dataset.presetGroupId||groups[order.identifier]?.groupId||''};});
  }
  const find=key=>entries().find(r=>id(r)===key);
  function restoreGroups(u=ui){if(!u)return;for(const [key]of u.expanded){const group=[...u.manager.querySelectorAll('.bai-bai-preset-group')].find(g=>g.dataset.presetGroupId===key);if(group&&!group.classList.contains('bai-bai-preset-group-collapsed'))group.querySelector('.bai-bai-preset-group-toggle')?.click();}u.expanded.clear();u.expanding.clear();}
  function expandGroup(group){if(!group?.classList.contains('bai-bai-preset-group-collapsed')||ui.expanding.has(group.dataset.presetGroupId))return;const key=group.dataset.presetGroupId;ui.expanded.set(key,true);ui.expanding.add(key);group.querySelector('.bai-bai-preset-group-toggle')?.click();win.setTimeout(()=>{if(ui){ui.expanding.delete(key);paint();}},220);}
  function ensureRow(key){const entry=find(key),row=node(entry),group=row?.closest('.bai-bai-preset-group')||[...ui.manager.querySelectorAll('.bai-bai-preset-group')].find(g=>g.dataset.presetGroupId===entry?.group);expandGroup(group);if(row&&!group?.classList.contains('bai-bai-preset-group-collapsed'))return Promise.resolve(entry);return new Promise(resolve=>{let timer;const done=()=>{const fresh=find(key);if(node(fresh)){observer.disconnect();win.clearTimeout(timer);resolve(fresh);}};const observer=new win.MutationObserver(done);observer.observe(ui.manager,{childList:true,subtree:true});timer=win.setTimeout(()=>{observer.disconnect();resolve(null);},1800);done();});}
  function restoreSort(e){if(!e.node.isConnected||e.alive?.()===false)return;try{for(const k of ['disabled','handle'])if(e.get(k)===e.applied[k]&&!(k==='disabled'&&e.locked?.()))e.set(k,e.original[k]);}catch{}}
  function sortables(block){
    const list=ui.manager.querySelector('#completion_prompt_manager_list');if(!list)return;
    const found=new Map(),$=win.jQuery;
    if(!list.closest('.bai-bai-preset-vue-list-host')&&$&&$(list).hasClass('ui-sortable')){const instance=$(list).sortable('instance');if(instance)found.set(instance,{node:list,alive:()=>list.isConnected&&$(list).hasClass('ui-sortable')&&$(list).sortable('instance')===instance,get:k=>instance.option(k),set:(k,v)=>instance.option(k,v)});}
    for(const ul of [list,...list.querySelectorAll('.bai-bai-preset-group-list')])for(const k of Object.keys(ul)){const v=ul[k];if(k.startsWith('Sortable')&&v&&typeof v.option==='function')found.set(v,{node:ul,get:k=>v.option(k),set:(k,x)=>v.option(k,x)});}
    for(const [instance,e]of ui.sortables)if(!found.has(instance)){restoreSort(e);ui.sortables.delete(instance);}
    for(const [instance,api]of found){let e=ui.sortables.get(instance);if(!e){e={...api,original:{disabled:api.get('disabled'),handle:api.get('handle')},applied:{}};ui.sortables.set(instance,e);}for(const k of ['disabled','handle'])if(k in e.applied&&e.get(k)!==e.applied[k])e.original[k]=e.get(k);
      e.locked=()=>{const group=e.get('group');if(list.classList.contains('bai-bai-preset-drag-locked')||group?.pull===false)return true;try{return typeof group?.checkPull==='function'&&group.checkPull(instance,instance,null,null)===false;}catch{return true;}};const locked=e.locked();
      const desired={disabled:block||!!e.original.disabled||locked,handle:api.node===list&&list.closest('.bai-bai-preset-vue-list-host')?'.drag-handle, .bai-bai-preset-group-header':'.drag-handle'};
      // A disabled native sorter cannot start; assigning its handle walks every row.
      // Apply the handle only when sort mode actually enables dragging.
      for(const k of ['disabled',...(!desired.disabled?['handle']:[])]){if(e.get(k)!==desired[k])e.set(k,desired[k]);e.applied[k]=desired[k];}
    }
  }
  const key=()=>{const c=win.SillyTavern?.getContext?.();return JSON.stringify([doc.getElementById('settings_preset_openai')?.value,c?.characterId,c?.groupId,c?.chatId]);};
  const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  const attr=(el,name,value)=>{if(el.getAttribute(name)!==String(value))el.setAttribute(name,String(value));};
  const flag=(el,name,value)=>{if(el.classList.contains(name)!==value)el.classList.toggle(name,value);};
  const hidden=(el,value)=>{if(el.hidden!==value)el.hidden=value;};
  const prop=(el,name,value)=>{if(el[name]!==value)el[name]=value;};
  function rememberHidden(r){if(!ui.hidden.has(r)){ui.hidden.set(r,r.hidden);const ref=new win.WeakRef(r);ui.hiddenRefs.add(ref);ui.hiddenFinalizer.register(r,ref,ref);}}
  function* hiddenNodes(u){for(const ref of u.hiddenRefs){const r=ref.deref();if(r)yield r;else u.hiddenRefs.delete(ref);}}
  function reset(){if(!ui)return;if(ui.context===key())restoreGroups();else{ui.expanded.clear();ui.expanding.clear();}ui.epoch++;ui.selected.clear();ui.lastStates.clear();ui.undo=null;ui.frozen=null;ui.anchor=null;ui.multi=false;ui.sort=false;ui.context=key();text(ui.message,'');paint();}
  function paint(){
    if(!ui)return;
    if(ui.context!==key()){reset();return;}
    if(!ui.panel.classList.contains('openDrawer')||ui.panel.classList.contains('cw-v4-inactive')){delete ui.panel.dataset.cwPresetTab;clearVisibleControls(ui);return;}
    if(!ui.manager.contains(ui.tools)){ui.manager.prepend(ui.tools,ui.filterLine,ui.selectionLine);ui.manager.append(ui.empty,ui.bottom);}
    if(ui.manager.lastElementChild!==ui.bottom)ui.manager.append(ui.empty,ui.bottom);
    const active=doc.getElementById('main_api')?.value==='openai';hidden(ui.tabBar,!active);
    if(active){if(ui.panel.dataset.cwPresetTab!==ui.tab)ui.panel.dataset.cwPresetTab=ui.tab;}else delete ui.panel.dataset.cwPresetTab;
    if(ui.dragging)return;
    const all=entries(),query=ui.search.value.trim().toLocaleLowerCase(),filtering=!!query||ui.filter!=='all';
    const match=e=>ui.busy&&ui.actionRows?.has(id(e))||(ui.frozen?ui.frozen.has(id(e)):e.name.toLocaleLowerCase().includes(query)&&(ui.filter==='all'||on(e)===(ui.filter==='on')));
    const visible=all.filter(match),visibleKeys=new Set(visible.map(id)),viewportControls=trackVisibleControls(all);
    flag(ui.manager,'cw-pm-filtering',filtering);
    if(!filtering&&!ui.busy)restoreGroups();
    for(const group of ui.manager.querySelectorAll('.bai-bai-preset-group')){rememberHidden(group);const has=visible.some(e=>e.group===group.dataset.presetGroupId);hidden(group,filtering&&!has);if(filtering&&has)expandGroup(group);}
    for(const [index,entry] of all.entries()){
      const r=node(entry);if(!r)continue;rememberHidden(r);flag(r,'cw-pm-row',true);flag(r,'cw-pm-native-row',!!r.closest('.bai-bai-preset-vue-list-host'));
      const name=r.querySelector('.completion_prompt_manager_prompt_name');
      if(name){attr(name,'tabindex','0');attr(name,'role','button');}
      const label=entry.name;hidden(r,!visibleKeys.has(id(r)));
      const decorate=!viewportControls||ui.inView.has(r)||r.contains(doc.activeElement);
      if(decorate){ui.decoratedRows.add(r);
      let box=r.querySelector('.cw-pm-select'),number=r.querySelector('.cw-pm-number');
      if(!box){box=make('input','cw-pm-select');box.type='checkbox';box.setAttribute('aria-label',t('选择提示词','Select prompt')+': '+label);r.prepend(box);}
      if(!number){number=make('span','cw-pm-number');r.prepend(number);}
      text(number,String(index+1).padStart(2,'0'));prop(box,'checked',ui.selected.has(id(r)));prop(box,'disabled',!allowed(r)||ui.busy);
      prop(box,'title',allowed(r)?'':t('原生不允许启停','Native prompt cannot be toggled'));
      }
      flag(r,'cw-pm-selected',ui.selected.has(id(r)));
      // The legacy TT fallback owns an inline !important display value.
      const handle=r.querySelector(':scope > .clawd-prompt-drag-handle');
      if(handle){const display=ui.sort?'inline-flex':'none';if(handle.style.getPropertyValue('display')!==display)handle.style.setProperty('display',display,'important');}
      const n=toggle(r);if(n)attr(n,'aria-checked',on(r));
      if(ui.undo&&!ui.busy&&ui.lastStates.has(id(r))&&ui.lastStates.get(id(r))!==on(r))for(const task of ui.undo)if(task.id===id(r)){
        // A native batch can finish while closed, leaving our DOM-state cache behind.
        const entry=ui.nativePM?.getPromptOrderEntry?.(ui.nativePM.activeCharacter,task.id);
        if(!entry||(entry.enabled!==false)!==task.after)task.conflict=true;
      }
      ui.lastStates.set(id(r),on(r));
      if(decorate){
      let status=r.querySelector('.cw-pm-state');if(!status){status=make('span','cw-pm-state');r.append(status);}
      text(status,allowed(r)?(on(r)?t('开','On'):t('关','Off')):t('固定','Fixed'));
      }else removeVisibleControls(ui,r);
    }
    ui.visible=visible.map(id);ui.rangeVisible=visible.filter(e=>node(e)&&!node(e).closest('.bai-bai-preset-group-collapsed')).map(id);
    // An empty list can be the middle of native renderTemplateAsync, not a deletion.
    const invisible=[...ui.selected].filter(k=>!ui.visible.includes(k)).length;
    text(ui.count,`${visible.length} / ${all.length} · ${all.filter(on).length} `+t('条启用','enabled'));
    text(ui.selection,t(`已选 ${ui.selected.size} 条${invisible?`，其中 ${invisible} 条不在当前筛选中`:''}`,`${ui.selected.size} selected${invisible?`, ${invisible} hidden`:''}`));
    text(ui.multiButton,ui.multi?t('完成','Done'):t('多选','Select'));
    attr(ui.multiButton,'aria-pressed',ui.multi);
    text(ui.sortButton,ui.sort?t('完成排序','Done sorting'):t('调整顺序','Reorder'));
    flag(ui.manager,'cw-pm-multi',ui.multi&&!ui.baiAction);flag(ui.manager,'cw-pm-sort',ui.sort);
    hidden(ui.selectionLine,!ui.multi);hidden(ui.batch,!ui.multi);hidden(ui.empty,visible.length!==0);
    hidden(ui.feedback,!ui.message.textContent&&!ui.undo&&!ui.busy);attr(ui.manager,'aria-busy',ui.busy);
    hidden(ui.undoButton,!ui.undo);prop(ui.undoButton,'disabled',ui.busy);
    for(const b of [ui.enable,ui.disable,ui.clear])prop(b,'disabled',ui.busy||!ui.selected.size);
    prop(ui.allButton,'disabled',ui.busy||!visible.some(allowed));prop(ui.multiButton,'disabled',ui.busy);prop(ui.sortButton,'disabled',ui.busy||ui.multi);
    prop(ui.search,'disabled',ui.busy);
    for(const b of ui.filters){prop(b,'disabled',ui.busy);attr(b,'aria-pressed',b.dataset.filter===ui.filter);}
    // Gate every existing sorter; keep plugin groups, callbacks and movement rules.
    sortables(!ui.sort||ui.multi||ui.busy||!!query||ui.filter!=='all');
  }

  function select(r,shift){
    if(ui.busy||!allowed(r))return;
    const k=id(r),value=!ui.selected.has(k),a=ui.rangeVisible.indexOf(ui.anchor),b=ui.rangeVisible.indexOf(k);
    const keys=shift&&a>=0&&b>=0?ui.rangeVisible.slice(Math.min(a,b),Math.max(a,b)+1):[k];
    for(const next of keys)if(allowed(find(next)))value?ui.selected.add(next):ui.selected.delete(next);
    ui.anchor=k;paint();
  }
  // Observe completion of a native render. Re-query on each check, never reuse its old row.
  async function setOne(k,target,epoch){const mounted=await ensureRow(k);if(!ui||ui.epoch!==epoch||!mounted)return false;return new Promise(resolve=>{
    const r=find(k);if(!r||!allowed(r))return resolve(false);if(on(r)===target)return resolve(true);
    let timer,observer,done=false;
    const finish=value=>{if(done)return;done=true;observer?.disconnect();win.clearTimeout(timer);resolve(value);};
    const check=()=>{if(!ui||ui.epoch!==epoch||ui.context!==key())return finish(false);const fresh=find(k);if(fresh&&on(fresh)===target)finish(true);};
    observer=new win.MutationObserver(check);observer.observe(ui.manager,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    timer=win.setTimeout(()=>finish(false),2500);
    try{ui.nativeAction=toggle(r);ui.nativeAction.click();ui.nativeAction=null;check();}catch{if(ui)ui.nativeAction=null;finish(false);}
  });}
  function batchManager(){
    const pm=ui?.nativePM;
    if(!pm||!['getPromptOrderEntry','render','saveServiceSettings'].every(k=>typeof pm[k]==='function')||typeof pm.tokenHandler?.getCounts!=='function')return null;
    const counts=pm.tokenHandler.getCounts();return counts&&typeof counts==='object'?{pm,counts}:null;
  }
  function deadline(promise,ms){return new Promise(resolve=>{const timer=win.setTimeout(()=>resolve({timeout:true}),ms);Promise.resolve(promise).then(()=>{win.clearTimeout(timer);resolve({ok:true});},error=>{win.clearTimeout(timer);resolve({error});});});}
  function confirmBatch(current,epoch,scope,record,pm){
    let cancel;
    const promise=new Promise(resolve=>{
      let timer,observer,finished=false;
      const finish=value=>{if(finished)return;finished=true;observer?.disconnect();win.clearTimeout(timer);const i=current.dispose.indexOf(cancel);if(i>=0)current.dispose.splice(i,1);resolve(value);};
      cancel=()=>finish(false);current.dispose.push(cancel);
      const check=()=>{if(ui!==current||current.epoch!==epoch||key()!==scope)return finish(false);
        const mounted=new Map(rows().map(r=>[id(r),r]));if(!mounted.size)return;
        if(record.every(task=>{const r=mounted.get(task.id),entry=pm.getPromptOrderEntry(pm.activeCharacter,task.id);return entry?.enabled===task.after&&(r?on(r)===task.after:!task.mounted);}))finish(true);
      };
      observer=new win.MutationObserver(check);observer.observe(current.manager,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});timer=win.setTimeout(()=>finish(false),15000);check();
    });return {promise,cancel:()=>cancel?.()};
  }
  async function run(target,undo=false){
    if(!ui||ui.busy)return;
    const current=ui,epoch=ui.epoch,scope=ui.context,batch=batchManager(),catalog=new Map(entries().map(e=>[id(e),e]));
    const tasks=undo?[...(ui.undo||[])]:[...ui.selected].map(k=>({id:k,before:on(catalog.get(k)),after:target}));
    current.batchPath=batch?'native':'serial';current.batchError=null;
    ui.frozen||=new Set(ui.visible);ui.busy=true;ui.undo=null;text(ui.message,t(`正在处理 ${tasks.length} 条…`,`Processing ${tasks.length} prompts…`));paint();
    let changed=0,skipped=0,failed=0,processed=0,pending=false,saveError=null;const record=[];
    try{
      const nativeTasks=[],serialTasks=[];
      for(const task of tasks){
        if(ui!==current||current.epoch!==epoch||key()!==scope)break;
        let r=catalog.get(task.id);
        // A collapsed Vue group can omit its native row until expanded.
        if(batch&&r&&!node(r)&&r.group){r=await ensureRow(task.id)||r;catalog.set(task.id,r);if(ui!==current||current.epoch!==epoch||key()!==scope)break;if(!node(r)){failed++;continue;}}
        (batch&&!node(r)?.closest('.bai-bai-preset-vue-list-host')?nativeTasks:serialTasks).push(task);
      }
      current.batchPath=batch?(serialTasks.length?(nativeTasks.length?'bai+native':'bai'):'native'):'serial';
      current.actionRows=new Set(serialTasks.map(task=>task.id));current.baiAction=serialTasks.length>0&&!!current.manager.querySelector('.bai-bai-preset-vue-list-host');
      if(serialTasks.length)paint();
      if(batch&&serialTasks.length){
        const prepared=[],attempted=[];
        for(const task of serialTasks){
          if(ui!==current||current.epoch!==epoch||key()!==scope||!current.panel.classList.contains('openDrawer')||current.panel.classList.contains('cw-v4-inactive'))break;
          const r=await ensureRow(task.id),desired=undo?task.before:task.after;
          if(ui!==current||current.epoch!==epoch||key()!==scope)break;
          if(!r||!allowed(r)){failed++;continue;}
          const before=on(r);
          if(undo&&(task.conflict||before!==task.after)){skipped++;continue;}
          if(before===desired){skipped++;continue;}
          prepared.push({r,id:task.id,before,after:desired,mounted:true});
        }
        // Each click goes through Vue's own visible control. Let Vue coalesce its
        // redraw, then confirm the entire result instead of repainting per item.
        let sliceStarted=win.performance.now();for(const [index,item]of prepared.entries()){
          if(ui!==current||current.epoch!==epoch||key()!==scope||!current.panel.classList.contains('openDrawer')||current.panel.classList.contains('cw-v4-inactive'))break;
          const r=node(item.r)?.isConnected?item.r:find(item.id),control=toggle(r);
          if(!control||!allowed(r)||node(r).hidden||node(r).closest('.bai-bai-preset-group-collapsed')){failed++;continue;}
          try{current.nativeAction=control;control.click();attempted.push({id:item.id,before:item.before,after:item.after,mounted:true});}finally{current.nativeAction=null;}
          if(index+1<prepared.length&&win.performance.now()-sliceStarted>=8){await new Promise(resolve=>win.setTimeout(resolve,0));sliceStarted=win.performance.now();}
        }
        if(attempted.length&&ui===current&&current.epoch===epoch&&key()===scope){
          const confirmation=confirmBatch(current,epoch,scope,attempted,batch.pm);
          try{pending=!await confirmation.promise;}finally{confirmation.cancel();}
          for(const item of attempted){const entry=batch.pm.getPromptOrderEntry(batch.pm.activeCharacter,item.id);if(entry?.enabled===item.after){changed++;record.push(item);}else failed++;}
        }
      }else for(const task of serialTasks){
        if(ui!==current||ui.epoch!==epoch||key()!==scope||!current.panel.classList.contains('openDrawer')||current.panel.classList.contains('cw-v4-inactive'))break;
        const r=find(task.id),desired=undo?task.before:task.after;
        if(!r||!allowed(r)){failed++;continue;}
        if(undo&&(task.conflict||on(r)!==task.after)){skipped++;continue;}
        if(on(r)===desired){skipped++;continue;}
        const before=on(r),success=await setOne(task.id,desired,epoch);
        if(ui!==current||ui.epoch!==epoch||key()!==scope)break;
        if(success){changed++;record.push({id:task.id,before,after:desired});}else failed++;
        processed=changed+skipped+failed;text(ui.message,t(`已处理 ${processed} / ${tasks.length} 条…`,`Processed ${processed} / ${tasks.length} prompts…`));
        await new Promise(resolve=>win.setTimeout(resolve,0));
      }
      if(batch&&nativeTasks.length&&ui===current&&current.epoch===epoch&&key()===scope&&(!serialTasks.length||current.panel.classList.contains('openDrawer')&&!current.panel.classList.contains('cw-v4-inactive'))){
        const {pm,counts}=batch,nativeRecord=[],nativeCatalog=serialTasks.length?new Map(entries().map(e=>[id(e),e])):catalog;
        // Native-owned entries still change in one synchronous turn, after Vue clicks.
        for(const task of nativeTasks){
          const r=nativeCatalog.get(task.id),entry=pm.getPromptOrderEntry(pm.activeCharacter,task.id),desired=undo?task.before:task.after;
          if(!r||!entry||!allowed(r)){failed++;continue;}
          const before=entry.enabled!==false;
          if(undo&&(task.conflict||before!==task.after)){skipped++;continue;}
          if(before===desired){skipped++;continue;}
          entry.enabled=desired;counts[task.id]=null;changed++;const item={id:task.id,before,after:desired,mounted:!!node(r)};nativeRecord.push(item);record.push(item);
        }
        if(nativeRecord.length){
          const confirmation=confirmBatch(current,epoch,scope,nativeRecord,pm);
          try{pm.render();const saved=await deadline(pm.saveServiceSettings(),10000);saveError=saved.error||null;pending=!!saved.timeout||!await confirmation.promise;}finally{confirmation.cancel();}
        }
      }
    }catch(error){saveError=error;current.batchError=String(error?.message||error);}
    finally{
      if(ui===current){ui.busy=false;delete ui.actionRows;delete ui.baiAction;if(epoch===ui.epoch&&key()===scope){restoreGroups(current);ui.undo=!undo&&record.length?record:null;const suffix=saveError?t(' 数据已改，但原生渲染或保存失败，请检查后重试。',' Data changed, but native rendering or saving failed; check before retrying.'):pending?t(' 已改，列表还在刷新。',' Changed; the list is still refreshing.'):'';text(ui.message,t(`${undo?'撤销：':''}已改变 ${changed} 条，跳过 ${skipped} 条，失败 ${failed} 条。沿用酒馆原生保存。`,`${changed} changed, ${skipped} skipped, ${failed} failed. Uses native saving.`)+suffix);}paint();}
    }
  }
  function mount(panel){
    const manager=panel.querySelector('#completion_prompt_manager');if(!manager)return;
    if(ui?.manager===manager){paint();return;}destroy();
    const tabBar=make('div','cw-pm-tabs'),tools=make('div','cw-pm-tools'),filters=make('div','cw-pm-filters'),selectionLine=make('div','cw-pm-selection-line'),batch=make('div','cw-pm-batch'),feedback=make('div','cw-pm-feedback'),bottom=make('div','cw-pm-bottom');
    tabBar.setAttribute('role','tablist');tabBar.setAttribute('aria-label',t('预设内容','Preset content'));
    const search=make('input','cw-pm-search');search.type='search';search.placeholder=t('搜索提示词名称','Search prompt names');search.setAttribute('aria-label',search.placeholder);
    const btn=(label,fn)=>button(label,fn,'cw-v4-button');
    const multiButton=btn(t('多选','Select'),()=>{ui.multi=!ui.multi;ui.sort=false;ui.selected.clear();ui.frozen=null;paint();});
    const sortButton=btn(t('调整顺序','Reorder'),()=>{ui.sort=!ui.sort;if(ui.sort){ui.search.value='';ui.filter='all';ui.frozen=null;}paint();});
    const count=make('span','cw-pm-count'),selection=make('span','cw-pm-selection'),message=make('span','');feedback.setAttribute('role','status');
    const allButton=btn(t('全选当前结果','Select current results'),()=>{for(const r of entries())if(ui.visible.includes(id(r))&&allowed(r))ui.selected.add(id(r));paint();});
    const clear=btn(t('清除选择','Clear selection'),()=>{ui.selected.clear();paint();});
    const enable=btn(t('启用选中','Enable selected'),()=>run(true)),disable=btn(t('停用选中','Disable selected'),()=>run(false)),undoButton=btn(t('撤销','Undo'),()=>run(false,true));
    tools.append(search,multiButton,sortButton);selectionLine.append(allButton,clear);batch.append(selection,enable,disable);feedback.append(message,undoButton);bottom.append(batch,feedback);
    const empty=make('p','cw-pm-empty',t('没有匹配的提示词','No matching prompts'));
    ui={panel,manager,tabBar,tools,filterLine:filters,count,search,multiButton,sortButton,selectionLine,batch,feedback,bottom,empty,selection,message,allButton,clear,enable,disable,undoButton,filters:[],selected:new Set(),lastStates:new Map(),filter:'all',multi:false,sort:false,busy:false,undo:null,frozen:null,anchor:null,context:key(),epoch:0,dispose:[],tab:'prompts',positions:{prompts:0,params:0},sortables:new Map(),expanded:new Map(),expanding:new Set(),hidden:new WeakMap(),hiddenRefs:new Set(),rangeVisible:[],nativePM:null,dragging:false};
    const u=ui;
    // Keep fragment-staged nodes restorable without retaining replaced trees.
    // Finalization removes dead wrappers without repeatedly dereferencing live ones.
    u.hiddenFinalizer=new win.FinalizationRegistry(ref=>u.hiddenRefs.delete(ref));
    import(new win.URL('/scripts/openai.js',win.location.href).href).then(m=>{if(ui===u){u.nativePM=m.promptManager;paint();}}).catch(()=>{});
    for(const [value,label] of [['all',t('全部','All')],['on',t('已启用','Enabled')],['off',t('已停用','Disabled')]]){const b=btn(label,()=>{ui.filter=value;ui.frozen=null;ui.sort=false;paint();});b.dataset.filter=value;u.filters.push(b);filters.append(b);}filters.append(count);
    const scroll=()=>{if(u.tab==='prompts')return manager.querySelector('#completion_prompt_manager_list')||panel;for(let n=manager.parentElement;n;n=n.parentElement)if(/auto|scroll/.test(win.getComputedStyle(n).overflowY))return n;return panel;};
    const tabs=[];
    for(const [value,label] of [['prompts',t('提示词','Prompts')],['params',t('参数','Parameters')]]){const b=btn(label,()=>{u.positions[u.tab]=scroll().scrollTop;u.tab=value;panel.dataset.cwPresetTab=value;for(const el of tabs)attr(el,'aria-selected',el.dataset.tab===value);scroll().scrollTop=u.positions[value];});b.setAttribute('role','tab');b.dataset.tab=value;attr(b,'aria-selected',value==='prompts');tabs.push(b);tabBar.append(b);}
    const preset=panel.querySelector('#openai_api-presets .cw-v4-section');(preset||panel.querySelector(':scope>.cw-v4-drawer-page')).append(tabBar);
    manager.prepend(tools,filters,selectionLine);manager.append(empty,bottom);panel.dataset.cwPresetTab='prompts';manager.classList.add('cw-pm-list');
    const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);u.dispose.push(()=>node.removeEventListener(type,fn,options));};
    listen(search,'input',()=>{u.frozen=null;u.sort=false;paint();});
    listen(manager,'click',e=>{
      const r=e.target.closest('[data-pm-identifier]');if(!canonical(r))return;
      if(e.target===u.nativeAction)return;
      if(e.target.closest('.prompt-manager-toggle-action')&&u.undo)for(const task of u.undo)if(task.id===id(r))task.conflict=true;
      if(u.busy){e.preventDefault();e.stopImmediatePropagation();return;}
      if(u.multi){if(!e.target.matches('.cw-pm-select'))e.preventDefault();e.stopImmediatePropagation();select(r,e.shiftKey);return;}
      const name=e.target.closest('.completion_prompt_manager_prompt_name');
      // The native inspect action is also invoked by the row's More menu.
      // Let that explicit programmatic action reach its original listener.
      if(!e.isTrusted&&e.target.matches('.prompt-manager-inspect-action'))return;
      if(name&&!e.target.closest('.prompt-manager-injection-depth,.prompt-manager-overridden')){const native=r.querySelector('.prompt-manager-edit-action')||r.querySelector('.prompt-manager-inspect-action');if(native&&native!==e.target){e.preventDefault();e.stopImmediatePropagation();native.click();}}
    },true);
    for(const type of ['pointerdown','touchstart','mousedown'])listen(manager,type,e=>{if((!u.sort||u.multi||u.busy||u.search.value.trim()||u.filter!=='all')&&e.target.closest?.('.bai-bai-preset-group-header')&&!e.target.closest('button,input,select,a,.menu_button'))e.stopPropagation();},{capture:true,passive:true});
    for(const type of ['start','sortstart'])listen(manager,type,()=>{u.dragging=true;});for(const type of ['end','sortstop'])listen(manager,type,()=>{u.dragging=false;paint();});
    listen(manager,'keydown',e=>{const r=e.target.closest('[data-pm-identifier]');if(r&&e.target.matches('.prompt-manager-toggle-action,.completion_prompt_manager_prompt_name')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();}});
    listen(panel,'change',e=>{if(e.target.id==='settings_preset_openai')reset();});
    const ctx=win.SillyTavern?.getContext?.();for(const name of ['CHAT_CHANGED','CHAT_LOADED','OAI_PRESET_CHANGED_BEFORE','OAI_PRESET_CHANGED_AFTER']){const type=ctx?.eventTypes?.[name];if(type&&ctx.eventSource?.on){const fn=()=>reset();ctx.eventSource.on(type,fn);u.dispose.push(()=>ctx.eventSource.removeListener(type,fn));}}
    // Native row events are installed by PromptManager before our existing adapter.
    let pruneTimer,paintFrame=0;
    const queuePaint=()=>{if(paintFrame||ui!==u)return;paintFrame=win.requestAnimationFrame(()=>{paintFrame=0;if(ui===u)paint();});};
    u.queuePaint=queuePaint;for(const type of ['focusin','focusout'])listen(manager,type,e=>{if(e.target.closest?.(ROW))queuePaint();});
    let panelActive=panel.classList.contains('openDrawer')&&!panel.classList.contains('cw-v4-inactive');const panelObserver=new win.MutationObserver(()=>{const active=panel.classList.contains('openDrawer')&&!panel.classList.contains('cw-v4-inactive');if(active!==panelActive){panelActive=active;if(active)queuePaint();else{delete panel.dataset.cwPresetTab;clearVisibleControls(u);}}});panelObserver.observe(panel,{attributes:true,attributeFilter:['class']});u.dispose.push(()=>panelObserver.disconnect());
    const owned=n=>{const e=n.nodeType===1?n:n.parentElement;return !!e&&(u.tools.contains(e)||u.filterLine.contains(e)||u.selectionLine.contains(e)||u.bottom.contains(e)||e.matches('.cw-pm-select,.cw-pm-number,.cw-pm-state')||!!e.closest('.cw-pm-number,.cw-pm-state'));};
    const ownMutation=r=>{if(r.type==='attributes'){const old=new Set((r.oldValue||'').split(/\s+/).filter(Boolean)),now=new Set(r.target.classList);const changed=[...[...old].filter(k=>!now.has(k)),...[...now].filter(k=>!old.has(k))];return changed.every(k=>k.startsWith('cw-pm-'));}return owned(r.target)||[...r.addedNodes,...r.removedNodes].every(owned);};
    const observer=new win.MutationObserver(records=>{if(records.every(ownMutation))return;queuePaint();win.clearTimeout(pruneTimer);pruneTimer=win.setTimeout(()=>{if(ui!==u||u.busy)return;const current=new Set(entries().map(id));for(const k of u.selected)if(!current.has(k))u.selected.delete(k);queuePaint();},200);});observer.observe(manager,{childList:true,subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});u.dispose.push(()=>{observer.disconnect();win.clearTimeout(pruneTimer);if(paintFrame)win.cancelAnimationFrame(paintFrame);});
    paint();
  }
  function destroy(){if(!ui)return;const u=ui;clearVisibleControls(u);ui=null;u.epoch++;u.dispose.forEach(f=>f());
    restoreGroups(u);for(const e of u.sortables.values())restoreSort(e);
    for(const n of [u.tabBar,u.tools,u.count.parentElement,u.selectionLine,u.bottom,u.empty])n.remove();u.manager.removeAttribute('aria-busy');
    delete u.panel.dataset.cwPresetTab;u.manager.classList.remove('cw-pm-list','cw-pm-multi','cw-pm-sort','cw-pm-busy','cw-pm-filtering');
    // Restore live nodes even while native TT holds them outside the manager.
    for(const r of hiddenNodes(u)){if(u.hidden.has(r))r.hidden=u.hidden.get(r);if(!r.matches('.cw-pm-row'))continue;r.classList.remove('cw-pm-selected','cw-pm-row','cw-pm-native-row');r.querySelectorAll('.cw-pm-select,.cw-pm-number,.cw-pm-state').forEach(n=>n.remove());const name=r.querySelector('.completion_prompt_manager_prompt_name');name?.removeAttribute('role');name?.removeAttribute('tabindex');}
    for(const ref of u.hiddenRefs)u.hiddenFinalizer.unregister(ref);u.hiddenRefs.clear();
  }
  return {mount,destroy};
}
