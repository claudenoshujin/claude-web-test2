/* Device-local discovery markers; no server settings or business data. */
export function newFeature({win,make,t},key) {
  const storage='claude-web:seen-new';
  const read=()=>{try{const list=JSON.parse(win.localStorage.getItem(storage)||'[]');return Array.isArray(list)?list.filter(x=>typeof x==='string'):[];}catch{return [];}};
  const badge=make('span','new cw-new',t('新','New'));
  badge.hidden=read().includes(key);
  const seen=()=>{const list=read();if(!list.includes(key)){list.push(key);win.localStorage.setItem(storage,JSON.stringify(list));}badge.hidden=true;};
  return {badge,seen};
}
