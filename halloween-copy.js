// Observe the native copy result; never initiate a second clipboard write.
// Formal chat-tools has this bridge; test329 retains its native inlined tools.
export function observeHalloweenCopies(win,getContext){
  const doc=win.document,latest=new WeakMap(),seen=new WeakMap(),clipboard=win.navigator.clipboard;
  const originalWrite=clipboard?.writeText,originalExec=doc.execCommand;let pending=null,dead=false,timer=0,wrappedWrite=null,wrappedExec=null;
  const note=e=>{if(e.detail?.button)seen.set(e.detail.button,win.performance.now());};
  const feedback=(token,success)=>{if(!token)return;win.queueMicrotask(()=>{if(dead||!token.button.isConnected||latest.get(token.button)!==token||(seen.get(token.button)||0)>=token.startedAt)return;doc.dispatchEvent(new win.CustomEvent('cw-copy-result',{detail:{button:token.button,success,startedAt:token.startedAt}}));});};
  const capture=e=>{const button=e.target.closest?.('.mes_copy');if(!button)return;const id=Number(button.closest('.mes')?.getAttribute('mesid')),message=getContext()?.chat?.[id];if(!message)return;const token={event:e,button,text:message.mes,startedAt:win.performance.now()};pending=token;latest.set(button,token);win.clearTimeout(timer);timer=win.setTimeout(()=>{if(pending===token)pending=null},0);};
  const tokenFor=text=>pending&&pending.event.eventPhase!==0&&(text===undefined||text===pending.text)?pending:null;
  doc.addEventListener('pointerup',capture,true);doc.addEventListener('cw-copy-result',note);
  if(originalWrite)try{wrappedWrite=function(text){const token=tokenFor(text);let result;try{result=originalWrite.apply(this,arguments)}catch(e){feedback(token,false);throw e}if(token)Promise.resolve(result).then(()=>feedback(token,true),()=>feedback(token,false));return result};clipboard.writeText=wrappedWrite}catch{wrappedWrite=null}
  if(originalExec)try{wrappedExec=function(command){const token=String(command).toLowerCase()==='copy'?tokenFor():null;try{const result=originalExec.apply(this,arguments);if(token)feedback(token,result===true);return result}catch(e){feedback(token,false);throw e}};doc.execCommand=wrappedExec}catch{wrappedExec=null}
  return ()=>{dead=true;pending=null;win.clearTimeout(timer);doc.removeEventListener('pointerup',capture,true);doc.removeEventListener('cw-copy-result',note);if(wrappedWrite&&clipboard.writeText===wrappedWrite)clipboard.writeText=originalWrite;if(wrappedExec&&doc.execCommand===wrappedExec)doc.execCommand=originalExec;};
}