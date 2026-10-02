const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.js'),'utf8');
const start=source.indexOf('  function showPanelFromRail(panel) {');
assert(start>0,'showPanelFromRail exists');
const code=source.slice(start,source.indexOf('\n  async function startMobileNewChat',start));
function setup(){
 let menu=true,closes=0,nextFrame=1;const frames=new Map(),panelClasses=new Set();
 const panel={id:'target',classList:{contains:c=>panelClasses.has(c)}};
 const shell={hidden:false,dataset:{panel:'old'}};
 const layout={calls:[],activate(id){this.calls.push([id,ctx.mobileNavActivating])}};
 const ctx={destroyed:false,mobileMenuCloseToken:0,mobileNavPanelCleanup:null,mobileNavActivating:false,
  hostDocument:{querySelector:()=>shell},
  hostWindow:{__claudeOfficialLayout:layout,requestAnimationFrame:f=>{const id=nextFrame++;frames.set(id,f);return id},cancelAnimationFrame:id=>frames.delete(id)},
  isMobileMenuOpen:()=>menu,closeMobileMenu:()=>{closes++;menu=false;ctx.mobileNavPanelCleanup?.()}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,panel,layout,frames,get menu(){return menu},get closes(){return closes},
  frame(){const f=[...frames.values()];frames.clear();f.forEach(x=>x())},
  ready(){panelClasses.add('openDrawer');shell.dataset.panel='target'}};
}
let t=setup();t.ctx.showPanelFromRail(t.panel);
assert.deepEqual(t.layout.calls,[['target',true]],'activate runs once, marked so its native clicks do not close the rail');
assert.equal(t.ctx.mobileNavActivating,false);assert(t.menu,'rail stays open while the page switches in place');
t.frame();t.frame();assert(t.menu,'not ready: keep waiting');
t.ready();t.frame();assert(t.menu,'first frame with the new page: let it paint in the strip');
t.frame();assert.equal(t.closes,1,'next frame: close the rail so the new page slides back');assert.equal(t.frames.size,0);assert.equal(t.ctx.mobileNavPanelCleanup,null);
t=setup();t.ready();t.ctx.showPanelFromRail(t.panel);t.frame();assert(t.menu,'even if already shown, wait one painted frame');t.frame();assert.equal(t.closes,1);
t=setup();t.ctx.showPanelFromRail(t.panel);t.ctx.mobileMenuCloseToken++;t.ready();t.frame();t.frame();assert.equal(t.closes,0,'reopened rail: stale task does nothing');assert.equal(t.frames.size,0);
t=setup();t.ctx.showPanelFromRail(t.panel);t.ctx.closeMobileMenu();assert.equal(t.frames.size,0,'closing the rail cancels the wait');
t=setup();t.ctx.showPanelFromRail(t.panel);for(let i=0;i<301;i++)t.frame();assert.equal(t.closes,1,'SillyTavern never opened the page: give up after ~5s and close');
t=setup();t.ctx.showPanelFromRail(t.panel);const first=t.ctx.mobileNavPanelCleanup;t.ctx.showPanelFromRail(t.panel);assert.notEqual(t.ctx.mobileNavPanelCleanup,first);assert.equal(t.frames.size,1,'a second tap replaces the first wait');
console.log('mobile push drawer: in-place switch, close after one painted frame, cancellation and timeout passed');
