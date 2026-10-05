const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
function fn(name) {
  const start = src.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  return src.slice(start, src.indexOf('\n  }', start) + 4);
}
const dom = new JSDOM('<body><form id="send_form"><button class="composer"></button></form><span class="clr-ghost-host"><span id="layer"></span></span></body>');
const doc = dom.window.document;
const button = doc.querySelector('button');
const ctx = { hostWindow: dom.window, hostDocument: doc, console,
  CHARACTER_MANAGER_SELECTOR: '.character-manager',
  externalStyleMutationIsIrrelevant: () => false, refreshStats: {},
  classMutationIsCosmetic: () => false, isTypingActive: () => false,
  scheduleMobileComposerInset() {}, composerClawd: () => button,
  clawdTracks: { A: null, B: 'idle', C: null, bUntil: 0 },
  idleAsleep: false, ccSleeping: false, ccDrowsy: false, neglected: false,
};
const start = src.indexOf('  const OWNED_MUTATION_SELECTOR =');
const owned = src.slice(start, src.indexOf("].join(',');", start) + 12);
for (const m of owned.matchAll(/\$\{(\w+)\}/g)) ctx[m[1]] = m[1].toLowerCase();
vm.createContext(ctx);
vm.runInContext(owned + '\n' + ['nodeBelongsToClawd', 'mutationNeedsFullRefresh',
  'setClawdB', 'syncClawdBState', 'ensureComposerClawd'].map(fn).join('\n'), ctx);
const host = doc.querySelector('.clr-ghost-host');
const layer = doc.querySelector('#layer');
const record = (target, addedNodes, removedNodes) => ({type: 'childList', target, addedNodes, removedNodes});
assert.equal(ctx.mutationNeedsFullRefresh(record(host, [layer], [])), false);
layer.remove();
assert.equal(ctx.mutationNeedsFullRefresh(record(host, [], [layer])), false);
assert.equal(ctx.mutationNeedsFullRefresh(record(doc.body, [host], [])), false);
assert.equal(ctx.mutationNeedsFullRefresh(record(doc.body, [doc.createElement('article')], [])), true);
let renders = 0;
ctx.renderClawdTracks = () => renders++;
ctx.ensureComposerClawd();
assert.equal(renders, 1);
ctx.clawdTracks.bUntil = Date.now() + 5000;
renders = 0;
ctx.ensureComposerClawd();
assert.equal(renders, 1, 'active ambient state also renders once');

// Repeated unchanged renders must not emit attribute mutations; changed state must update.
Object.assign(ctx, { COMPOSER_CLAWD_CLASS: 'composer', clawdVisualNodes: () => [button],
  clawdVisibleState: () => ctx.clawdTracks.C || ctx.clawdTracks.A || ctx.clawdTracks.B,
  syncClawdRig() {} });
vm.runInContext(fn('renderClawdTracks'), ctx);
ctx.renderClawdTracks();
const observer = new dom.window.MutationObserver(() => {});
observer.observe(button, {attributes: true});
ctx.renderClawdTracks();
assert.equal(observer.takeRecords().length, 0);
ctx.clawdTracks.A = 'think';
ctx.renderClawdTracks();
assert.equal(button.dataset.clawdA, 'think');
assert.ok(observer.takeRecords().length > 0);
observer.disconnect();

// Both scheduler types and active ghost animations are cancelled on teardown.
let timeoutCancels = 0, idleCancels = 0, animationCancels = 0;
ctx.hostWindow = { clearTimeout: () => timeoutCancels++, cancelIdleCallback: () => idleCancels++ };
vm.runInContext('let clawdRigPrewarmTimer = 12, clawdRigPrewarmIsIdle = true;\n'
  + 'let clawdRigGhostHost = hostDocument.querySelector(".clr-ghost-host"), clawdRigSnap = {};\n'
  + 'const clawdRigGhostJobs = new Map();\n' + fn('removeClawdRigGhost') + '\n' + fn('cleanupClawdRigEffects'), ctx);
ctx.animation = {cancel: () => animationCancels++};
vm.runInContext('const layer = hostDocument.createElement("span"); clawdRigGhostHost.append(layer);'
  + 'clawdRigGhostJobs.set(layer, {timer: 13, animations: [animation]});', ctx);
ctx.cleanupClawdRigEffects();
assert.equal(idleCancels, 1);
assert.equal(timeoutCancels, 1);
assert.equal(animationCancels, 1);
assert.equal(doc.querySelector('.clr-ghost-host'), null);
assert.equal(vm.runInContext('clawdRigGhostJobs.size', ctx), 0);
vm.runInContext('clawdRigPrewarmTimer = 14; clawdRigPrewarmIsIdle = false;', ctx);
ctx.cleanupClawdRigEffects();
ctx.cleanupClawdRigEffects();
assert.equal(timeoutCancels, 2);
dom.window.close();
console.log('Clawd render/lifecycle regressions passed');
