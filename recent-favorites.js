import { preferencesFor } from './preferences.js?v=2.0.330';
// S02 prerequisite: only the favorite record contract from formal chat-tools.
// Other message tools remain outside this integration.
export function installRecentFavorites({win,doc,getContext,enabled,onChange}) {
  const prefs=preferencesFor(win),bare=f=>String(f??'').replace(/\.jsonl$/i,''),key=r=>JSON.stringify([r.group?'group':'character',String(r.group||r.avatar||''),bare(r.file_name??r.file)]);
  let destroyed=false,userHandle=null,lastEnabled=null,eventSource=null;const subs=[],deletedNames=new Set();
  const storageKey=()=> 'claude-web:chat-tools:'+userHandle()+':favorites';
  const visual=()=>!destroyed&&!!userHandle&&enabled()&&prefs.getItem('claude-web:chat-tools')!=='off'&&doc.documentElement.hasAttribute('data-cw-v4')&&doc.documentElement.dataset.claudeUi!=='classic';
  const records=()=>{try{const value=JSON.parse(prefs.getItem(storageKey())||'[]');return Array.isArray(value)?value.filter(r=>r&&typeof r==='object'&&typeof r.file_name==='string'):[]}catch{return []}};
  const write=value=>{try{prefs.setItem(storageKey(),JSON.stringify(value));return true}catch{win.toastr?.error?.('无法保存，浏览器本地存储不可用或已满。');return false}};
  function subscribe(){const c=getContext();if(!c?.eventSource||eventSource===c.eventSource)return;for(const stop of subs.splice(0))stop();eventSource=c.eventSource;const on=(name,fn)=>{const event=c.event_types?.[name];if(!event)return;eventSource.on(event,fn);const source=eventSource;subs.push(()=>source.removeListener?.(event,fn))};
    on('CHAT_RENAMED',data=>{if(!data||!userHandle)return;const old={avatar:data.avatarId||'',group:data.groupId||'',file_name:data.oldFileName},oldKey=key(old),all=records();if(all.some(r=>key(r)===oldKey))write(all.map(r=>key(r)===oldKey?{...r,file_name:bare(data.newFileName)+'.jsonl'}:r));onChange()});
    for(const name of ['CHAT_DELETED','GROUP_CHAT_DELETED'])on(name,file=>{if(typeof file==='string')deletedNames.add(bare(file));onChange()});
  }
  function sync(){if(destroyed)return;subscribe();const on=visual();if(on!==lastEnabled){lastEnabled=on;onChange()}}
  const ready=import('/scripts/user.js').then(m=>{if(destroyed)return;if(typeof m.getCurrentUserHandle!=='function')throw Error('宿主缺少用户标识接口');userHandle=m.getCurrentUserHandle;sync()}).catch(error=>{if(!destroyed)win.console.warn('[CW] 收藏筛选未启用',error)});
  return {ready,sync,isEnabled:visual,isFavorite:r=>visual()&&records().some(x=>key(x)===key(r)),favoriteRecords:()=>visual()?records():[],toggleFavorite(r){if(!visual())return false;const all=records(),k=key(r),has=all.some(x=>key(x)===k);if(!write(has?all.filter(x=>key(x)!==k):[...all,{group:r.group||'',avatar:r.avatar||'',file_name:bare(r.file_name)+'.jsonl'}]))return false;onChange();return true},removeChat(r){if(!userHandle)return;const all=records(),kept=all.filter(x=>key(x)!==key(r));if(all.length!==kept.length)write(kept);onChange()},reconcileFavorites(live,requested){if(!userHandle)return;const wanted=new Set(requested.map(key)),exists=new Set(live.map(key)),all=records(),kept=all.filter(r=>!deletedNames.has(bare(r.file_name))||!wanted.has(key(r))||exists.has(key(r)));if(kept.length!==all.length)write(kept);for(const r of requested)deletedNames.delete(bare(r.file_name))},destroy(){destroyed=true;for(const stop of subs.splice(0))stop();eventSource=null;}};
}
