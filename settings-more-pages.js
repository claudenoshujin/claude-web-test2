/* Presentation adapters. Native nodes, handlers, lists and provider ancestors remain live. */
export function createMorePages(h) {
  const {win,make,button,icon,get,move,cleanup,created,state,act,menu,setting,t,L}=h,doc=win.document;
  function characters(panel){
    const page=panel.querySelector('#rm_characters_block>.cw-v4-drawer-page');if(!page)return;
    const s=state(page);
    if(!s.morePages){s.morePages=true;const head=created(s,make('div','cwr-list-head')),actions=make('div','cwr-list-actions');head.append(make('h2','',L('角色卡')),actions);page.prepend(head);
      for(const [id,label,primary]of [['character_import_button','导入',false],['rm_button_create','新建角色',true]]){const n=get(id);if(n){if(!n.querySelector('.cw-v4-action-label'))act(s,n,label,primary,primary);if(primary&&!n.classList.contains('cw-v4-primary')){n.classList.add('cw-v4-primary');cleanup(s,()=>n.classList.remove('cw-v4-primary'));}move(s,n,actions);}}
      const old=page.querySelector('.cw-v4-desk-only .cw-v4-more');if(old)move(s,old,actions);
      const all=page.querySelector('.cw-v4-chatlist'),bar=all?.querySelector('.cw-v4-bar'),tags=all?.querySelector('.cw-v4-tags');if(bar)move(s,bar,page,all);if(tags)move(s,tags,page,all);
      const list=get('rm_print_characters_block'),pager=get('rm_print_characters_pagination');if(list&&pager)move(s,pager,list.parentElement,list.nextSibling);
      const bottom=created(s,make('div','cwr-character-bottom'));bottom.append(button(L('＋ 新建角色'),()=>get('rm_button_create')?.click(),'cw-v4-button'),button(L('导入'),()=>get('character_import_button')?.click(),'cw-v4-button'),menu(s,[['新建群聊',null,false,()=>get('rm_button_group_chats')?.click()],['从网址导入',null,false,()=>get('external_import_button')?.click()],['批量编辑',null,false,()=>get('bulkEditButton')?.click()],['管理标签',null,false,()=>page.querySelector('.manageTags')?.click()]]));page.append(bottom);
    }
    for(const tag of page.querySelectorAll('.cw-v4-tags .tag.actionable')){if(tag.querySelector('.cwr-filter-label'))continue;const labels={filterByFavorites:'收藏',filterByGroups:'群组',filterByFolder:'文件夹',manageTags:'管理标签',showTagList:'标签',clearAllFilters:'清除筛选'};const label=Object.keys(labels).find(k=>tag.classList.contains(k));if(label){const span=created(s,make('span','cwr-filter-label',L(labels[label])));tag.append(span);}}
    for(const card of page.querySelectorAll('.character_select,.group_select')){const star=card.querySelector('.ch_fav_icon,.group_fav_icon'),name=card.querySelector('.character_name_block');if(star&&name&&star.parentElement!==name)move(state(card),star,name);}
  }
  function backgrounds(panel){
    const page=panel.querySelector(':scope>.cw-v4-drawer-page');if(!page)return;const s=state(page);
    if(!s.morePages){s.morePages=true;const first=page.querySelector('.cw-v4-section'),r=first?.querySelector('.cw-v4-row'),head=created(s,make('div','cwr-list-head')),actions=make('div','cwr-list-actions');head.append(make('h2','',L('背景')),actions);if(r){for(const n of [...r.querySelector('.cw-v4-row-controls').children])move(s,n,actions);r.hidden=true;}page.prepend(head);
      const tabs=get('bg_tabs'),bar=page.querySelector('.cw-v4-bar');if(tabs&&bar){move(s,bar,tabs,tabs.querySelector('.bg_tabs_list')?.nextSibling);bar.classList.add('cwr-bg-search');cleanup(s,()=>bar.classList.remove('cwr-bg-search'));}
    }
    for(const tile of panel.querySelectorAll('.bg_example')){const ts=state(tile),title=tile.querySelector('.thumbnail-clipper>.BGSampleTitle');if(title)move(ts,title,tile);}
  }
  function api(panel){
    const connect=get('api_button_openai'),connection=connect?.closest('.cw-v4-section'),ps=state(panel);
    if(connection&&!ps.moreApi){ps.moreApi=true;for(const [id,label,desc]of [['openai_bypass_status_check','绕过 API 状态检查','接口不支持状态检查时打开'],['openai_show_external_models','显示外部模型','由 API 提供']])setting(ps,connection,id,label,desc);
      const info=connect.closest('.cw-v4-row')?.querySelector('.cw-v4-row-info'),status=info?.querySelector('.online_status')||get('openai_api')?.querySelector(':scope>.online_status');if(status&&info){if(!info.contains(status))move(ps,status,info);info.querySelector('.cw-v4-row-title')?.setAttribute('hidden','');}
      const extra=get('customize_additional_parameters'),more=connect.closest('.cw-v4-row')?.querySelector('.cw-v4-more');if(extra&&more){const item=created(ps,button(L('附加参数'),()=>{more.open=false;extra.click();},'cw-v4-more-item'));more.querySelector('.cw-v4-more-list').prepend(item);move(ps,extra,more.querySelector('.cw-v4-more-park'));}
    }
    for(const row of panel.querySelectorAll('.cw-v4-api-row,.cw-v4-api-inline-row')){
      if(!row.classList.contains('cwr-api-field')&&(row.querySelector('input:not([type=checkbox]):not([type=hidden]),textarea')||row.querySelector('select[id*="model"]'))){row.classList.add('cwr-api-field');cleanup(state(row),()=>row.classList.remove('cwr-api-field'));}
      const label=row.querySelector('.cw-v4-api-label'),steps=label?.querySelector('ol');if(steps&&!row.querySelector('.cwr-api-help')){const s=state(row),details=created(s,make('details','cwr-api-help')),summary=make('summary','',L('获取密钥说明'));details.append(summary);move(s,steps,details);label.append(details);}
    }
    const row=connect?.closest('.cw-v4-row');if(row){const model=doc.querySelector('#model_openai_select,#custom_model_id'),status=row.querySelector('.cw-v4-row-info');let info=status?.querySelector('.cwr-connection-model');if(status&&!info){info=created(state(row),make('p','cwr-connection-model'));status.append(info);}if(info){const selected=[...panel.querySelectorAll('select[id*="model"],input[id*="model"]')].find(n=>n.checkVisibility?.());const value=selected?.selectedOptions?.[0]?.textContent||selected?.value||model?.value||'';if(info.textContent!==value)info.textContent=value;}}
  }
  return {sync(panel){if(panel.id==='right-nav-panel')characters(panel);if(panel.id==='Backgrounds')backgrounds(panel);if(panel.id==='rm_api_block')api(panel);}};
}
