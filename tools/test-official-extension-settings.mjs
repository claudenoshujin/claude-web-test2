import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createExtensionSettings} from '../official-extension-settings.js';
const dom=new JSDOM('<body></body>',{url:'http://localhost/',pretendToBeVisual:true}),win=dom.window,doc=win.document;
doc.documentElement.setAttribute('data-cw-v4','');
const make=(tag,cls='',text)=>{const n=doc.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
const button=(text,fn,cls)=>{const n=make('button',cls,text);n.type='button';n.addEventListener('click',fn);return n;};
let active;
const icon=()=>doc.createElementNS('http://www.w3.org/2000/svg','svg');
const ui=createExtensionSettings({win,make,button,icon,L:s=>s,t:(a)=>a,openEditor:(node,title,desc,opts)=>{active={node,opts};}});
const nativeBase='D:/SillyTavern-1.18.0/public/scripts/extensions/';
const custom=make('div');custom.innerHTML='<div data-v-app><input type="text" value="custom"></div>';doc.body.append(custom);const customBefore=custom.innerHTML;ui.open(custom,'Custom App');assert.equal(custom.innerHTML,customBefore,'self-rendered applications are left intact');custom.remove();
for(const file of ['vectors/settings.html','tts/settings.html','quick-reply/html/settings.html','regex/dropdown.html','caption/settings.html','memory/settings.html','translate/index.html','expressions/settings.html']){
 const root=make('div');root.innerHTML=await readFile(nativeBase+file,'utf8');doc.body.append(root);
 const before=root.innerHTML,controls=[...root.querySelectorAll('input,select,textarea')],parents=controls.map(n=>n.parentElement);
 let bubbled=0;root.addEventListener('input',()=>bubbled++);
 ui.open(root,'Test');
 for(const n of controls){assert.ok(root.contains(n),file+': preserve native field ancestry');assert.equal([...root.querySelectorAll('input,select,textarea')].filter(x=>x===n).length,1);}
 const gate=root.querySelector('#vectors_world_info_settings');if(gate){const dependent=root.querySelector('#vectors_max_entries');assert.ok(dependent?.closest('.cwx-row'),'dependent field drawn as a row');gate.style.display='';await new Promise(r=>win.setTimeout(r,60));assert.equal(dependent.closest('.cwx-row').hidden,false,'row shown while its native block is shown');gate.style.display='none';await new Promise(r=>win.setTimeout(r,60));assert.equal(dependent.closest('.cwx-row').hidden,true,'row follows its native block (provider / switch gates)');gate.removeAttribute('style');await new Promise(r=>win.setTimeout(r,60));}
 const field=controls.find(n=>n.type==='text');if(field){field.value='native event';field.dispatchEvent(new win.Event('input',{bubbles:true}));assert.equal(bubbled,1);}
 active.opts.onClose();assert.equal(root.innerHTML,before,file+': close must restore native markup exactly');
 controls.forEach((n,i)=>assert.equal(n.parentElement,parents[i]));root.remove();
}
// Native quick-reply popup: auto-execution fields must keep identity, and a
// generated label must produce exactly ONE native click (no doubled toggle).
const dialog=make('dialog','popup');dialog.setAttribute('open','');dialog.innerHTML=await readFile(nativeBase+'quick-reply/html/qrEditor.html','utf8');
const auto=dialog.querySelector('#qr--executeOnStartup');let clicks=0;auto.addEventListener('click',()=>clicks++);
// Start the popup observer via a normal config session.
const config=make('div');config.innerHTML='<div class="inline-drawer"><div class="inline-drawer-header">Test</div><div class="inline-drawer-content"></div></div>';doc.body.append(config);ui.open(config,'Test');doc.body.append(dialog);
await new Promise(r=>win.setTimeout(r,10));
assert.ok(auto.closest('.cwx-page'),'native popup decorated');
auto.closest('label.cwx-row').querySelector('.cwx-title').click();assert.equal(clicks,1);assert.equal(auto.checked,true);
const ta=dialog.querySelector('#qr--modal-message');ta.value='new native text';ta.dispatchEvent(new win.Event('input',{bubbles:true}));assert.equal(ta.closest('.cwx-long').querySelector('.cwx-prev').textContent,'new native text');
ui.restore();assert.equal(dialog.querySelectorAll('.cwx-page,.cwx-row').length,0);
dom.window.close();console.log('✓ Native extension control identity, conditional ancestors, exact restoration, popup labels and text preview passed');
