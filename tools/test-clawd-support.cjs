// Isolated browser regression: real pile pointer handlers, graph, Web Animations and A2 flight/lower functions.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/claudialu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const cp = require('node:child_process');
const baseline = process.argv.includes('--baseline');
const only = process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const repeats = Number(process.env.REPEATS || 12);
const read = file => baseline ? cp.execFileSync('git', ['show', '62a8c60:' + file], {cwd:root, encoding:'utf8'}) : fs.readFileSync(path.join(root,file),'utf8');
const index = read('index.js');
const fn = name => {const start=index.indexOf('  function '+name+'('); assert.ok(start>=0); return index.slice(start,index.indexOf('\n  }',start)+4);};
const pile = read('clawd-pile.js').replace('export function','function').replace(/return \{ ensure, left, destroy, hush, peek, seats,.*?restack \};/,s=>s.replace('};',', test: { K, relayout, lift, get bigOn() { return bigOn; } } };'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 console.log('Browser:',browser.version(),baseline?'baseline':'candidate');
 const results=[];
 try {
 for(const touch of (process.argv.includes('--touch-only')?[true]:[false,true])) {
 const context=await browser.newContext({viewport:{width:900,height:700},hasTouch:touch});
 const page=await context.newPage();
 const cdp=touch?await context.newCDPSession(page):null;
 await page.setContent('<style>body{margin:0}#send_form{position:absolute;left:100px;top:500px;width:600px;height:100px}.clawd-composer-clawd{position:absolute;left:276px;top:-60px;width:48px;height:60px;padding:0;border:0;background:transparent;transition:none}.clawd-rig{width:48px;height:60px;background:#d97757}</style><form id="send_form"><button class="clawd-composer-clawd"><div class="clawd-rig"></div></button></form>');
 await page.addScriptTag({content:pile+'\n'+`
 const hostWindow=window, button=document.querySelector('button');
 const A2={held:false,fy:0,floor:0,x:0,homeX:0,flying:0,feel:1,vx:0,vy:0,throws:0,irr:0,bnd:{miny:-350,minxHome:-250,maxxHome:250},petting:false};
 const clawdTracks={A:null,B:'idle',C:null};
 const composerClawd=()=>button;
 const a2Place=()=>{button.style.transform='translate('+A2.x+'px,'+A2.fy+'px)';};
 const renderClawdTracks=()=>{},scheduleA2BoundsWarm=()=>{},clawdRigPixelSnap=()=>{};
 const a2NoteInteraction=()=>{},a2TraceFrame=()=>{},a2TraceMark=()=>{},a2ClampX=x=>x;
 const setClawdC=(c)=>{clawdTracks.C=c;};
 const clawdRigPickVariant=x=>x,CLAWD_RIG={clips:{stomp:{dur:500}}};
 const clawdPile=createClawdPile({doc:document,win:window,big:{state:()=>({grounded:!A2.held&&Math.abs(A2.fy-A2.floor)<.5}),lower:()=>clawdBigLower()}});
 `+[fn('clawdBigLower'),fn('a2Phys'),fn('a2Ballistic'),fn('a2Up'),fn('a2Cancel')].join('\n')+`
 const a2Poke=()=>{};
 clawdPile.ensure();clawdPile.test.relayout();
 window.test={A2,clawdPile,button,a2Place,a2Ballistic,a2Up,a2Cancel,
 reset(on,seat){
  A2.flying++;Object.assign(A2,{held:false,moved:false,petting:false,floor:0,fy:0,x:0,vx:0,vy:0,throws:0});
  button.style.setProperty('transition','none','important');a2Place();
  for(const [n,k] of Object.entries(clawdPile.test.K)){for(const t of k.timers)clearTimeout(t);k.timers.clear();k.el.getAnimations().forEach(a=>a.cancel());k.on=on[n]||[];k.x=n==='cowboy'?286:n==='shades'?400:480;k.mode='sleep';}
  if(on.wizard?.includes('shades'))clawdPile.test.K.shades.x=314;
  clawdPile.bigSat(null);clawdPile.restack();
  if(seat){const st=clawdPile.seats().find(s=>s.name===seat);A2.x=st.cx-(button.querySelector('.clawd-rig').getBoundingClientRect().left+24);A2.floor=A2.fy=-st.h;a2Place();clawdPile.bigSat(seat);}else a2Place();
 },state(){const name=clawdPile.test.bigOn;const r=name?clawdPile.test.K[name].el.getBoundingClientRect():null;return {fy:A2.fy,floor:A2.floor,held:A2.held,bigOn:name,seatGap:r?button.querySelector('.clawd-rig').getBoundingClientRect().left+24-r.left-16:0,on:Object.fromEntries(Object.entries(clawdPile.test.K).map(([n,k])=>[n,k.on])),tops:Object.fromEntries(Object.entries(clawdPile.test.K).map(([n,k])=>[n,k.el.getBoundingClientRect().top]))};}
 };
 `});
 const drag=async(name,dx=100,dy=-80,release=true)=>{
  const p=await page.evaluate(n=>{const r=test.clawdPile.test.K[n].el.getBoundingClientRect();return {x:r.left+10,y:r.bottom-2};},name);
  if(touch){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:7}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+dx,y:p.y+dy,id:7}]});
   if(release)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:3});if(release)await page.mouse.up();}
 };
 const scenarios=[
  {name:'direct',on:{},seat:'cowboy',remove:'cowboy',expected:null,height:0},
  {name:'direct-shades',on:{},seat:'shades',remove:'shades',expected:null,height:0},
  {name:'direct-wizard',on:{},seat:'wizard',remove:'wizard',expected:null,height:0},
  {name:'middle',on:{shades:['cowboy']},seat:'shades',remove:'cowboy',expected:'shades',height:14},
  {name:'top-of-small-stack',on:{shades:['cowboy']},seat:'shades',remove:'shades',expected:'cowboy',height:14},
  {name:'two-carriers',on:{wizard:['cowboy','shades']},seat:'wizard',remove:'cowboy',expected:'wizard',height:28},
  {name:'rider-on-big',on:{wizard:['big']},seat:'cowboy',remove:'cowboy',expected:null,height:0},
 ];
 for(const s of scenarios.filter(s=>!only||only.includes(s.name)))for(let i=0;i<repeats;i++){
  if(i===0)console.log(touch?'touch':'mouse',s.name);
  await page.evaluate(s=>test.reset(s.on,s.seat),s);await drag(s.remove,i%2?130:-130,-70);await page.waitForTimeout(450);
  const st=await page.evaluate(()=>test.state());
  results.push({platform:touch?'chromium-native-touch':'desktop-mouse',scenario:s.name,iteration:i,...st,pass:st.bigOn===s.expected&&st.floor===-s.height&&st.fy===st.floor&&Math.abs(st.seatGap)<=2});
  if(s.name!=='rider-on-big'){
   const p=await page.evaluate(n=>{const r=test.clawdPile.test.K[n].el.getBoundingClientRect(),b=test.button.querySelector('.clawd-rig').getBoundingClientRect();return {dx:b.left+24-6-(r.left+10),dy:b.top-12-(r.bottom-2)};},s.remove);
   await drag(s.remove,p.dx,p.dy);await page.waitForTimeout(450);
   const next=await page.evaluate(()=>test.state());
   results.push({platform:touch?'chromium-native-touch':'desktop-mouse',scenario:s.name+'-put-on-big',iteration:i,...next,pass:next.on[s.remove].includes('big')&&next.fy===-s.height});
  }
 }
 // Pick up and re-release a support between two animation frames: no frame observes 'held'.
 for(let i=0;i<(!only||only.includes('flight-fast-relocate')?repeats:0);i++){
  await page.evaluate(()=>{
   test.reset({},null);test.A2.fy=-110;test.a2Place();test.a2Ballistic(test.button,true);
   const el=test.clawdPile.test.K.cowboy.el,r=el.getBoundingClientRect(),x=r.left+10,y=r.bottom-2;
   for(const [type,dx,dy] of [['pointerdown',0,0],['pointermove',150,-70],['pointerup',150,-70]])el.dispatchEvent(new PointerEvent(type,{pointerId:8,pointerType:'touch',clientX:x+dx,clientY:y+dy,bubbles:true}));
  });
  await page.waitForTimeout(1500);const st=await page.evaluate(()=>test.state());
  results.push({platform:'same-frame-pointer-injection',scenario:'flight-fast-relocate',iteration:i,...st,pass:st.bigOn===null&&st.floor===0&&st.fy===0});
 }
 // Held/petting support loss must leave the gesture in control, then release into a real drop.
 for(const cancel of [false,true])for(let i=0;i<(!only||only.includes(cancel?'held-cancel':'pet-release')?repeats:0);i++){
  await page.evaluate(()=>{test.reset({},'cowboy');test.A2.held=true;test.A2.petting=true;test.A2.pointerId=99;});
  await drag('cowboy',130,-70);
  await page.evaluate(cancel=>{test[cancel?'a2Cancel':'a2Up'](test.button,{pointerId:99});},cancel);
  await page.waitForTimeout(1200);const st=await page.evaluate(()=>test.state());
  results.push({platform:touch?'chromium-native-touch':'desktop-mouse',scenario:cancel?'held-cancel':'pet-release',iteration:i,...st,pass:st.bigOn===null&&st.floor===0&&st.fy===0});
 }
 await context.close();
 }
 }finally{await browser.close();}
 const failed=results.filter(r=>!r.pass);
 console.log(JSON.stringify({baseline,total:results.length,failed:failed.length,byScenario:Object.fromEntries([...new Set(results.map(r=>r.scenario))].map(s=>[s,{total:results.filter(r=>r.scenario===s).length,failed:failed.filter(r=>r.scenario===s).length}])),firstFailures:failed.slice(0,3)},null,2));
 if(process.env.RESULT_FILE)fs.writeFileSync(process.env.RESULT_FILE,JSON.stringify(results,null,2));
 if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
