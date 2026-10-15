// iOS experiment: keep keyboard-time gestures inside their actual scroller.
export function installIOSKeyboardScroll({win,enabled,keyboardTarget,reset}) {
  const doc=win.document,root=doc.documentElement;
  let open=false,touching=false,point=null,timer=0;
  const style=doc.createElement('style');
  style.textContent=`html[data-cw-ios-scroll-guard],html[data-cw-ios-scroll-guard] body{background-color:var(--cl-canvas,#1f1f1e)!important}
html[data-cw-ios-keyboard-lock],html[data-cw-ios-keyboard-lock] body{overscroll-behavior:none!important}
html[data-cw-ios-keyboard-lock] #chat{overscroll-behavior:contain!important}`;
  doc.head.append(style);
  const clear=()=>{if(timer)win.clearTimeout(timer);timer=0;};
  const sync=()=>{
    const on=enabled(),layout=Math.max(root.clientHeight,win.innerHeight||0);
    open=on&&layout-(win.visualViewport?.height||layout)>80&&(keyboardTarget(doc.activeElement)||open);
    root.toggleAttribute('data-cw-ios-scroll-guard',on);root.toggleAttribute('data-cw-ios-keyboard-lock',open);
    if(!open)clear();
  };
  const displaced=()=>Math.abs(win.scrollX)>1||Math.abs(win.scrollY)>1||Math.abs(win.visualViewport?.offsetTop||0)>1;
  const scheduleRecovery=()=>{clear();if(open&&!touching&&displaced())timer=win.setTimeout(()=>{timer=0;if(open&&!touching&&displaced())reset();},150);};
  const viewport=()=>{sync();scheduleRecovery();};
  const start=e=>{touching=e.touches.length>0;point=null;clear();sync();if(open&&e.touches.length===1){const t=e.touches[0];point={id:t.identifier,x:t.clientX,y:t.clientY};}};
  const canScroll=(target,dy)=>{
    for(let el=target;el&&el!==doc.body&&el!==root;el=el.parentElement){
      if(!/(auto|scroll|overlay)/.test(win.getComputedStyle(el).overflowY)||el.scrollHeight<=el.clientHeight+1)continue;
      if(dy>0&&el.scrollTop>1||dy<0&&el.scrollTop+el.clientHeight<el.scrollHeight-1)return true;
    }return false;
  };
  const move=e=>{
    if(!open||!point||e.touches.length!==1)return;
    const t=e.touches[0];if(t.identifier!==point.id)return;
    const dx=t.clientX-point.x,dy=t.clientY-point.y;point={id:t.identifier,x:t.clientX,y:t.clientY};
    if(!e.cancelable||e.defaultPrevented||!dy||Math.abs(dx)>=Math.abs(dy))return;
    // Preserve native caret/selection dragging, even at a textarea's scroll edge.
    if(e.target?.closest?.('textarea,input,select,[contenteditable]:not([contenteditable="false"])'))return;
    if(!canScroll(e.target,dy))e.preventDefault();
  };
  const end=e=>{touching=e.touches.length>0;if(!touching){point=null;sync();scheduleRecovery();}};
  doc.addEventListener('touchstart',start,{capture:true,passive:true});doc.addEventListener('touchmove',move,{capture:true,passive:false});
  doc.addEventListener('touchend',end,{capture:true,passive:true});doc.addEventListener('touchcancel',end,{capture:true,passive:true});
  doc.addEventListener('focusin',viewport,true);doc.addEventListener('focusout',viewport,true);
  win.addEventListener('scroll',viewport,{passive:true});win.visualViewport?.addEventListener('resize',viewport,{passive:true});win.visualViewport?.addEventListener('scroll',viewport,{passive:true});sync();
  return {active:()=>open,isTouching:()=>touching,scheduleRecovery,sync,destroy(){
    clear();open=false;touching=false;point=null;
    doc.removeEventListener('touchstart',start,true);doc.removeEventListener('touchmove',move,true);doc.removeEventListener('touchend',end,true);doc.removeEventListener('touchcancel',end,true);
    doc.removeEventListener('focusin',viewport,true);doc.removeEventListener('focusout',viewport,true);win.removeEventListener('scroll',viewport);
    win.visualViewport?.removeEventListener('resize',viewport);win.visualViewport?.removeEventListener('scroll',viewport);
    root.removeAttribute('data-cw-ios-scroll-guard');root.removeAttribute('data-cw-ios-keyboard-lock');style.remove();
  }};
}
