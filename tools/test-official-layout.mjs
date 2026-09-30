import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { installOfficialLayout } from '../official-layout.js';

// Test the actual ST markup, not a reduced imitation of the preferences.
const native = await readFile(process.env.ST_PUBLIC_INDEX || 'D:/SillyTavern-1.18.0/public/index.html','utf8');
const dom = new JSDOM(native, {url:'http://localhost/',pretendToBeVisual:true});
const w = dom.window, d = w.document;
w.CSS = {escape:s=>s.replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c)};
w.SillyTavern = {getContext:()=>({name2:'Test character',groupId:null})};
w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
w.HTMLDialogElement.prototype.close = function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
d.documentElement.dataset.claudeStructure='rail'; d.documentElement.dataset.claudeSkin='classic';
const controls = [...d.querySelectorAll('#top-settings-holder input,#top-settings-holder select,#top-settings-holder textarea,#top-settings-holder button')];
const originalParents = new Map([...d.querySelectorAll('#top-settings-holder .drawer-content')].map(n=>[n,n.parentNode]));
// Exercise the same ancestor visibility lifecycle used by API-dependent rows.
const temperatureRow=d.getElementById('temp_openai').closest('.range-block');
const sourceGate=d.createElement('div');sourceGate.style.display='none';temperatureRow.before(sourceGate);sourceGate.append(temperatureRow);
const show = id => { d.querySelectorAll('.drawer-content').forEach(n=>{n.classList.remove('openDrawer');n.classList.add('closedDrawer');});const p=d.getElementById(id);p.classList.add('openDrawer');p.classList.remove('closedDrawer');};
const app=installOfficialLayout(w);
d.dispatchEvent(new w.Event('DOMContentLoaded'));
show('user-settings-block');app.refresh();
// design-v4 PAGES: seven pages; unmapped controls go to Advanced › Other.
assert.equal(d.querySelectorAll('.cw-v4-pref-page').length,7);
assert.ok(d.getElementById('themes').closest('.cw-v4-pref-page[data-page="look"] .cw-v4-pref-row'),'theme selector must be moved out of the hidden original layout');
assert.equal(d.getElementById('ui-preset-update-button').closest('.cw-v4-pref-row').querySelectorAll('.cw-v4-pref-btn').length,5,'all five native theme actions stay visible');
d.body.classList.add('clawd-mobile-layout');app.refresh();
assert.equal([...d.querySelectorAll('.cw-v4-pref-page')].filter(n=>!n.hidden).length,1,'wide viewport keeps desktop categories even with mobile skin');
// A phone keeps the phone arrangement in landscape: layout is per device, not per width.
d.documentElement.dataset.claudeLayout='mobile';app.refresh();
assert.equal([...d.querySelectorAll('.cw-v4-pref-page')].filter(n=>!n.hidden).length,7,'phone layout shows every preference page at a wide width');
delete d.documentElement.dataset.claudeLayout;app.refresh();
for(const control of controls){assert.ok(control.isConnected,`disconnected native control ${control.id}`);if(control.id)assert.equal(d.getElementById(control.id),control,`replaced ${control.id}`);}
for(const [panel,parent] of originalParents)assert.equal(panel.parentNode,parent,`drawer ancestry changed: ${panel.id}`);
assert.equal(d.querySelectorAll('#font_scale').length,1);
// Custom CSS is a full inline textarea in the design (Advanced › Custom CSS).
d.querySelector('[data-pref="adv"]').click();
const css=d.getElementById('customCSS');
assert.ok(css.closest('.cw-v4-pref-page[data-page="adv"] .cw-v4-pref-row'),'custom CSS textarea sits in its Advanced row');
// Long text rows (design textRow): preview + Edit dialog on the native textarea.
show('left-nav-panel');app.refresh();
const ta=d.getElementById('main_prompt_quick_edit_textarea');
let bubbled=0;
d.getElementById('left-nav-panel').addEventListener('input',()=>bubbled++);
const row=ta.closest('.cw-v4-tprev-row');
assert.ok(row,'quick edit prompt is a text row');
row.querySelector('.cw-v4-row-controls button').click();
assert.ok(ta.closest('dialog[open]'));
assert.ok(ta.closest('#left-nav-panel'),'editor must preserve delegated ancestor');
ta.value='/* test */';ta.dispatchEvent(new w.Event('input',{bubbles:true}));
assert.equal(bubbled,1);
ta.closest('dialog').close();
assert.equal(ta.closest('.cw-v4-tprev-row'),row,'closing returns same textarea to its row');
assert.equal(row.querySelector('.cw-v4-tprev').textContent,'/* test */');
show('user-settings-block');app.refresh();
// Refresh must become idle, rather than scheduling itself through its own DOM writes.
let mutations=0;const mo=new w.MutationObserver(rs=>mutations+=rs.length);mo.observe(d.getElementById('user-settings-block'),{subtree:true,childList:true});
app.refresh();await new Promise(r=>setTimeout(r,80));
assert.equal(mutations,0,'unchanged refresh must not rewrite previews');mo.disconnect();
show('rm_extensions_block');app.refresh();
const late=d.createElement('div');late.id='late-test-extension';late.innerHTML='<div class="inline-drawer"><div class="inline-drawer-header"><b>Late extension</b></div><div class="inline-drawer-content"><input id="late-test-input"></div></div>';
d.getElementById('extensions_settings').append(late);
await new Promise(r=>setTimeout(r,50));
assert.ok(late.querySelector('.cw-v4-extension-edit'),'late-rendered extension gets an editor');
late.querySelector('.cw-v4-extension-edit').click();
assert.ok(d.getElementById('late-test-input').closest('#late-test-extension'),'whole extension ancestor retained');
late.closest('dialog').close();
// A pinned native drawer must not make selection oscillate on each observer pass.
const pinned=d.getElementById('WorldInfo');pinned.classList.add('openDrawer');pinned.classList.remove('closedDrawer');
app.refresh();const title=d.querySelector('.cw-v4-title').textContent;app.refresh();assert.equal(d.querySelector('.cw-v4-title').textContent,title);
d.documentElement.dataset.claudeStructure='linear';app.refresh();
assert.equal(d.querySelector('.cw-v4-pref-pages'),null,'switching structure restores original preferences');
assert.equal(d.querySelector('.cw-v4-more'),null,'native actions must not stay in collapsed menus outside v4');
for(const control of controls)assert.ok(control.isConnected,`lost on structure switch: ${control.id}`);
await new Promise(r=>setTimeout(r,50));
let disabledMutations=0;
const disabledObserver=new w.MutationObserver(rs=>disabledMutations+=rs.length);
disabledObserver.observe(d.getElementById('top-settings-holder'),{subtree:true,attributes:true,attributeFilter:['class']});
await new Promise(r=>setTimeout(r,80));
disabledObserver.disconnect();
assert.equal(disabledMutations,0,'disabled layout must stop touching native panel classes');
d.documentElement.dataset.claudeStructure='rail';show('user-settings-block');app.refresh();
assert.equal(d.querySelectorAll('.cw-v4-pref-page').length,7,'preferences can be rebuilt after structure switch');
// Model ST's real close-then-delay behavior: navigation must close the old
// drawer first so the native opener never enters its animation-delay branch.
let delayedOpens=0;
for(const [panel] of originalParents){
  const toggle=panel.closest('.drawer')?.querySelector(':scope > .drawer-toggle');
  toggle?.addEventListener('click',()=>{
    if(panel.classList.contains('openDrawer')){panel.classList.replace('openDrawer','closedDrawer');return;}
    const others=[...d.querySelectorAll('.openDrawer:not(.pinnedOpen)')];
    if(others.length)delayedOpens++;
    others.forEach(p=>p.classList.replace('openDrawer','closedDrawer'));
    panel.classList.replace('closedDrawer','openDrawer');
  });
}
for(const id of ['rm_extensions_block','right-nav-panel','AdvancedFormatting']){
  d.querySelector(`[data-panel="${id}"]`).click();app.refresh();
  assert.equal(d.querySelector('#cw-v4-settings').hidden,false,'shell must remain visible between pages');
  assert.ok(d.getElementById(id).classList.contains('openDrawer'));
}
assert.equal(delayedOpens,0,'native delayed opening path causes shell flicker');
assert.equal(d.querySelectorAll('.cw-v4-navitem>.cw-v4-icon').length,15,'each navigation row has its approved icon');
for(const id of ['Backgrounds','WorldInfo','left-nav-panel','AdvancedFormatting','PersonaManagement','right-nav-panel','rm_api_block','rm_extensions_block']){
  show(id);app.refresh();
  for(const control of controls)assert.ok(control.isConnected,`reflow disconnected ${control.id} on ${id}`);
}
assert.ok(d.querySelector('#Backgrounds>.cw-v4-drawer-page #background_fitting'));
assert.ok(d.querySelector('#WorldInfo>.cw-v4-drawer-page #world_popup_entries_list'));
// Select2 can initialize after the drawer was reflowed. Its visible sibling
// must be recovered even when ST appends it in the old hidden wrapper.
const latePicker=d.createElement('span');latePicker.className='select2-container';
latePicker.innerHTML='<span id="select2-world_editor_select-container">Book picker</span>';
d.querySelector('#WorldInfo .cw-v4-native-rest').append(latePicker);
show('WorldInfo');app.refresh();
assert.equal(latePicker.parentElement,d.getElementById('world_editor_select').parentElement,'late picker remains reachable');
show('left-nav-panel');app.refresh();
assert.equal(temperatureRow.hidden,true,'moving a parameter must preserve its hidden source ancestor');
sourceGate.style.display='block';await new Promise(resolve=>w.setTimeout(resolve,0));
assert.equal(temperatureRow.hidden,false,'source changes must update the moved parameter');
assert.ok(!d.getElementById('openai_media_inlining').closest('.cw-v4-park'),'image quality must not hide the independent media toggle');
assert.ok(!d.getElementById('openai_inline_image_quality').closest('.cw-v4-park'),'image quality remains available');
assert.ok(d.getElementById('completion_prompt_manager').closest('.cw-v4-prompts'),'prompt manager remains on the main page');
assert.equal(d.getElementById('impersonation_prompt_textarea').closest('.cw-v4-dialog-box').querySelectorAll('textarea').length,10,'all utility prompts retain their native textareas');
assert.ok(d.getElementById('openai_logit_bias_preset').closest('.cw-v4-row'),'bias preset uses a setting row');
show('AdvancedFormatting');app.refresh();
assert.ok(d.querySelectorAll('#AdvancedFormatting .cw-v4-row').length>40,'formatting uses mapped controls');
assert.equal(d.getElementById('reasoning_prefix').closest('.cw-v4-dialog-box').querySelectorAll('textarea').length,3,'reasoning format retains all three native delimiters');

// World editors are created only after ST's native drawer event.
show('WorldInfo');
const worldEntry=d.querySelector('#entry_edit_template .world_entry').cloneNode(true);
d.getElementById('world_popup_entries_list').append(worldEntry);
let lazyLoads=0;
w.jQuery=node=>({trigger:event=>{
  assert.equal(event,'inline-drawer-toggle');lazyLoads++;
  node.querySelector('.inline-drawer-outlet').append(d.querySelector('#entry_edit_template .world_entry_edit').cloneNode(true));
}});
app.refresh();worldEntry.querySelector('.cw-v4-entry-edit').click();
const worldDialog=worldEntry.querySelector('dialog[open]');
assert.ok(worldDialog?.querySelector('textarea[name="content"]'),'lazy native content must exist in the dialog');
assert.equal(lazyLoads,1);
// design editEntry: nine sections of setting rows; header fields move in and back out.
assert.equal(worldDialog.querySelectorAll('.cw-v4-wi-edit>.cw-v4-section').length,9,'entry editor uses the design sections');
assert.ok(worldDialog.querySelector('.cw-v4-wi-edit-head [name="comment"]'),'title field is in the dialog head');
assert.ok(worldDialog.querySelector('[name="order"]'),'order moves into the Insert section');
worldDialog.close();
assert.ok(worldEntry.querySelector('.inline-drawer-header [name="order"]'),'order returns to the native header');
assert.ok(!worldEntry.querySelector('.cw-v4-wi-edit'),'editor box is removed after closing');
worldEntry.querySelector('.cw-v4-entry-edit').click();
assert.equal(lazyLoads,1,'reopening must reuse the native editor');
worldEntry.querySelector('dialog[open]').close();
// Message "…" popup (2026-09-29): a second click on … closes it through ST's own outside-click path,
// and the open popup is positioned from the … button (fixed, so no container overflow has to change).
{
  const mes=d.querySelector('#message_template .mes').cloneNode(true);
  mes.setAttribute('is_user','false');d.getElementById('chat').append(mes);
  const hint=mes.querySelector('.extraMesButtonsHint'),extra=mes.querySelector('.extraMesButtons');
  let toST=0,bodyClicks=0;
  const spy=e=>{if(e.target.closest?.('.extraMesButtonsHint'))toST++;if(e.target===d.body)bodyClicks++;};
  d.addEventListener('click',spy);
  hint.click();
  assert.equal(toST,1,'first click on … still reaches ST, which opens the menu');
  extra.classList.add('visible');                      // what ST does once its fade finishes
  await new Promise(r=>setTimeout(r,150));
  assert.match(extra.style.getPropertyValue('--cw-more-x'),/^-?\d+(\.\d+)?px$/,'open popup gets its x from the … button');
  assert.match(extra.style.getPropertyValue('--cw-more-y'),/^-?\d+(\.\d+)?px$/,'open popup gets its y from the … button');
  // Some pages carry a second, empty #chat (seen after toggling the extension). Bounds must come from the
  // #chat that holds the message, or --cw-more-max collapses to 0 and the popup shrinks to nothing.
  const ghost=d.createElement('div');ghost.id='chat';d.getElementById('sheld').prepend(ghost);
  const realChat=mes.closest('#chat');realChat.getBoundingClientRect=()=>({left:100,top:0,right:900,bottom:600,width:800,height:600});
  await new Promise(r=>setTimeout(r,80));
  assert.equal(extra.style.getPropertyValue('--cw-more-max'),'784px','max width comes from the #chat that holds the message');
  ghost.remove();delete realChat.getBoundingClientRect;
  hint.click();
  assert.equal(toST,1,'second click on … must not reach ST (it would try to open again)');
  assert.equal(bodyClicks,1,'second click closes through a body click, i.e. ST\'s own outside-click handler');
  d.removeEventListener('click',spy);mes.remove();
}
// Input menus (2026-09-29): + menu and ≡ menu open from the same left edge with the same width.
// ST pins each one to its own button with Popper (top-start) and sizes it to its own text.
{
  const optBtn=d.getElementById('options_button'),opts=d.getElementById('options');
  const extBtn=d.createElement('div');extBtn.id='extensionsMenuButton';optBtn.before(extBtn);   // extensions.js adds these at runtime
  const extMenu=d.createElement('div');extMenu.id='extensionsMenu';extMenu.style.display='none';d.body.append(extMenu);
  const rect=(l,w)=>()=>({left:l,right:l+w,top:0,bottom:0,width:w,height:0});
  extBtn.getBoundingClientRect=()=>({left:341,right:373,top:411,bottom:443,width:32,height:32});optBtn.getBoundingClientRect=rect(381,32);
  extMenu.getBoundingClientRect=rect(0,170);opts.getBoundingClientRect=rect(0,181);
  optBtn.click();
  assert.equal(d.documentElement.style.getPropertyValue('--cw-v4-menu-shift'),'-40px','≡ menu shifts onto the + button\'s left edge');
  assert.equal(d.documentElement.style.getPropertyValue('--cw-v4-menu-w'),'200px','both menus take the wider natural width (at least 200px)');
  assert.equal(d.documentElement.style.getPropertyValue('--cw-v4-menu-maxh'),'383px','menus are capped at the room above the buttons, minus their own padding/border (welcome page: composer mid-screen)');
  opts.getBoundingClientRect=rect(0,236);extBtn.click();
  assert.equal(d.documentElement.style.getPropertyValue('--cw-v4-menu-w'),'236px','width follows the wider menu, including a closed one');
  assert.equal(extMenu.style.display,'none','measuring a closed menu must leave it closed');
  assert.equal(opts.style.display,'none','measuring a closed menu must leave it closed');
  extBtn.remove();extMenu.remove();
}
d.documentElement.dataset.claudeStructure='linear';app.refresh();
for(const control of controls)assert.ok(control.isConnected,`reflow restore lost ${control.id}`);
assert.equal(d.querySelector('.cw-v4-drawer-page'),null,'all semantic pages return to native layout');
app.destroy();w.close();
console.log('✓ v4 native control identity, drawer ancestry, delegated editing, late extensions and observer-idle checks passed');
