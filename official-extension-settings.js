/* 2.0.266 扩展设置页（照 design-phone-ext-v1.html，Lulu 2026-10-03 认可）。
 * 打开扩展「配置」时画一张自己的页面：小标题 + 白卡片 + 一行一项。酒馆原来的开关、下拉、输入框、
 * 文本框、滑杆整个搬进行里（事件、ID 都不变）；按钮不搬，画一行代它点。关掉时全部搬回原处。
 * 原来的外层还在原处（藏着），酒馆按来源 / 开关显示隐藏的那些块，用 gates 同步到我们的行上。
 * 2.0.264–265 是在酒馆排版上直接套样式，扩展之间结构差太多，排不齐，这一版换成重画。 */
export function createExtensionSettings({win,t,L,make,button,icon,openEditor}) {
  const doc=win.document, sessions=new Set(), popups=new Map();
  const FIELD='input:not([type=hidden]):not([type=file]),select,textarea';
  const CONTROL='input:not([type=hidden]):not([type=file]),select,textarea,button,.menu_button,.right_menu_button,toolcool-color-picker';
  const clean=s=>(s||'').replace(/\s+/g,' ').replace(/[:：]\s*$/,'').trim();
  function textOf(n){if(!n)return '';const c=n.cloneNode(true);c.querySelectorAll('input,select,textarea,button,.menu_button,.right_menu_button,i,svg,a.notes-link,.note-link-span,.fa-solid,.fa-regular,.drag-handle,.qr--labelHint,[id$=_output],[id$=_value],.memory_disabled_hint').forEach(x=>x.remove());return clean(c.textContent);}
  const esc=s=>win.CSS?.escape?win.CSS.escape(s):String(s).replace(/["\\]/g,'\\$&');
  const hiddenSelf=n=>n.hidden||n.style.display==='none'||n.classList.contains('displayNone');
  const shown=n=>!!n&&!hiddenSelf(n);

  /* ---------- 会话：记下搬动和新建的东西，关的时候还原 ---------- */
  function session(root,plan){
    const s={root,plan,moves:[],created:[],undo:[],units:[],rows:[],secs:[],page:null,observer:null,frame:0};
    sessions.add(s);return s;
  }
  function move(s,n,host,before){
    if(!n||n===host||n.contains(host))return;
    const companion=n.matches?.('select.select2-hidden-accessible')&&n.nextElementSibling?.matches('.select2-container')?n.nextElementSibling:null;
    const mark=doc.createComment('cwx-return');n.before(mark);s.moves.push([n,mark]);
    before?host.insertBefore(n,before):host.append(n);if(companion)move(s,companion,host);
  }
  const add=(s,n)=>{s.created.push(n);return n;};
  function teardown(s){
    for(const f of s.undo.splice(0).reverse())f();
    // 酒馆重画过的块（tts 服务商设置等）原处的标记已经没了，搬出来的旧控件直接丢掉。
    for(const [n,mark] of s.moves.splice(0).reverse()){if(mark.parentNode)mark.replaceWith(n);else n.remove();}
    for(const n of s.created.splice(0))n.remove();
    s.units=[];s.rows=[];s.secs=[];s.page=null;s.restSec=null;
  }
  function close(s){
    if(s.closed)return;s.closed=true;s.observer?.disconnect();win.cancelAnimationFrame(s.frame);
    teardown(s);s.root.classList.remove('cwx-host');sessions.delete(s);if(!sessions.size)watch.disconnect();
  }

  // 原处的外层：最外面那层被我们藏了，只看酒馆自己有没有藏它（行内 display / hidden / displayNone）；里面的看算出来的样式。
  function gatesOf(start,root){const gates=[];let top=null;for(let p=start;p&&p!==root;p=p.parentElement){if(p.parentElement===root)top=p;else if(!p.matches('.inline-drawer-content,.cwx-page'))gates.push(p);}return {gates,top};}

  /* ---------- 第一遍：认控件，给每个控件找标题 ---------- */
  function labelOf(c,content){
    const own=c.closest('label');
    if(own&&own!==c&&content.contains(own)&&!own.matches('.menu_button')){const tx=textOf(own);if(tx)return {title:tx,used:[own]};}
    const forLab=c.id&&content.querySelector(`label[for="${esc(c.id)}"]`);
    // 前面紧挨着的几段字：有 label[for] 就用它当标题；没有就是第一段。标题后面的是说明（label + small + select 这种）。
    for(let p=c,depth=0;p&&p!==content&&depth<3;p=p.parentElement,depth++){
      const texts=[];
      for(let x=p.previousElementSibling;x;x=x.previousElementSibling){
        if(x.matches('br'))continue;
        if(x.matches('hr,h1,h2,h3,h4,h5,.inline-drawer-header'))break;
        if(x!==forLab&&(x.matches(CONTROL)||x.querySelector(FIELD)))break; // 标题里带个「恢复默认」小按钮不算
        const tx=textOf(x);if(tx)texts.unshift([tx,x]);
        if(x===forLab)break;
      }
      if(texts.length)return {title:texts[0][0],desc:texts.slice(1).map(x=>x[0]).join(' '),used:texts.map(x=>x[1])};
      if(p.previousElementSibling&&!p.previousElementSibling.matches('br'))break;
    }
    if(forLab&&textOf(forLab))return {title:textOf(forLab),used:[forLab]};
    return {title:clean(c.getAttribute('aria-label')||c.title?.split('\n')[0]||c.placeholder||''),used:[]};
  }
  function actionLabel(b){
    if(/_restore$/.test(b.id))return L('恢复默认');
    const own=textOf(b)||clean(b.value||'');
    return own||clean((b.getAttribute('title')||b.getAttribute('aria-label')||'').split('\n')[0]);
  }
  const danger=b=>/delete|remove|purge|trash|clear|redWarning/i.test(b.id+' '+b.className)&&!/restore/i.test(b.id);
  function scan(s,content){
    const P=s.plan,units=[],byNode=new Map(),used=new Set(),taken=new WeakSet();
    const pick=(list)=>new Set((list||[]).flatMap(sel=>[...content.querySelectorAll(sel)]));
    const skip=pick(P.skip),raw=pick(P.raw),longs=pick(P.long),lines=pick(P.line),fields=pick(P.field);
    for(const n of skip)n.querySelectorAll('*').forEach(x=>taken.add(x));
    const unit=(u,root)=>{u.root=root;Object.assign(u,gatesOf((u.input||root).parentElement,s.root));
      u.self=u.input||root;units.push(u);byNode.set(root,u);root.querySelectorAll?.('*').forEach(x=>taken.add(x));};
    for(const n of raw){if(taken.has(n))continue;unit({kind:'raw',node:n},n);}
    for(const c of content.querySelectorAll(CONTROL)){
      if(taken.has(c)||skip.has(c)||byNode.has(c)||c.closest('.cwx-page,template'))continue;
      if(c.closest('.inline-drawer-header'))continue;
      const over=P.label?.[c.id]||P.labelOf?.(c);
      if(c.type==='checkbox'||c.type==='radio'){
        const lab=c.closest('label');
        if(c.type==='radio'){
          const box=lab&&content.contains(lab)?lab:c;const extra=box===lab?[...lab.querySelectorAll('input:not([type=radio]),select')]:[];
          unit({kind:'radio',input:c,title:over||textOf(box===c?c.nextElementSibling:box),extra,name:c.name},box);continue;
        }
        if(lab&&content.contains(lab)&&!lab.querySelector('select,input:not([type=checkbox]),textarea')){
          if(lab.querySelectorAll('input[type=checkbox]').length===1){unit({kind:'toggle',input:c,title:over||textOf(lab),desc:P.desc?.[c.id]},lab);continue;}
        }
        const l=labelOf(c,content);l.used.forEach(x=>used.add(x));
        unit({kind:'toggle',input:c,title:over||l.title||textOf(c.nextElementSibling),desc:P.desc?.[c.id]},c);continue;
      }
      if(c.matches('.menu_button,.right_menu_button,button,input[type=button],input[type=submit]')){
        if(c.querySelector('input[type=checkbox]'))continue; // label.menu_button 里的开关在上面当开关处理
        unit({kind:'action',button:c,title:P.label?.[c.id]||P.labelOf?.(c)||actionLabel(c),danger:danger(c)&&!P.safe?.some(x=>c.matches(x))},c);continue;
      }
      if(c.matches('toolcool-color-picker')){const l=labelOf(c,content);l.used.forEach(x=>used.add(x));unit({kind:'color',input:c,title:over||l.title},c);continue;}
      if(c.type==='range'){
        const counter=(c.id&&content.querySelector(`[data-for="${esc(c.id)}"]`))||c.closest('.range-block')?.querySelector('input[type=number]');
        const box=c.closest('.range-block');const lab=box?.querySelector('.range-block-title');
        const l=lab?{title:textOf(lab),used:[lab]}:labelOf(c,content);l.used.forEach(x=>used.add(x));
        if(counter)taken.add(counter);
        unit({kind:'range',input:c,counter,title:over||l.title,desc:P.desc?.[c.id]},c);continue;
      }
      const l=labelOf(c,content);l.used.forEach(x=>used.add(x));
      const kind=longs.has(c)?'long':lines.has(c)?'line':fields.has(c)?'field':c.tagName==='SELECT'?'select':c.tagName==='TEXTAREA'&&(+c.getAttribute('rows')||2)>1?'long':'field';
      unit({kind,input:c,title:over||l.title,desc:P.desc?.[c.id]??(kind==='long'?'':l.desc)},c);
    }
    // 搬动之前记下哪些外层里有控件：排的时候控件已经搬走了，外层只剩字，不能当成小标题。
    const holds=new Set();for(const c of content.querySelectorAll(CONTROL))for(let p=c.parentElement;p&&p!==content;p=p.parentElement)holds.add(p);
    return {units,byNode,used,skip,holds};
  }

  /* ---------- 第二遍：按原来的顺序排进小节和卡片 ---------- */
  function build(s){
    const P=s.plan,root=s.root,content=P.content?.(root)||root.querySelector('.inline-drawer-content')||root;
    const page=add(s,make('div','cwx-page'+(P.cls?' '+P.cls:'')));s.page=page;
    const {units,byNode,used,skip,holds}=scan(s,content);s.units=units;
    let sec=null,card=null,group='';
    const newSec=(title,first)=>{sec=make('section','cwx-sec');if(title){const h=make('h3','cwx-lab',L(title));sec.append(h);}page.append(sec);s.secs.push(sec);card=null;return sec;};
    const newCard=g=>{if(!sec)newSec('');card=make('div','cwx-card'+(g==='act'?' cwx-acts':g==='danger'?' cwx-danger':''));sec.append(card);group=g;return card;};
    // 说明文字也跟着原处显示 / 隐藏（换了来源，别的来源的提示不该出来）。
    const foot=(text,src)=>{if(!sec)newSec('');const f=make('p','cwx-foot',L(text));sec.append(f);card=null;
      if(src)s.rows.push({kind:'note',row:f,self:src,...gatesOf(src,root)});};
    const placed=new Set();let one=false;
    const emit=u=>{
      if(placed.has(u))return;placed.add(u);
      const b=P.before?.[u.input?.id||u.button?.id];if(b==='|')card=null;else if(b)newSec(b);
      const row=draw(s,u);if(!row)return;u.row=row;s.rows.push(u);
      if(u.kind==='long'||u.kind==='line'){if(!sec)newSec('');sec.append(row);card=null;return;}
      const g=u.kind==='action'?(u.danger?'danger':'act'):u.kind==='raw'?'raw':'row';
      if(one){if(!card)newCard('one');card.append(row);return;}
      if(!card||group!==g||g==='danger'||g==='raw')newCard(g);card.append(row);
    };
    // 先排 plan 里写死的小节（TTS 的开关分组之类），剩下的按原来的顺序。
    for(const part of P.layout||[]){
      if(part.title!==undefined||!sec)newSec(part.title||'');else card=null;one=!!part.card;
      for(const item of part.items){
        if(typeof item==='function'){item({emit,newSec,newCard,foot,s,page,sec:()=>sec});continue;}
        if(item==='|'){card=null;continue;}
        if(item.startsWith('foot:')){foot(item.slice(5));continue;}
        for(const n of content.querySelectorAll(item)){const u=byNode.get(n)||units.find(x=>x.input===n||x.button===n);if(u)emit(u);}
      }
    }
    one=false;card=null;
    if(P.layout&&P.rest!==false){newSec(typeof P.restTitle==='function'?' ':P.restTitle||'');if(typeof P.restTitle==='function')s.restSec=sec;}
    const heading=(n,tx)=>{const map=P.heading||{};if(tx in map){if(map[tx])newSec(map[tx]);else card=null;return;}newSec(tx);};
    const visit=el=>{
      for(const ch of el.children){
        if(ch.matches('.cwx-page,template,script,style'))continue;
        const u=byNode.get(ch);if(u){if(P.rest!==false)emit(u);continue;}
        if(used.has(ch)||skip.has(ch)||P.drop?.some(sel=>ch.matches(sel)))continue;
        if(ch.matches('hr')){card=null;continue;}
        if(ch.matches('.inline-drawer-header')){if(P.rest!==false)heading(ch,textOf(ch.querySelector('b,strong')||ch));continue;}
        if(!ch.matches(CONTROL)&&!holds.has(ch)){
          const tx=textOf(ch);if(!tx||P.rest===false)continue;
          if(ch.matches('h1,h2,h3,h4,h5,strong,b,.qr--title,.title_restorable')||(tx.length<=24&&!ch.matches('small,i,p,.hint,.notes,.warning,ul')))heading(ch,tx);
          else if(!ch.matches('.warning')&&!P.noFoot)foot(tx,ch);
          continue;
        }
        visit(ch);
      }
    };
    visit(content);
    P.after?.({s,page,emit,newSec,newCard,foot,content});
    root.prepend(page);root.classList.add('cwx-host');
    sync(s);
  }
  function title(u){return L(u.title||'')||'';}
  function draw(s,u){
    const P=s.plan;
    if(u.kind==='raw'){const box=make('div','cwx-raw');move(s,u.node,box);return box;}
    if(u.kind==='action'){
      const b=button('',()=>{u.button.click();},'cwx-row cwx-act'+(u.danger?' cwx-red':''));
      if(u.danger)b.append(icon('trash'));b.append(make('span','cwx-title',title(u)||L('操作')));
      return b;
    }
    if(u.kind==='toggle'){
      const r=make('label','cwx-row cwx-tog'),info=make('span','cwx-t');info.append(make('span','cwx-title',title(u)));
      if(u.desc)info.append(make('small','cwx-desc',L(u.desc)));r.append(info);move(s,u.input,r);
      if(u.input.classList.contains('displayNone')){u.input.classList.remove('displayNone');s.undo.push(()=>u.input.classList.add('displayNone'));}
      if(P.invert?.some(sel=>u.input.matches(sel)))r.classList.add('cwx-invert');
      return r;
    }
    if(u.kind==='radio'){
      const r=make('label','cwx-row cwx-radio');r.append(make('span','cwx-title',title(u)));
      for(const x of u.extra){const w=make('span','cwx-inline');r.append(w);move(s,x,w);}
      move(s,u.input,r);return r;
    }
    if(u.kind==='select'){
      const r=make('div','cwx-row cwx-sel'),info=make('span','cwx-t');info.append(make('span','cwx-title',title(u)));if(u.desc)info.append(make('small','cwx-desc',L(u.desc)));r.append(info);move(s,u.input,r);
      return r;
    }
    if(u.kind==='range'){
      const r=make('div','cwx-row cwx-range'),head=make('div','cwx-rhead');head.append(make('span','cwx-title',title(u)));r.append(head);
      const track=make('div','cwx-track');r.append(track);move(s,u.input,track);
      // 没有数字框的滑杆（系统语音的速率、音调）右边写当前值。
      const val=u.counter?null:make('span','cwx-rval');if(u.counter)move(s,u.counter,head);else head.append(val);
      const n=u.input;u.paint=()=>{const lo=+n.min||0,hi=+n.max||100,p=Math.max(0,Math.min(100,(n.value-lo)/((hi-lo)||1)*100))+'%';if(track.style.getPropertyValue('--p')!==p)track.style.setProperty('--p',p);if(val&&val.textContent!==n.value)val.textContent=n.value;};
      n.addEventListener('input',u.paint);s.undo.push(()=>n.removeEventListener('input',u.paint));return r;
    }
    if(u.kind==='color'){const r=make('div','cwx-row cwx-field cwx-color');r.append(make('span','cwx-flab',title(u)));move(s,u.input,r);return r;}
    if(u.kind==='line'){
      const blk=make('div','cwx-block cwx-line'),lab=make('label','cwx-blab',title(u)),c=make('div','cwx-card'),r=make('div','cwx-row cwx-lrow');
      blk.append(lab,c);c.append(r);move(s,u.input,r);if(u.desc)blk.append(make('p','cwx-foot',L(u.desc)));return blk;
    }
    if(u.kind==='long'){
      const ta=u.input,blk=make('div','cwx-block cwx-long'),lab=make('div','cwx-blab',title(u)),c=make('div','cwx-card');
      const open=button('',()=>openEditor(ta,title(u)),'cwx-row cwx-lopen'),prev=make('span','cwx-prev'),edit=make('span','cwx-edit',L('编辑'));
      open.append(prev,edit);c.append(open);blk.append(lab,c);if(u.desc)blk.append(make('p','cwx-foot',L(u.desc)));
      const park=make('div','cwx-park');blk.append(park);move(s,ta,park);
      const paint=()=>{const v=(ta.value||'').trim();const text=v||ta.placeholder&&L('（空）')||L('（空）');if(prev.textContent!==text)prev.textContent=text;prev.classList.toggle('cwx-dim',!v);};
      paint();ta.addEventListener('input',paint);ta.addEventListener('change',paint);u.paint=paint;
      s.undo.push(()=>{ta.removeEventListener('input',paint);ta.removeEventListener('change',paint);});
      return blk;
    }
    // field：手机上「灰标签 · 黑值」，点了就地改；电脑上是右边的小输入框。
    const r=make('label','cwx-row cwx-field');r.append(make('span','cwx-flab',title(u)));move(s,u.input,r);
    if(u.input.tagName==='TEXTAREA'){u.input.classList.add('cwx-oneline');s.undo.push(()=>u.input.classList.remove('cwx-oneline'));}
    return r;
  }

  /* ---------- 同步：原来的块藏了，我们的行也藏；空卡片、空小节一起藏 ---------- */
  const cs=n=>win.getComputedStyle(n);
  function sync(s){
    if(!s.page)return;
    for(const u of s.rows){
      const self=u.proxy||u.kind==='note'?false:u.kind==='action'?cs(u.button).display==='none'||u.button.hidden:u.kind==='raw'?hiddenSelf(u.node)||(!u.node.hasAttribute('no-scripts-text')&&!u.node.children.length&&!u.node.textContent.trim()):hiddenSelf(u.self);
      const off=self||u.gates.some(g=>g.hidden||cs(g).display==='none')||!!u.top&&hiddenSelf(u.top);
      if(u.row.hidden!==off)u.row.hidden=off;
      if(u.kind==='action'){const label=title(u)||L('操作'),span=u.row.querySelector('.cwx-title');if(span&&u.button.matches('input')&&span.textContent!==label)span.textContent=label;}
      u.paint?.();
    }
    for(const sec of s.secs){
      for(const c of sec.querySelectorAll(':scope>.cwx-card'))c.hidden=![...c.children].some(x=>!x.hidden);
      const any=[...sec.children].some(x=>!x.matches('.cwx-lab,.cwx-foot')&&!x.hidden);
      sec.hidden=!any;
    }
    const first=s.secs.find(x=>!x.hidden);for(const x of s.secs)x.classList.toggle('cwx-first',x===first);
    const rt=s.restSec?.querySelector(':scope>.cwx-lab');if(rt){const v=L(s.plan.restTitle(s.root));if(rt.textContent!==v)rt.textContent=v;}
    s.plan.sync?.(s);
  }
  function schedule(s,rebuild){
    if(rebuild)s.dirty=true;if(s.frame)return;
    s.frame=win.requestAnimationFrame(()=>{s.frame=0;if(s.closed)return;
      if(s.dirty){s.dirty=false;s.observer.disconnect();const body=s.page?.closest('.cw-v4-editor-body,.popup-content,dialog'),top=body?.scrollTop||0;teardown(s);build(s);if(body)body.scrollTop=top;observe(s);}
      else sync(s);});
  }
  function observe(s){
    s.observer.observe(s.root,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
  }
  function watchRoot(s){
    s.observer=new win.MutationObserver(list=>{
      let rebuild=false,touched=false;
      for(const m of list){
        const inPage=s.page?.contains(m.target);
        if(m.type==='childList'){
          // 酒馆往原处加了新控件（换服务商后重画设置）→ 重排；我们页面里的列表自己会变，不用管。
          if(!inPage&&[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches(CONTROL)||n.querySelector(CONTROL))))rebuild=true;
          if(inPage)touched=true;
        }else if(!(inPage&&m.target.matches?.('.cwx-row,.cwx-card,.cwx-sec,.cwx-block')))touched=true;
      }
      if(rebuild)schedule(s,true);else if(touched)schedule(s);
    });
    observe(s);
  }

  /* ---------- 酒馆的弹窗（快速回复编辑、正则编辑）：同一套排法，弹窗关了就没了，不用还原 ---------- */
  const watch=new win.MutationObserver(()=>{
    for(const [root,s] of popups)if(!root.isConnected){close(s);popups.delete(root);}
    if(!doc.documentElement.hasAttribute('data-cw-v4'))return;
    for(const root of doc.querySelectorAll('dialog[open] #qr--modalEditor,dialog[open] .regex_editor')){
      if(popups.has(root))continue;
      const plan=root.id==='qr--modalEditor'?PLANS.qrEditor:PLANS.regexEditor;
      const s=session(root,plan);popups.set(root,s);root.closest('dialog')?.classList.add('cwx-popup','wide_dialogue_popup');
      build(s);watchRoot(s);
    }
  });

  /* ---------- 各扩展的排法（标题文字照稿） ---------- */
  const has=sel=>root=>!!root.querySelector(sel);
  let lastRegexRow=null,lastQrItem=null;
  const proxy=(label,target,red)=>({emit,s})=>{const b=typeof target==='function'?target():target;if(!b)return;emit({kind:'action',button:b,title:label,danger:!!red,gates:[],self:b,root:b,proxy:true});};
  const PLANS={
    vectors:{match:has('#vectors_source'),
      label:{vectors_source:'向量化来源',vectors_query:'查询消息',vectors_score_threshold:'分数阈值',vectors_force_chunk_delimiter:'区块边界',vectors_include_wi:'纳入世界书扫描',vectors_enabled_world_info:'启用世界书',vectors_enabled_files:'为文件启用',vectors_enabled_chats:'已启用聊天消息'},
      desc:{vectors_include_wi:'向量结果也能触发世界书条目'},field:['#vectors_force_chunk_delimiter'],
      before:{vectors_query:'检索',vectors_include_wi:'|'},
      heading:{'世界书设置':'世界书','World Info settings':'世界书','文件向量化设置':'文件','File vectorization settings':'文件','聊天向量化设置':'聊天','Chat vectorization settings':'聊天'}},
    tts:{match:has('#tts_provider'),
      label:{tts_enabled:'启用',tts_provider:'服务商',tts_narrate_user:'朗读用户消息',tts_auto_generation:'自动生成',tts_narrate_quoted:'只朗读引号内文本',tts_narrate_dialogues:'不朗读 *星号* 内文本',tts_narrate_translated_only:'只朗读翻译后文本',
        tts_skip_codeblocks:'跳过代码块',tts_skip_tags:'跳过标签块里的内容',tts_periodic_auto_generation:'按段朗读（流式播放时）',tts_narrate_by_paragraphs:'按段朗读（非流式时）',tts_pass_asterisks:'星号内文本交给 TTS',tts_multi_voice_enabled:'引号 / 星号用不同的声音',tts_apply_regex:'应用正则过滤',tts_regex_pattern:'正则',playback_rate:'播放速度',tts_refresh:'刷新声音列表',tts_voices:'可用声音'},
      desc:{tts_skip_tags:'<tag>跳过这里</tag>'},
      layout:[{items:['#tts_enabled','#tts_provider']},{items:['#tts_refresh','#tts_voices']},
        {title:'朗读什么',items:['#tts_narrate_user','#tts_auto_generation','#tts_narrate_quoted','#tts_narrate_dialogues','#tts_narrate_translated_only']},
        {title:'跳过',items:['#tts_skip_codeblocks','#tts_skip_tags']},{title:'流式',items:['#tts_periodic_auto_generation','#tts_narrate_by_paragraphs']},
        {title:'其他',items:['#tts_pass_asterisks','#tts_multi_voice_enabled','#tts_apply_regex','#tts_regex_pattern','#playback_rate']}],
      restTitle:root=>{const o=root.querySelector('#tts_provider')?.selectedOptions[0];return !o?'服务商设置':o.value==='System'?'系统语音':o.textContent.trim();},drop:['#tts_status:empty'],heading:{'选择文本转语音服务商':null,'Select TTS Provider':null}},
    expressions:{match:has('#expression_api'),
      label:{expression_api:'分类器',expression_translate:'分类前翻译成英文',expressions_allow_multiple:'允许关键词重复',expressions_reroll_if_same:'同一关键词再次出现时刷新表情',expression_fallback:'找不到时用',expression_custom:'自定义情绪',expression_custom_add:'添加自定义情绪',expression_custom_remove:'删除选中的自定义情绪',expression_override:'立绘文件夹'},
      raw:['#image_list','#no_chat_expressions'],skip:['#expression_override_button'],
      layout:[{title:'分类',items:['#expression_api','#expression_translate','#expressions_filter_available','#expression_llm_prompt','#expression_llm_prompt_restore','.expression_prompt_type_block input']},
        {title:'关键词',items:['#expressions_allow_multiple','#expressions_reroll_if_same']},
        {title:'情绪',items:['#expression_fallback','#expression_custom','|','#expression_custom_add','#expression_custom_remove','foot:也可以用 /emote 快捷命令设置。']},
        {title:'立绘',items:['#no_chat_expressions','#expression_override','#expression_upload_pack_button','#expression_override_cleanup_button','#image_list']}],
      rest:false},
    translate:{match:has('#translation_provider'),
      label:{translation_auto_mode:'自动翻译',translation_provider:'服务',translation_target_language:'目标语言',deepl_api_endpoint:'DeepL 接口',translate_key_button:'密钥',translate_url_button:'地址',translation_clear:'清空翻译'},
      layout:[{items:['#translation_auto_mode','#translation_provider','#deepl_api_endpoint','#translation_target_language','|','#translate_key_button','#translate_url_button','|','#translation_clear','foot:只清掉已保存的译文，不影响原文。']}],rest:false},
    caption:{match:has('#caption_source'),
      label:{caption_source:'来源',caption_template:'消息模板',caption_auto:'自动为图片添加描述',caption_refine_mode:'保存前编辑描述',caption_show_in_chat:'在聊天中显示描述'},
      desc:{caption_template:'写 {{caption}} 的地方会换成图片描述。'},long:['#caption_template']},
    memory:{match:has('#memory_contents'),
      label:{summary_source:'来源',memory_frozen:'暂停',memory_contents:'当前总结',memory_restore:'恢复上一个',summarySettingsBlockToggle:'总结设置',memory_force_summarize:'立即总结',memory_skipWIAN:'不含世界书 / 作者注释'},
      skip:['#summaryExtensionPopoutButton','.editor_maximize'],
      layout:[{items:['#summary_source','#memory_frozen','#memory_skipWIAN']},{items:['#memory_contents']},{items:['#memory_force_summarize','#memory_restore','#summarySettingsBlockToggle']}],
      restTitle:'总结设置'},
    extras:{match:root=>root.matches?.('.extensions_url_block')||!!root.querySelector('#extensions_url'),
      content:root=>root,label:{extensions_url:'地址',extensions_api_key:'密钥',extensions_autoconnect:'自动连接',extensions_connect:'连接'}},
    qr:{match:has('#qr--isEnabled'),cls:'cwx-qr',
      label:{'qr--isEnabled':'启用快速回复','qr--isCombined':'合并快速回复','qr--showPopoutButton':'电脑上显示弹出式按钮','qr--set':'集合','qr--disableSend':'禁用发送（插入输入框）','qr--placeBeforeInput':'放在输入框前面','qr--injectInput':'自动注入用户输入','qr--onlyBorderColor':'颜色只用在边框上',
        'qr--global-setListAdd':'添加全局集合','qr--chat-setListAdd':'添加聊天集合','qr--character-setListAdd':'添加角色集合','qr--set-new':'新建集合','qr--set-rename':'改名','qr--set-import':'导入','qr--set-export':'导出','qr--set-duplicate':'复制','qr--set-delete':'删除这个集合','qr--set-add':'新建按钮','qr--set-paste':'从剪贴板粘贴','qr--set-importQr':'从文件导入','qr--colorClear':'清除颜色','qr--color':'颜色'},
      desc:{'qr--injectInput':'关掉时用 {{input}} 手动插入'},safe:['#qr--colorClear'],raw:['.qr--setList','#qr--set-qrList'],
      layout:[{items:['#qr--isEnabled','#qr--isCombined','#qr--showPopoutButton']},
        {title:'正在用的集合',items:[({emit,s})=>{for(const [id,name] of [['qr--global-setList','全局'],['qr--chat-setList','聊天'],['qr--character-setList','角色']]){const n=s.root.querySelector('#'+id);if(n){n.dataset.cwxTitle=L(name);s.undo.push(()=>delete n.dataset.cwxTitle);}}},
          '#qr--global-setList','#qr--chat-setList','#qr--character-setList'],card:true},{items:['#qr--global-setListAdd','#qr--chat-setListAdd','#qr--character-setListAdd']},
        {title:'编辑集合',items:['#qr--set']},{items:['#qr--set-qrList','#qr--set-add','#qr--set-paste','#qr--set-importQr','foot:点一个按钮进去改名字和内容；按住左边的把手拖动排序。'],card:true},
        {title:'这个集合',items:['#qr--disableSend','#qr--placeBeforeInput','#qr--injectInput','#qr--color','#qr--colorClear','#qr--onlyBorderColor'],card:true},{items:['#qr--set-new','#qr--set-rename','#qr--set-import','#qr--set-export','#qr--set-duplicate','#qr--set-delete']}],
      rest:false,after:({s,page})=>qrList(s,page),sync:s=>qrList(s,s.page)},
    regex:{match:has('#saved_regex_scripts'),cls:'cwx-regex',
      label:{open_regex_editor:'新建全局正则',open_preset_editor:'新建预设正则',open_scoped_editor:'新建角色正则',import_regex:'导入正则',regex_bulk_edit:'批量编辑',open_regex_debugger:'调试工具',regex_presets:'预设',regex_preset_toggle:'启用预设正则',regex_scoped_toggle:'启用角色正则',
        regex_preset_create:'新建预设',regex_preset_update:'用当前开关更新预设',regex_preset_apply:'重新应用预设',regex_preset_delete:'删除这个预设',bulk_select_all_toggle:'全选 / 全不选',bulk_enable_regex:'启用选中的',bulk_disable_regex:'停用选中的',bulk_export_regex:'导出选中的',bulk_delete_regex:'删除选中的',
        bulk_regex_move_to_global:'移到全局',bulk_regex_move_to_preset:'移到预设',bulk_regex_move_to_scoped:'移到角色'},
      raw:['#saved_regex_scripts','#saved_preset_scripts','#saved_scoped_scripts'],
      layout:[{items:['#regex_bulk_edit','|','.regex_bulk_operations .menu_button']},
        {title:'全局',card:true,items:['#saved_regex_scripts','#open_regex_editor','foot:影响所有角色。点一条进去编辑；右边开关是启用 / 停用；按住左边的把手拖动排序。']},
        {title:'预设',card:true,items:['#regex_preset_toggle','#saved_preset_scripts','#open_preset_editor']},
        {title:'角色',card:true,items:['#regex_scoped_toggle','#saved_scoped_scripts','#open_scoped_editor']},
        {title:'正则预设',items:['#regex_presets','|','#regex_preset_create','#regex_preset_update','#regex_preset_apply','#regex_preset_delete']},
        {items:['#import_regex','#open_regex_debugger']}],
      rest:false,after:({s,page})=>regexList(s,page),sync:s=>regexList(s,s.page)},
    qrEditor:{content:root=>root,cls:'cwx-sheet',
      label:{'qr--modal-label':'标签','qr--modal-title':'提示文字','qr--modal-message':'内容','qr--modal-showLabel':'有图标时也显示标签','qr--modal-icon':'选图标',
        'qr--executeOnStartup':'启动时','qr--executeOnUser':'用户发消息后','qr--executeOnAi':'AI 回复后','qr--executeOnChatChange':'打开聊天时','qr--executeOnNewChat':'新聊天时','qr--executeOnGroupMemberDraft':'群聊成员发言前','qr--executeBeforeGeneration':'生成前',
        'qr--preventAutoExecute':'不触发别的自动执行','qr--isHidden':'隐藏按钮（只自动执行）','qr--automationId':'自动化 ID','qr--modal-execute':'立即执行','qr--ctxAdd':'添加右键菜单项',
        'qr--modal-wrap':'自动换行','qr--modal-tabSize':'Tab 宽度','qr--modal-executeShortcut':'Ctrl+Enter 执行','qr--modal-syntax':'语法高亮'},
      line:['#qr--modal-label'],long:['#qr--modal-message'],raw:['#qr--ctxEditor','#qr--modal-executeProgress','#qr--modal-executeErrors','#qr--modal-executeResult'],
      layout:[{title:'',items:['#qr--modal-label','#qr--modal-message','foot:点一下按钮就会发送这里的内容。']},
        {title:'什么时候自动执行',items:['#qr--executeOnStartup','#qr--executeOnUser','#qr--executeOnAi','#qr--executeOnChatChange','#qr--executeOnNewChat','#qr--executeOnGroupMemberDraft','#qr--executeBeforeGeneration','|','#qr--isHidden','#qr--preventAutoExecute','#qr--automationId']},
        {title:'按钮',items:['#qr--modal-title','#qr--modal-showLabel','|','#qr--modal-icon']},
        {title:'右键菜单',items:['#qr--ctxEditor','#qr--ctxAdd']},
        {title:'编辑器',items:['#qr--modal-wrap','#qr--modal-syntax','#qr--modal-executeShortcut','#qr--modal-tabSize']},
        {title:'测试',items:['#qr--modal-execute','#qr--modal-executeProgress','#qr--modal-executeErrors','#qr--modal-executeResult']},
        {items:[proxy('复制到剪贴板',()=>lastQrItem?.isConnected&&lastQrItem.querySelector('.qr--actions .fa-copy')),proxy('导出',()=>lastQrItem?.isConnected&&lastQrItem.querySelector('.qr--actions .fa-file-export'))]},
        {items:[proxy('删除这个按钮',()=>lastQrItem?.isConnected&&lastQrItem.querySelector('.qr--actions .fa-trash-can'),true)]}],
      rest:false},
    regexEditor:{content:root=>root,cls:'cwx-sheet',
      labelOf:c=>c.matches('.regex_script_name')?'名称':c.matches('.find_regex')?'查找':c.matches('.regex_replace_string')?'替换为':c.matches('.regex_trim_strings')?'修剪掉':c.matches('[name=min_depth]')?'最小深度':c.matches('[name=max_depth]')?'最大深度':c.matches('[name=substitute_regex]')?'查找里的宏':c.matches('#regex_test_mode_toggle')?'测试模式':c.matches('#regex_test_input')?'测试输入':c.matches('#regex_test_output')?'输出':'',
      line:['input.regex_script_name','input.find_regex'],long:['.regex_replace_string','.regex_trim_strings','#regex_test_input','#regex_test_output'],raw:['#regex_info_block_wrapper'],
      layout:[{items:['input.regex_script_name','input.find_regex','#regex_info_block_wrapper','.regex_replace_string','.regex_trim_strings']},
        {title:'作用于',items:['[name=replace_position]']},
        {title:'其他',items:['[name=disabled]','[name=run_on_edit]','[name=only_format_display]','[name=only_format_prompt]','|','[name=min_depth]','[name=max_depth]','[name=substitute_regex]']},
        {title:'测试',items:['#regex_test_mode_toggle','#regex_test_input','#regex_test_output']},
        {items:[proxy('导出',()=>lastRegexRow?.isConnected&&lastRegexRow.querySelector('.export_regex')),proxy('移到全局正则',()=>lastRegexRow?.isConnected&&!lastRegexRow.closest('#saved_regex_scripts')&&lastRegexRow.querySelector('.move_to_global')),proxy('移到预设正则',()=>lastRegexRow?.isConnected&&!lastRegexRow.closest('#saved_preset_scripts')&&lastRegexRow.querySelector('.move_to_preset')),proxy('移到角色正则',()=>lastRegexRow?.isConnected&&!lastRegexRow.closest('#saved_scoped_scripts')&&lastRegexRow.querySelector('.move_to_scoped'))]},
        {items:[proxy('删除这条正则',()=>lastRegexRow?.isConnected&&lastRegexRow.querySelector('.delete_regex'),true)]}],
      rest:false},
    generic:{}
  };

  /* 快速回复：每个按钮一行「名字 + 内容预览 · ⋯」，点整行进酒馆自己的编辑页（我们重排过）；左边把手照旧拖动排序。 */
  function li(s,n){if(n.classList.contains('cwx-li'))return;n.classList.add('cwx-li');s.undo.push(()=>n.classList.remove('cwx-li'));}
  function qrList(s,page){
    if(!page)return;
    for(const item of page.querySelectorAll('#qr--set-qrList .qr--set-item,.qr--setList .qr--item'))li(s,item);
    for(const item of page.querySelectorAll('#qr--set-qrList .qr--set-item')){
      if(item.querySelector(':scope>.cwx-qrrow'))continue;
      const label=item.querySelector('.qr--set-itemLabel'),mes=item.querySelector('.qr--set-itemMessage'),opt=item.querySelector('.qr--set-optionsContainer .qr--action');if(!label||!opt)continue;
      const r=make('button','cwx-qrrow');r.type='button';const t=make('span','cwx-t'),name=make('span','cwx-title'),prev=make('small','cwx-desc'),more=make('span','cwx-more');more.append(icon('dots'));
      t.append(name,prev);r.append(t,more);item.append(r);s.created.push(r);
      const grip=item.querySelector('.drag-handle');if(grip&&grip.parentElement!==item){move(s,grip,item,item.firstChild);}
      r.addEventListener('click',()=>{lastQrItem=item;opt.click();});
      const paint=()=>{const a=label.value||L('（空）'),b=mes?.value||'';if(name.textContent!==a)name.textContent=a;if(prev.textContent!==b)prev.textContent=b;};paint();
      label.addEventListener('input',paint);mes?.addEventListener('input',paint);s.undo.push(()=>{label.removeEventListener('input',paint);mes?.removeEventListener('input',paint);});
    }
    // 没有聊天 / 没选角色时酒馆写一句英文：改成「聊天 · 没有打开聊天」这样的灰字行。
    for(const list of page.querySelectorAll('.qr--setList'))for(const n of list.children){
      if(n.matches('.qr--item')||n.querySelector(':scope>.cwx-flab'))continue;li(s,n);
      const tx=n.textContent.trim(),v=/no active chat/i.test(tx)?'没有打开聊天':/no character/i.test(tx)?'没有选角色':tx;
      const a=make('span','cwx-flab',list.dataset.cwxTitle||''),b=make('span','cwx-dimv',L(v));n.prepend(a,b);s.created.push(a,b);
    }
    for(const item of page.querySelectorAll('.qr--setList .qr--item')){
      if(item.querySelector(':scope>.cwx-more-menu'))continue;
      const edit=item.querySelector('.fa-pencil'),del=item.querySelector('.qr--del');
      const tt=make('span','cwx-title',item.parentElement?.dataset.cwxTitle||'');const grip=item.querySelector(':scope>.drag-handle');grip?grip.after(tt):item.prepend(tt);s.created.push(tt);
      const m=make('details','cwx-more-menu'),sm=make('summary','');sm.append(icon('dots'));sm.setAttribute('aria-label',L('更多'));const list=make('div','cwx-more-list');m.append(sm,list);
      // 2.0.267（Lulu：一行里「Default ⌃⌄ + 开关 + ⋯」挤着很怪）：「显示按钮」开关挪进 ⋯，行里只留集合名；隐藏时集合名变灰。
      const vis=item.querySelector('.qr--visible input[type=checkbox]');
      if(vis){const x=button('',e=>{e.stopPropagation();m.open=false;vis.click();},'cwx-more-item');const paint=()=>{x.textContent=L(vis.checked?'隐藏这组按钮':'显示这组按钮');item.classList.toggle('cwx-qr-off',!vis.checked);};paint();vis.addEventListener('change',paint);m.addEventListener('toggle',paint);
        s.undo.push(()=>{vis.removeEventListener('change',paint);item.classList.remove('cwx-qr-off');});list.append(x);}
      for(const [label,b,red] of [['编辑这个集合',edit],['移除',del,true]])if(b){const x=button(L(label),e=>{e.stopPropagation();m.open=false;b.click();},'cwx-more-item'+(red?' cwx-red':''));list.append(x);}
      item.append(m);s.created.push(m);
    }
  }
  /* 正则：每条一行「把手 · 名字 · 开关」，点名字进编辑。酒馆的 disable_regex 勾上是停用，开关反着画（cwx-invert）。 */
  function regexList(s,page){
    if(!page)return;
    for(const item of page.querySelectorAll('.regex-script-label'))li(s,item);
    if(!s.regexClick){s.regexClick=e=>{const name=e.target.closest?.('.regex-script-label .regex_script_name');if(!name)return;const row=name.closest('.regex-script-label');lastRegexRow=row;row.querySelector('.edit_existing_regex')?.click();};
      page.addEventListener('click',s.regexClick);s.undo.push(()=>{page.removeEventListener('click',s.regexClick);s.regexClick=null;});}
  }

  function planFor(root,title){
    for(const k of ['vectors','tts','expressions','translate','caption','memory','qr','regex','extras'])if(PLANS[k].match(root))return PLANS[k];
    return PLANS.generic;
  }
  function open(root,title){
    // 自己画整套界面的扩展（酒馆助手这种）原样放进白卡片。
    if(root.id==='claude-web-settings'||root.querySelector('#claude-web-settings,[data-v-app]')||/酒馆助手|Tavern Helper|st-chatu8/i.test(title)){openEditor(root,title);return;}
    const s=session(root,planFor(root,title));
    try{build(s);}catch(e){console.error('[Claude Web] extension settings',e);teardown(s);sessions.delete(s);openEditor(root,title);return;}
    watchRoot(s);
    watch.observe(doc.body,{childList:true,subtree:true});
    openEditor(root,title,'',{onClose:()=>close(s)});
  }
  return {open,restore(){watch.disconnect();for(const s of [...sessions])close(s);popups.clear();}};
}
