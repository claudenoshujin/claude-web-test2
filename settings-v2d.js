/* 设置页 v2d 版式（稿 界面优化与新功能-20261103/design-settings-pages-v2d.html）。
   只搬节点、加容器、改顺序：原生控件、它们的事件和原生的显示开关（style.display / hidden）都不动。
   每次搬动都记在抽屉的 state 里（move / created / cleanup），关掉 CW 时由 official-drawers.js 的 restore() 原样还回去。
   样式在 styles/settings-v2d.css（.cw2 开头）。 */
export function createV2dPages(h) {
  const {win,make,button,get,move,cleanup,created,state,menu,row,t,L}=h,doc=win.document;
  const mark=(s,n,...c)=>{if(!n)return n;const add=c.filter(x=>!n.classList.contains(x));if(add.length){n.classList.add(...add);cleanup(s,()=>n.classList.remove(...add));}return n;};
  const hide=(s,n)=>{if(!n||n.hidden)return;n.hidden=true;cleanup(s,()=>{n.hidden=false;});};
  const relabel=(s,n,text)=>{if(!n||n.textContent===text)return;const old=n.textContent;n.textContent=text;cleanup(s,()=>{n.textContent=old;});};
  const sec=(s,host,title,cls='',before=null)=>{const n=created(s,make('section','cw-v4-section'+(cls?' '+cls:'')));if(title)n.append(make('h2','',L(title)));n.append(make('div','cw-v4-card'));host.insertBefore(n,before);return n;};
  const cols=(s,host,before,cls='')=>{const g=created(s,make('div','cw2-cols'+(cls?' '+cls:''))),l=make('div','cw2-col'),r=make('div','cw2-col');g.append(l,r);host.insertBefore(g,before||null);return [l,r];};
  const card=n=>n.querySelector(':scope>.cw-v4-card');
  // 说明只占一行（G5），鼠标停上去看全文。
  const polish=root=>{for(const p of root.querySelectorAll('.cw-v4-row-info>p,.cw-v4-row-info>.cw-v4-row-desc'))if(!p.title&&p.textContent.trim())p.title=p.textContent.trim();};

  /* 第 2 节 API 连接：标题行（配置下拉 / 保存 / ⋯）→ 连接状态通栏卡 → 两栏 1.5 : 1（接口与来源 | 连接选项 + 更多）。 */
  function api(panel){
    const ps=state(panel);if(ps.v2d)return;
    const page=panel.querySelector(':scope>.cw-v4-drawer-page'),connect=get('api_button_openai'),statusRow=connect?.closest('.cw-v4-row'),profiles=get('connection_profiles'),main=get('main_api');
    // 等 official-drawers / settings-more-pages 先把行建好（状态行里要已经有 .online_status）。
    if(!page||!statusRow||!profiles||!main||!statusRow.querySelector('.online_status'))return;
    ps.v2d=true;mark(ps,panel,'cw2','cw2-api');
    const profileSec=profiles.closest('.cw-v4-section'),apiSec=main.closest('.cw-v4-section'),connSec=statusRow.closest('.cw-v4-section'),source=get('openai_api');
    // A1/A2 标题行：标题 / 配置下拉 300 / 保存 / ⋯（新建进 ⋯ 第一项）/ 灰色说明。手机：内容区第一行，下拉占满。
    const bar=created(ps,make('div','cw2-bar cw2-mbar'));bar.append(make('h2','',L('API 连接')));page.prepend(bar);
    move(ps,profiles,bar);move(ps,get('update_connection_profile'),bar);
    const pm=menu(ps,[['新建配置',get('create_connection_profile'),false,null,'plus'],['查看详情',get('view_connection_profile'),false,null,'eye'],['编辑',get('edit_connection_profile'),false,null,'pencil'],['重新载入',get('reload_connection_profile'),false,null,'refresh'],'-',['删除这个配置',get('delete_connection_profile'),true,null,'trash']]);
    pm.classList.add('cw2-sheet');pm.cw2Title=()=>profiles.selectedOptions?.[0]?.textContent||'';bar.append(pm);
    bar.append(make('span','cw2-note',t('连接配置：保存一整套接口、模型和预设','Connection profile: saves the API, model and preset together')));
    hide(ps,profileSec);
    // A3 连接状态：通栏卡。右边 测试消息 / 连接（主按钮）/ ⋯；附加参数挪到「更多」。
    const stat=sec(ps,page,'','cw2-stat',bar.nextSibling);move(ps,statusRow,stat);
    const controls=statusRow.querySelector('.cw-v4-row-controls'),test=get('test_api_button');if(controls&&test&&controls.contains(connect))move(ps,test,controls,connect);
    for(const it of statusRow.querySelectorAll('.cw-v4-more-item'))if(it.textContent.trim()===L('附加参数'))hide(ps,it);
    // 绿点只在真正连上时显示。酒馆原生只要状态不是「无连接」就加 success（绿点），连「无效的端点 URL。请求可能失败。」
    // 「已跳过状态检查」这类警告也亮。这里认出这几句警告，给点加 cw2-warn，CSS 藏掉（稿里没有别的颜色，就不显示点）。
    const WARN=/Invalid (Azure )?endpoint URL|无效的( Azure)? ?端点 URL|Status check bypassed|已跳过状态检查/i;
    const dotText=statusRow.querySelector('.online_status_text'),dot=statusRow.querySelector('.online_status_indicator');
    if(dotText&&dot){const paintDot=()=>{const warn=WARN.test(dotText.textContent||'');if(dot.classList.contains('cw2-warn')!==warn)dot.classList.toggle('cw2-warn',warn);};
      const dmo=new win.MutationObserver(paintDot);dmo.observe(dotText,{childList:true,characterData:true,subtree:true});paintDot();cleanup(ps,()=>{dmo.disconnect();dot.classList.remove('cw2-warn');});}
    const statMenu=statusRow.querySelector('.cw-v4-more');if(statMenu)mark(ps,statMenu,'cw2-stat-more');
    // A4–A6 两栏。
    const [left,right]=cols(ps,page,stat.nextSibling,'cw2-w64 cw2-stretch');
    move(ps,apiSec,left);mark(ps,apiSec,'cw2-grow','cw2-src');relabel(ps,apiSec.querySelector(':scope>h2'),L('接口与来源'));
    mark(ps,main.closest('.cw-v4-row'),'cw2-main');
    const opts=sec(ps,right,'连接选项','cw2-opts');
    const auto=get('auto-connect-checkbox')?.closest('.cw-v4-row');if(auto)move(ps,auto,opts);
    for(const id of ['openai_bypass_status_check','openai_show_external_models']){const r=get(id)?.closest('.cw-v4-mapped-setting');if(r){move(ps,r,opts);mark(ps,r,'cw2-cc');}}
    const ppp=get('prompt_post_processing_form');if(ppp){move(ps,ppp,opts);mark(ps,ppp,'cw2-cc');mark(ps,get('custom_prompt_post_processing'),'cw2-short');}
    const more=sec(ps,right,'更多','cw2-more');
    const proxySec=source&&[...source.querySelectorAll(':scope>.cw-v4-section')].find(n=>n.querySelector('.inline-drawer'));
    const proxyRow=proxySec?.querySelector('.cw-v4-row');if(proxyRow){move(ps,proxyRow,more);mark(ps,proxyRow,'cw2-cc');hide(ps,proxySec);}
    const warn=get('ReverseProxyWarningMessage');if(warn){move(ps,warn,more);mark(ps,warn,'cw2-cc');}
    const extra=get('customize_additional_parameters');
    if(extra){const r=row(ps,more,'附加参数','请求体和请求头里额外带的内容',[button(L('编辑'),()=>extra.click(),'cw-v4-button')]);mark(ps,r,'cw2-cc');}
    if(connSec&&!card(connSec)?.querySelector('.cw-v4-row:not([hidden])'))hide(ps,connSec);
    polish(page);
  }

  return {sync(panel){if(!doc.documentElement.hasAttribute('data-cw-settings-unified'))return;if(panel.id==='rm_api_block')api(panel);}};
}
