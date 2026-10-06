const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.js');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const themeCss = ['day-mobile.css','night-mobile.css'].map(n=>fs.readFileSync(path.join(root,'styles',n),'utf8')).join(String.fromCharCode(10));

assert.equal(manifest.version, '2.0.292');
assert.equal(manifest.js, 'loader-2.0.292.js');
assert.equal(manifest.loading_order, 101, 'the test build must load after an installed baseline copy and own the runtime singleton');
/* 版本号从 manifest 里读，不再写死 —— 写死的话每次升版都要记得改这里，
   而它是个带转义点的正则（2\.0\.155），全文搜 "2.0.155" 搜不到，
   升版脚本会漏掉它，然后测试以「loader 没有破缓存」的名义失败，
   看起来像 loader 坏了，其实只是断言过期了。2.0.156 就这么绊了一次。 */
assert.match(
  fs.readFileSync(path.join(root, manifest.js), 'utf8'),
  new RegExp('index\\.js\\?v=' + manifest.version.replace(/\./g, '\\.')),
  'loader must defeat Android WebView module cache',
);

assert.doesNotMatch(index, /function createUserActions\(/, 'the theme must not manufacture a replacement action bar');
assert.match(index, /#chat > \.mes \.extraMesButtons \{\s*display: none !important;/, 'message overflow actions must be folded by default');
assert.match(index, /#chat > \.mes \.extraMesButtons\.visible \{\s*display: flex !important;/, 'the native ellipsis must still expand the real actions');
assert.doesNotMatch(index, /#chat > \.mes\[is_user="true"\] \.mes_buttons \{\s*display: none !important;/, 'native user message actions must not be hidden');
assert.match(index, /> \.extraMesButtonsHint,[\s\S]*\.mes\[is_user="false"\][\s\S]*> \.mes_edit \{\s*display: inline-flex !important;/, 'ellipsis and assistant native edit actions must be restored explicitly');
assert.match(index, /function createUserEditAction\(message\)/, 'user edit proxy must be created outside TT\'s collapsed message header');
assert.doesNotMatch(index, /actions\.append\(edit, remove\)/, 'unsafe user quick-delete must stay removed');
assert.match(index, /\.mes_buttons:has\(> \.extraMesButtons\.visible\)[\s\S]*> \.extraMesButtonsHint \{\s*display: none !important;/, 'ellipsis must hide after opening overflow actions');
assert.match(index, /\.mes:has\(\.edit_textarea\) \.mes_buttons \{\s*display: none !important;/, 'normal actions must stay hidden while editing');
assert.ok(
  index.indexOf('.mes:has(.edit_textarea) .mes_buttons') > index.indexOf('#chat > .mes .extraMesButtons.visible'),
  'the edit-state exception must follow the action restore rule',
);

assert.match(index, /claudeQuoteBodyColor = CLAUDE_QUOTE_BODY_COLOR_ENABLED \? 'on' : 'off'/);
assert.match(index, /id="claude-web-quote-body-color"/);
assert.match(index, /data-claude-quote-body-color="on"[\s\S]*:is\(q,\.quote\)/);
assert.match(index, /next\.quote_text_color = next\.main_text_color/);

assert.match(index, /hostPageUnloading && !extensionMode/, 'extension pagehide must restore the previous theme');
assert.match(index, /const CHARACTER_MANAGER_SELECTOR = '#charManagerModal'/);
assert.match(index, /style\.setAttribute\('media', 'not all'\)/, 'Character Manager must suspend the full theme stylesheet');
assert.match(index, /restoreExternalThemeStyle\(\)/, 'suspended theme must have a cleanup path');
assert.match(index, /target\.closest\(CHARACTER_MANAGER_SELECTOR\)/, 'manager mutations must not refresh the entire chat');

assert.match(index, /prompt-manager-delete-action/);
assert.match(index, /\.caution\[title\*="delete" i\]/, 'current ST deletes selected prompts from the footer caution button');
assert.match(index, /completion_prompt_manager_footer[\s\S]*position: sticky !important/, 'Prompt Manager footer actions must remain reachable');
assert.match(index, /min-width: 104px !important/, 'mobile Prompt Manager controls need room for all actions');
assert.match(index, /#qr--bar #input_helper_toolbar[\s\S]*position: static !important;/, 'Quick Reply toolbar must remain in composer flow');
assert.match(index, /MOBILE_POPUP_HEIGHT_PROPERTY = '--cl-mobile-popup-height'/);
assert.match(index, /isSoftKeyboardTarget\(event\.target\)[\s\S]*MOBILE_POPUP_HEIGHT_PROPERTY/, 'popup height must be captured before keyboard resize');
assert.match(index, /#completion_prompt_manager_popup\.openDrawer[\s\S]*MOBILE_POPUP_HEIGHT_PROPERTY/);
assert.match(index, /#typing_indicator\.typing_indicator[\s\S]*visibility: visible !important/, 'official Typing Indicator must stay visible while generating');
assert.match(index, /function usesNativeAndroidKeyboardLayout\(\)/);
assert.match(index, /keyboard\.overlaysContent = true[\s\S]*virtualKeyboardOverlayActive = Boolean\(keyboard\.overlaysContent\)/, 'modern Android must use the real VirtualKeyboard inset instead of adjustPan centering');
assert.match(index, /if \(virtualKeyboardOverlayActive\)[\s\S]*ANDROID_KEYBOARD_PAN_ANCHOR_CLASS[\s\S]*remove\(\)/, 'the fallback pan anchor must be removed when VirtualKeyboard overlay succeeds');
assert.match(index, /usesNativeAndroidKeyboardLayout\(\)[\s\S]*removeProperty\(MOBILE_COMPOSER_TRANSLATE_PROPERTY\)/, 'Android must not receive a second keyboard translation');
assert.doesNotMatch(index, /function scheduleMobileComposerTranslate\(\) \{[\s\S]{0,300}?usesNativeAndroidKeyboardLayout\(\)[\s\S]{0,120}?return;/, 'Android scheduling must reach the stale-translation cleanup branch');
assert.match(index, /function ensureAndroidKeyboardPanAnchor\([^)]*\)[\s\S]*height:64px[\s\S]*pointer-events:none/, 'Via needs the inert 64px fixed pan anchor');
assert.match(index, /handleFocusIn[\s\S]*!virtualKeyboardOverlayActive\) ensureAndroidKeyboardPanAnchor\(true\)/, 'old Via builds may remount the fallback pan anchor only when overlay is unavailable');
assert.match(index, /ANDROID_KEYBOARD_PAN_ANCHOR_CLASS[\s\S]*forEach\(node => node\.remove\(\)\)/, 'the Android pan anchor must be removed on teardown');
assert.match(index, /userSettingsRowOne[\s\S]*grid-template-columns: minmax\(0,1fr\) minmax\(132px,1fr\)/, 'mobile settings header must use independent columns');
assert.match(index, /grid-template-columns: 26px minmax\(0,1fr\)/, 'Prompt Manager must reserve a dedicated icon column');
assert.match(index, /\.extraMesButtons\.visible[\s\S]*flex-wrap: wrap !important;/, 'expanded message actions need a wrapping panel');
assert.match(index, /> \.mes_button:not\(\.displayNone\):not\(\[hidden\]\):not\(\[style\*="display: none"\]\)/, 'available overflow actions must be restored instead of whitelisting two buttons');
assert.doesNotMatch(index, /linear-gradient\(currentColor, currentColor\)/, 'TT Prompt Manager handle must not retain the duplicate background glyph');
assert.match(index, /function refreshPromptManagerDragHandles\(\)/, 'TT Prompt Manager must restore omitted drag-handle nodes');
assert.match(index, /existingHandle && !existingHandle\.classList\.contains\(PROMPT_DRAG_HANDLE_CLASS\) && !isTauriTavernHost\(\)/, 'ST native drag handles must not be modified');
assert.match(index, /handle\.classList\.add\(PROMPT_DRAG_HANDLE_CLASS\);/, 'TT native or injected handle must receive the repair marker');
assert.match(index, /for \(let index = 0; index < 3; index \+= 1\)[\s\S]*const bar = hostDocument\.createElement\('span'\)/, 'TT drag handle must contain three real bar elements');
assert.match(index, /handle\.style\.setProperty[\s\S]*bar\.style\.setProperty/, 'TT drag handle must carry node-level priority styles');
assert.match(index, /EXTERNAL_MODAL_SELECTOR[\s\S]*modal-backdrop[\s\S]*popup_backdrop/, 'third-party full-screen modal detection must remain plugin-agnostic');
assert.doesNotMatch(index, /html\[data-claude-mode\] body\.\$\{EXTERNAL_MODAL_OPEN_CLASS\} #top-settings-holder \{/, '2.0.246: external modals are lifted above the rail instead of sinking the rail under the welcome page');
assert.match(index, /modal\.style\.setProperty\('z-index', '4100', 'important'\)/, 'full-screen extension modals are lifted above the Claude rail');
assert.match(index, /externalModalObserver = new hostWindow\.MutationObserver\(scheduleExternalSurfaceIsolation\)/, 'modal style changes must be observed without enabling global attribute observation');
assert.match(index, /function restoreExternalModalRailLayer\(\)/, 'closing a modal must restore the previous inline rail layer');
assert.match(index, /target\?\.closest\?\.\('#completion_prompt_manager_list'\)[\s\S]*refreshPromptManagerDragHandles\(\);/, 'reparented Prompt Manager list mutations still need the lightweight handle repair');
assert.match(index, /querySelectorAll\('#completion_prompt_manager_list > li\.completion_prompt_manager_prompt'\)/, 'TT popup reparenting must not break row discovery');
assert.match(index, /:is\(#completion_prompt_manager,#completion_prompt_manager_popup\) #completion_prompt_manager_list[\s\S]*li\.completion_prompt_manager_prompt:has\(> \.\$\{PROMPT_DRAG_HANDLE_CLASS\}\)[\s\S]*grid-template-columns: 28px minmax\(0,1fr\) auto auto/, 'TT popup grid rule must outrank the native double-id rule');
assert.match(index, /> \.drag-handle \{[\s\S]*position: static !important;[\s\S]*grid-column: 1 !important;/, 'TT handle must not overlap the prompt type icon');
assert.match(index, /HOST_DELETE_MODE_STYLESHEET_SUFFIX = '\/css\/toggle-dependent\.css'/, 'style cleanup must be restricted to the ST core stylesheet');
assert.match(index, /if \(!pathname\.endsWith\(HOST_DELETE_MODE_STYLESHEET_SUFFIX\)\) return false;/, 'third-party stylesheets must be rejected before selector matching');
assert.doesNotMatch(index, /const STYLE_ATTRIBUTE_SELECTOR_MARK = '\[style'/, 'global [style] rule deletion must not return');
assert.match(index, /MOBILE_REFRESH_MIN_GAP = 110/, 'mobile idle refreshes must be throttled for TT');
assert.match(index, /const COMPOSER_CLAWD_CLASS = 'clawd-composer-clawd'/, 'the large Clawd needs a composer-owned DOM identity');
assert.match(index, /const SIGNOFF_CLAWD_CLASS = 'clawd-message-signoff-clawd'/, 'the 2.0.135 small signoff Clawd needs its own DOM identity');
assert.match(index, /return clawdTracks\.C \|\| clawdTracks\.A \|\| clawdTracks\.B/, 'track precedence must stay C > A > B');
assert.match(index, /clawdTracks\.settledRound === round/, 'generation settlement must be fenced by round');
assert.match(index, /clawdRuntimeTimer = hostWindow\.setInterval\(clawdRuntimeTick, 200\)/, 'Clawd polling must use one runtime tick');
assert.doesNotMatch(index, /const (?:idleTimer|ccScanTimer|ccCheerTimer|ccWobbleTimer) = hostWindow\.setInterval/, 'legacy Clawd polling timers must stay removed');
assert.doesNotMatch(index, /clawd\.className = 'clawd-mobile-clawd-button'/, 'mobile chrome must not create a third Clawd');
assert.match(index, /html body #form_sheld,\s*html body #form_sheld :is\(#send_form, form\)/, 'composer shell must not clip Clawd above its upper edge');
assert.match(index, /inset: auto auto calc\(100% - 1px\) max\(18px, calc\(env\(safe-area-inset-left, 0px\) \+ 12px\)\) !important;/, 'migrated Clawd must be left-anchored, share the decorative Clawd baseline, and clear the phone safe area');
assert.doesNotMatch(index, /#send_form::after \{\s*content: none !important;/, 'the composer decorative Clawd must stay alive');
assert.doesNotMatch(index, /\$\{COMPOSER_CLAWD_CLASS\} \{[\s\S]{0,400}?width: 44px !important;/, 'migrated Clawd must not override the 2.0.135 hit box');
assert.match(index, /button\.\$\{BUTTON_CLASS\} \{[\s\S]*width: 42px !important;[\s\S]*height: 34px !important;/, 'desktop signoff hit box must keep the 2.0.135 size');
assert.match(index, /@media \(max-width: 700px\) \{[\s\S]*button\.\$\{BUTTON_CLASS\} \{[\s\S]*width: 38px !important;[\s\S]*height: 31px !important;/, 'mobile signoff hit box must keep the 2.0.135 size');
assert.doesNotMatch(index, /createButton\(settlePending, 'signoff'\)/, 'the latest assistant message must NOT get its own Clawd any more');
assert.doesNotMatch(index, /host\.append\(created\)/, 'no Clawd may be appended into .mes_text');
assert.match(index, /if \(button\.classList\.contains\(COMPOSER_CLAWD_CLASS\)\) return;\s*button\.remove\(\);/, 'every non-composer Clawd must be removed unconditionally');
assert.doesNotMatch(index, /data-claude-decorations="off"[^\n]*COMPOSER_CLAWD_CLASS/, 'the decorations toggle must not hide Clawd itself');
assert.match(index, /const clawdEnabled = hostDocument\.documentElement\.dataset\.claudeClawd !== 'off'/, 'the Clawd switch must own final node visibility');
assert.match(index, /COMPOSER_CLAWD_CLASS[\s\S]{0,900}?touch-action: none !important/, 'draggable Clawd must reject Android panning before pointerdown');
assert.match(index, /function a2Down[\s\S]*setClawdC\(A2\.fy < 0 \? 'grab' : 'press', 0\)/, 'pointerdown must give feedback immediately (pressed on the ground, grabbed in mid-air)');
assert.match(index, /function a2Move[\s\S]*?a2Place\(button\);/, 'the first drag writes the position straight away');
assert.doesNotMatch(index, /a2DeferGrabFeedback|createParticle|showCcToast/, 'old ::before-era bubbles and particles are gone; dragging must not read layout for them');

/* 2.0.160：主题里「按 class 子串匹配的祖先 + 后代」会让任何元素改 class 时整棵子树重算样式
   （body 上一改就是全页约 2 万个元素），点输入框弹键盘时明显卡顿。 */
for (const theme of ['day-pc', 'day-mobile', 'night-pc', 'night-mobile']) {
  const css = fs.readFileSync(path.join(root, 'styles', theme + '.css'), 'utf8');
  assert.doesNotMatch(css, /\[class\*=[^\]]+\]\)\s*\*/, theme + '.css: [class*=…] in an ancestor with a * subject invalidates whole subtrees on any class change');
}

/* 2.0.162：根节点 :has(弹层.openDrawer) 让聊天每次追加都重算整页样式，改由 index.js 在 <html> 上同步状态 class。 */
for (const theme of ['day-pc', 'day-mobile', 'night-pc', 'night-mobile', 'compat-day', 'compat-night', 'compat-mobile-day', 'compat-mobile-night']) {
  const css = fs.readFileSync(path.join(root, 'styles', theme + '.css'), 'utf8');
  assert.doesNotMatch(css, /:has\(\s*#(completion_prompt_manager_popup|top-settings-holder)\b/, theme + '.css: root :has() on popup/drawer state must stay replaced by claude-pm-open / claude-top-drawer-open');
}
/* 2.0.217：根节点标记改成 data 属性——主题里有 [class*=…] 选择器，改 <html> 的 class 会让整页重新匹配。 */
assert.match(index, /root\.toggleAttribute\('data-claude-pm-open'/, 'index.js must keep html[data-claude-pm-open] in sync');
assert.match(index, /root\.toggleAttribute\('data-claude-top-drawer-open'/, 'index.js must keep html[data-claude-top-drawer-open] in sync');
assert.doesNotMatch(index, /root\.classList\.toggle\('claude-(pm-open|top-drawer-open|rail-reordered)'/, 'root state markers must not be classes');
const officialLayout = fs.readFileSync(path.join(root, 'official-layout.js'), 'utf8');
assert.doesNotMatch(officialLayout, /send_textarea'\) syncChat\(\)/, 'typing must not run the full-chat syncChat() on every keystroke');

/* 2.0.163：手机界面对照 design v4 的几处修正。 */
const officialCss = fs.readFileSync(path.join(root, 'styles', 'official-layout.css'), 'utf8');
assert.match(officialCss, /body:not\(\.clawd-welcome\) #chat>\.mes\[is_user\] \.mesAvatarWrapper \.avatar[^{]*\{width:28px!important;height:28px!important;min-width:28px!important/, 'chat avatar must beat day-mobile.css 42px rule (it overlapped the name)');
assert.match(officialCss, /#top-settings-holder>\.clawd-mobile-new-chat\{position:absolute!important;left:auto!important;right:18px!important/, 'mobile New chat is a right-aligned pill in the account row, not a full-width bar');
assert.match(officialCss, /#completion_prompt_manager_popup\.openDrawer\{transform:none!important/, 'mobile prompt editor must clear the desktop translate(-50%,-50%)');
assert.match(officialCss, /\.cw-v4-pm-footer>\.cw-v4-as-btn\{[^}]*flex:0 0 auto!important/, 'prompt footer buttons must beat the 32px flex-basis so their labels do not overflow');

/* 2.0.164：侧栏兼容菜单精简器、设置页 ≡、正则 iframe 白边、两侧箭头开关。 */
assert.match(officialCss, /#top-settings-holder>\.clawd-rail-recents\{order:1000!important\}/, 'Recents must stay below any inline order written by Menu Cleaner');
assert.match(officialCss, /#top-settings-holder>\.drawer#persona-management-button\{order:1001!important\}/, 'account row must stay last even when Menu Cleaner reorders the rail');
assert.match(index, /root\.toggleAttribute\('data-claude-rail-reordered'/, 'index.js must detect inline order on rail items');
assert.match(index, /frame\.style\.setProperty\('color-scheme', scheme, 'important'\)/, 'iframe element and injected document must share one color-scheme, or Chrome paints the frame opaque white');
assert.match(index, /data-claude-side-swipe="off"\] body button\.\$\{LEFT_SWIPE_PROXY_CLASS\}/, 'side swipe arrows must be switchable off');
assert.match(officialLayout, /if \(!rail\) \{ shell\.classList\.toggle\('cw-v4-show-nav'\); return; \} if \(!doc\.body\.hasAttribute\('data-clawd-menu'\)\) rail\.click\(\); \}/, 'phone settings ≡ must open the Claude sidebar (not the desktop category list) without closing the page first');
assert.match(officialCss, /html\[data-claude-mode="compat"\]\[data-cw-v4-settings\] \.cw-v4-shell\{z-index:10061!important\}/, 'compat settings header must sit above the raised holder');

assert.match(index, /if \(mobileViewportMetricsDirty\) applyMobileViewportMetrics\(\);/, 'refreshClawd must not force a layout read of the viewport on every DOM change');
assert.match(index, /if \(now - recentFetchedAt <= RECENT_FETCH_TTL\) return false;\s*const slot/, 'recents must check the TTL before forcing layout with getClientRects');
/* 2.0.172：酒馆 keyboard.js 监听 body 及后代的 class 变化并重扫子树；body 上的高频状态不能写 class，写了也要先比较。 */
for (const theme of ['day-mobile', 'night-mobile', 'compat-mobile-day', 'compat-mobile-night']) assert.doesNotMatch(fs.readFileSync(path.join(root, 'styles', theme + '.css'), 'utf8'), /clawd-mobile-menu-open/, theme + '.css: sidebar state is body[data-clawd-menu], not a class');
assert.doesNotMatch(index + officialLayout, /clawd-mobile-menu-open|MOBILE_MENU_OPEN_CLASS/, 'sidebar state must not be a body class (it triggers a full-page rescan in keyboard.js)');
assert.doesNotMatch(index, /hostDocument\.body\.classList\.toggle\((GENERATING_CLASS|WELCOME_CLASS|EXTERNAL_MODAL_OPEN_CLASS)/, 'per-refresh body class writes must go through setBodyClass');
assert.doesNotMatch(officialLayout, /doc\.body\.classList\.toggle\('cw-v4-(filled|group-chat)'/, 'per-keystroke / per-sync body class writes must go through setBodyClass');
assert.match(officialLayout, /isOpen\(old\) && !old\.classList\.contains\('pinnedOpen'\)\) nativeToggle\(old\)\?\.click\(\);\s*\},true\);/, 'switching pages from the sidebar must close the old drawer synchronously (otherwise SillyTavern waits animation_duration and the half-closed page shows over the sidebar)');
assert.match(officialCss, /\.drawer-content\.cw-v4-panel:not\(\.openDrawer\)\{visibility:hidden!important;(content-visibility:hidden!important;)?transition:none!important\}/, 'closed v4 pages must hide at once instead of playing the 280ms drawer close animation');
assert.match(index, /\{ id: 'onFire', weight: 0\.5, cool: 900000 \}/, 'deadpan-on-fire idle clip: weight 0.5, 15 min cooldown');
assert.match(index, /\{ id: 'glowstick', weight: 0\.5, cool: 600000 \}/, 'one-hand glow stick idle clip: weight 0.5, 10 min cooldown');
assert.match(index, /\{ id: 'glowstick2', weight: 0\.5, cool: 600000 \}/, 'two-hand glow stick idle clip: weight 0.5, 10 min cooldown');
assert.match(index, /\{ id: 'rickroll', weight: 0\.3, cool: 300000 \}/, 'rickroll idle clip: weight 0.3, 5 min cooldown (Lulu)');
assert.match(index, /\{ id: 'siren', weight: 0\.25, cool: 900000 \}/, 'red siren idle clip: weight 0.25, 15 min cooldown');
assert.match(index, /\{ id: 'sirenBlue', weight: 0\.25, cool: 900000 \}/, 'blue siren idle clip: weight 0.25, 15 min cooldown');
assert.match(index, /sulk: \['sulk', 'rage'\]/, 'poke level 5 picks sulk or rage');
assert.match(index, /onFire: 'fade', siren: 'fade', sirenBlue: 'fade'/, 'fire and sirens fade out when interrupted');
assert.match(index, /glowstick: \['glowstick', 'glowstickPump'\],\s*glowstick2: \['glowstick2', 'glowstick2Pump', 'glowstick2Alt'\]/, 'glow stick picks a random cheering form each time');
assert.match(index, /const forms = CLAWD_RIG_FORMS\[id\];/, 'idle pool swaps the picked glow stick for a random form');
/* 消息「…」浮层（2026-09-29）：v4 下旧的白底多行卡片不再生效，由 official-layout.css 的单行灰条接管 */
assert.match(index, /html:not\(\[data-claude-mode="compat"\]\):not\(\[data-cw-v4\]\) body\.\$\{READY_CLASS\}\s*#chat > \.mes\[is_user="false"\] \.mes_buttons > \.extraMesButtons\.visible \{\s*position: absolute !important;/, 'the old floating card must be switched off under v4');
assert.match(officialCss, /\.extraMesButtons\.visible\{position:fixed!important;left:var\(--cw-more-x/, 'v4 popup is fixed and positioned from the … button');
assert.match(officialCss, /\.extraMesButtons\.visible\{position:fixed[^}]*opacity:1!important\}/, 'v4 popup is fully opaque (index.js dims every .mes_buttons child to .72)');
assert.match(officialCss, /\.extraMesButtons\.visible>\.mes_create_bookmark\{--cw-v4-mask:var\(--cw-v4-icon-flag\)\}/, 'v4 popup shows a checkpoint icon (the old theme turned it into a thumbs-up)');
assert.match(officialCss, /\.extraMesButtons\.visible>\.mes_create_branch\{--cw-v4-mask:var\(--cw-v4-icon-branch\)\}/, 'v4 popup shows a branch icon (the old theme turned it into a thumbs-down)');
assert.match(officialCss, /\.extraMesButtons\.visible>:is\(\.mes_translate,[^)]*\)::before\{content:""!important;[^}]*mask:var\(--cw-v4-mask\)/, 'native popup buttons use the design-v4 line icons, not solid Font Awesome glyphs');
assert.match(officialCss, /\.extraMesButtons\.visible>\*\{[^}]*order:0!important;[^}]*animation:none!important;/, 'v4 popup keeps ST\'s own button order and no theme nod animation');
assert.match(officialCss, /#chat>\.mes:not\(\[data-media-display="gallery"\]\) \.mes_buttons>\.extraMesButtons\.visible>\.mes_media_gallery/, 'v4 popup re-applies ST\'s own gallery/list hiding');
assert.doesNotMatch(officialCss, /#chat[^{]*\{[^}]*overflow:visible/, 'the popup must not change overflow on the chat area or messages');
assert.match(officialCss, /html\[data-cw-v4\] body #options>\.options-content>a,[^{]*\{(?![^}]*display:)[^}]*padding:8px 10px!important/, 'input menu items must not force display: ST hides some of them by state');
assert.match(officialCss, /:is\(#extensionsMenu,#options>\.options-content\)\{max-height:var\(--cw-v4-menu-maxh/, 'input menus are capped at the room above the buttons');
/* 近期对话「⋯」菜单（2026-09-29）：置顶 / 重命名 / 删除，走酒馆自己的接口 */
assert.match(index, /more\.className = 'cw-recent-more';/, 'each recent row gets a ⋯ button');
assert.match(index, /item\('pin', pinned \?/, 'the ⋯ menu offers pin / unpin');
assert.match(index, /main\.renameGroupOrCharacterChat\(\{ characterId: String\(index\), oldFileName: oldName, newFileName: newName, loader: false \}\)/, 'rename goes through ST\'s own renameGroupOrCharacterChat');
assert.match(index, /writeAccountStorage\(PINNED_CHATS_KEY, state\)/, 'pin writes ST\'s own pinnedChats account storage key');
assert.match(officialCss, /body\.clawd-mobile-layout #top-settings-holder \.clawd-rail-recents \.recentChat \.cw-recent-more\{opacity:1;pointer-events:auto\}/, 'phone: ⋯ shows on every recent row');
assert.match(officialCss, /:is\(#options,#extensionsMenu\) :is\(\.fa-note-sticky\)\{--cw-fa-line:var\(--cw-v4-icon-note\)\}/, 'input menus map Font Awesome solid icons to design-v4 line icons');
assert.match(officialCss, /#persona-management-button \.clawd-user-meta\{display:flex!important/, 'phone bottom row keeps the user name and plan');
/* 2.0.190 把一条两段选择器的规则改坏过：第一段后面剩个逗号，粘到了下一条规则上，电脑端悬停时日期不隐藏、被「⋯」盖住 */
assert.doesNotMatch(officialCss, /,\s*\n\s*\/\*/, 'no selector list may end in a dangling comma before a comment');
assert.match(officialCss, /\.recentChat:is\(:hover,:focus-within,\.cw-recent-menu-open\) \.chatDate\{visibility:hidden!important\}/, 'desktop: the date hides while ⋯ shows');
assert.match(index, /b\.title = label;\s*b\.setAttribute\('aria-label', label\);/, 'recent-chat actions are an icon-only strip (label in title)');
assert.match(index, /target\.closest\('\.deleteChat, \.deleteChatButton, \.chatActions'\)/, 'phone: tapping ⋯ must not close the sidebar');
/* 手机侧栏（2.0.208，Lulu 定：照 Claude 手机版的推开式）：侧栏固定不动，页面往右推开；点入口先原地换页，画好后页面滑回 */
assert.match(index, /else showPanelFromRail\(panel\);/, 'phone: a settings entry switches the page in place, then slides it back over the rail');
assert.match(index, /mobileNavActivating = true;\s*try \{ hostWindow\.__claudeOfficialLayout\?\.activate\(panel\.id\); \} finally \{ mobileNavActivating = false; \}/, 'activate (old page closed first) avoids the SillyTavern animation_duration gap');
assert.match(index, /if \(mobileNavActivating \|\| !target/, 'the activate clicks are not treated as a tap that closes the rail');
assert.match(index, /token !== mobileMenuCloseToken \|\| !isMobileMenuOpen\(\)/, 'reopening or closing the rail while waiting cancels the pending close');
assert.doesNotMatch(index, /clawd-mobile-page-base/, 'no blank loading layer replaces the old view');
assert.doesNotMatch(officialCss + index + officialLayout, /cw-v4-rail-(over|snap|leave)|closeMobileMenuAfterPanel|openPanelAfterMobileMenu|preparePanel|cw-v4-retained|brightness\(\.8\)/, 'the overlay rail, dimming and retained-page handoff are gone');
assert.match(officialCss, /html\[data-cw-push\]\[data-cw-v4\] body\[data-clawd-menu\] :is\(#sheld,#top-bar,\.clawd-mobile-menu-button,\.cw-v4-temporary,\.cw-v4-shell\),\nhtml\[data-cw-push\]\[data-cw-v4\] body\[data-clawd-menu\] #top-settings-holder#top-settings-holder>\.drawer>\.drawer-content\.cw-v4-panel\.cw-v4-panel\.cw-v4-panel\{translate:var\(--cw-rail-w\) 0\}/, 'the page layers (not the rail) move when the rail opens');
assert.match(officialCss, /html\[data-cw-push\]\[data-cw-v4\] body #top-settings-holder#top-settings-holder\{left:0!important\}/, 'the rail itself never slides: it is parked at 0 only while the push is live');
/* 2.0.208：推开滑动要由合成器跑——静止值 0 0（不是 none）、translate 不带 !important、开关用 html 的 data 属性不用 class */
assert.match(officialCss, /\{translate:0px 0px;transition:translate var\(--cw-push\)!important\}/, 'push layers rest at translate 0 0 while live, so the slide is same-typed and composited');
assert.doesNotMatch(officialCss, /translate:var\(--cw-rail-w\) 0!important|translate:0px 0px!important/, 'an !important translate cannot be composited (AffectsImportantProperty)');
assert.doesNotMatch(themeCss, /translate:none !important/, 'theme drawer rules must not pin translate with !important');
assert.match(index, /root\.setAttribute\(PUSH_LIVE_ATTRIBUTE, ''\);\s*void hostWindow\.getComputedStyle\(hostDocument\.body\)\.translate;\s*\}\s*hostDocument\.body\.setAttribute\(MOBILE_MENU_ATTRIBUTE, 'open'\);/, 'arm the push layers and flush style before opening');
assert.doesNotMatch(officialCss + index, /cw-push-live/, 'html class changes re-match every [class*=] selector; use the data attribute');
assert.doesNotMatch(officialCss.slice(officialCss.indexOf('2.0.208 手机侧栏改成推开式')), /#top-settings-holder#top-settings-holder\{[^}]*visibility:/, 'the rail container never toggles visibility (inherited: restyles the whole open settings page)');
assert.match(officialCss, /\.clawd-mobile-scrim\.clawd-mobile-scrim\{background:transparent!important;transition:none!important\}/, 'the pushed page is not dimmed');
assert.match(officialCss, /html\[data-cw-v4\]\[data-claude-palette="anthropic-light"\]\{--cw-paper-0:#f9f9f7!important/, 'official light palette: whiter page on phones');
assert.match(officialCss, /html\[data-cw-v4\]\[data-claude-palette="anthropic-light"\] body #top-settings-holder#top-settings-holder\{background:#f3f3f1!important\}/, 'official light palette: neutral grey rail on phones');
assert.match(index, /root\.dataset\.claudePalette = id;/, 'the active palette id is exposed for CSS');
/* 2.0.208 设置页照第五稿（design-v5.html）：卡片 = 分区（分组名留在分区里，白底用 ::before 从分组名下面画起，避开 content-visibility 的裁切）、
   卡片式页顶上留缝、FA 实心图标换线性图标、电脑下拉框无框 */
assert.match(officialCss, /\.cw-v4-section\.cw-v4-section::before\{content:"";position:absolute;top:var\(--m-top\);left:0;right:0;bottom:0;background:var\(--m-card\);border-radius:12px;z-index:-1/, 'phone: each section is a white rounded card drawn under its label');
assert.doesNotMatch(officialCss, /\.cw-v4-section\.cw-v4-section>h2\{position:absolute/, 'labels must stay inside the section (content-visibility clips anything drawn outside it)');
/* 2.0.209（Lulu）：设置页是全屏抽屉页、不留缝；缝给编辑弹窗（弹出页）；偏好设置不要「外观」这类大标题；弹窗放在行外面 */
assert.doesNotMatch(officialCss, /\.cw-v4-shell\.cw-v4-shell\{top:var\(--cw-sheet-gap\)/, 'phone: settings page is full screen, no sheet gap');
assert.match(officialCss, /dialog\.cw-v4-editor\.cw-v4-editor\{position:fixed!important;inset:var\(--cw-sheet-gap\) 0 0 0!important/, 'phone: editor popup is a sheet below the gap');
assert.match(officialCss, /#user-settings-block :is\(\.cw-v4-pref-title,\.cw-v4-lede\)\{display:none!important\}/, 'phone: no big preference page headings');
assert.match(officialLayout, /let place = host \|\| anchor;[\s\S]{0,200}details:not\(\[open\]\)[\s\S]{0,200}place\.after\(dialog\)/, 'editor dialog is inserted outside our row wrapper (and outside closed <details>) so row-type rules do not reach it');
assert.match(officialCss, /:is\([^)]*\.fa-save,\.fa-floppy-disk,[^)]*\)::before\{content:""!important/, 'Font Awesome glyphs in settings pages are replaced by line icons');
const iconSource = fs.readFileSync(path.join(root, 'official-icons.js'), 'utf8');
for (const name of ['key', 'link', 'star', 'tag', 'lock', 'help', 'alert', 'userplus', 'folderplus', 'updown', 'filterx']) assert.match(iconSource, new RegExp(`"${name}":`), `line icon ${name} exists`);
assert.match(officialCss, /@media\(min-width:701px\)\{\nhtml\[data-cw-v4\]\[data-cw-v4\]\{--v4-row-line:#f0efed\}/, 'desktop: lighter row hairlines');
/* 2.0.208 第六稿落地：official-layout.js 给行打类型（actions / nav / selact），手机 CSS 按类型排；电脑导航分组 对话/内容/界面/偏好设置 */
assert.match(officialLayout, /function tagRows\(panel\)/, 'rows are tagged by control type');
assert.match(officialLayout, /if \(mobile\(\)\) tagRows\(p\);/, 'tagging runs on phones only');
assert.match(officialLayout, /!k\.matches\('\[id\^=lock_\],\[role=switch\],\[aria-pressed\]'\)/, 'switch-like persona buttons stay switches');
assert.match(officialLayout, /\[\['对话',\[0,1,2\]\],\['内容',\[3,6,7\]\],\['界面',\[4,5\]\]\]/, 'desktop nav grouped as in design-v6');
assert.match(officialCss, /\[data-cw-kind=actions\]\[data-cw-many\]>\.cw-v4-row-info/, 'button-group rows hide the enumerating description only when there are several buttons');
assert.match(officialCss, /\[data-cw-kind=nav\] \[data-cw-generic\]\{color:transparent!important\}/, 'single-button rows show a chevron, not a generic label');
assert.match(officialCss, /\[data-cw-kind=selact\]>:is\(\.cw-v4-row-controls,\.cw-v4-api-controls\)\{display:contents!important\}/, 'select + save: save moves to its own row');
assert.match(iconSource, /"puzzle":"<path d=\\"M5 8\.5h3\.3a2\.2/, 'puzzle icon from design-v6');
/* 2.0.210：酒馆自己的编辑弹窗（提示词编辑、宽 / 大 Popup）也从底下升起；扩展页无标题操作行不空一截；提示词 token 数单独一格 */
assert.match(officialCss, /@keyframes cw-sheet-up\{from\{translate:0 100%\}to\{translate:0 0\}\}/, 'phone sheets slide up');
assert.match(officialCss, /#completion_prompt_manager_popup#completion_prompt_manager_popup\.openDrawer\{inset:var\(--cw-sheet-gap\) 0 auto 0!important/, 'prompt manager editor is a sheet');
assert.match(officialCss, /dialog\.popup\.popup:is\(\.wide_dialogue_popup,\.wider_dialogue_popup,\.large_dialogue_popup\):not\(\.cw-v4-editor\):not\(\.transparent_dialogue_popup\)\[opening\]\{animation:cw-sheet-up/, 'large ST popups slide up (the transparent loading splash is not a sheet)');
assert.match(officialLayout, /dialog\.setAttribute\('data-cw-closing', ''\)/, 'our editor slides down before closing on phones');
assert.match(officialCss, /\.prompt_manager_prompt_tokens\{grid-column:3!important;grid-row:1!important/, 'prompt token count has its own column');
/* 2.0.211：showModal 的 <dialog> 不算外部全屏弹窗（否则侧栏容器降到 1，设置页沉到聊天页下面，关弹窗时露出欢迎页）；
   手机弹出页：缝 52px、「‹ 上一页」、不要 × 和完成、白色卡片；下滑时遮罩用单独的淡出动画 */
assert.match(index, /if \(element\.matches\('dialog:modal'\)\) return false;/, 'top-layer modal dialogs do not lower the settings layer');
assert.match(officialLayout, /'cw-v4-button cw-v4-editor-back'/, 'phone editor has a back button named after the previous page');
assert.match(officialCss, /html\[data-cw-v4\]\{--cw-sheet-gap:52px\}/, 'phone sheet gap is 52px');
assert.match(officialCss, /html\[data-cw-v4\]\[data-cw-sheet\] body>\.cw-sheet-dim\{opacity:\.2;animation:cw-dim-in var\(--cw-sheet-dur\) var\(--cw-sheet-curve\)\}/, 'the page behind a sheet dims with the same timing as the sheet (2.0.213: a real element with rounded corners)');
/* 2.0.212：弹出页后面那页往后往上缩小（不再画假的手机顶部）；提示词编辑页收起时不露出主题的居中卡片；顶栏 ‹ 预设 / 保存 */
assert.doesNotMatch(officialCss, /radial-gradient\(circle at 100% 100%/, 'no painted fake phone top');
assert.match(officialCss, /html\[data-cw-v4\]\[data-cw-sheet\] body\{scale:var\(--cw-back-s\)/, 'the page behind a sheet scales back');
assert.match(officialCss, /#completion_prompt_manager_popup#completion_prompt_manager_popup\[data-cw-closing\]:not\(\.openDrawer\)\{display:block!important/, 'prompt editor stays a sheet until its slide-down finishes');
assert.match(officialLayout, /function syncSheet\(\)/, 'sheet state is tracked on <html>');
assert.match(officialLayout, /function decoratePromptPopup\(pm\)/, 'prompt editor gets a back / save header');
/* 2.0.213（Lulu：都照 App）：升起 / 收起、后面那页缩放、压暗同一时长同一曲线；往下拖关闭；弹出页套弹出页；酒馆大弹窗顶栏 + 管理扩展照 App 排 */
assert.match(officialCss, /html\[data-cw-v4\]\{--cw-sheet-dur:.28s;--cw-sheet-curve:cubic-bezier\(\.32,\.72,0,1\)\}/, 'one duration and curve for every sheet motion');
assert.doesNotMatch(officialCss.slice(officialCss.indexOf('⑤ 2.0.209')), /animation:cw-sheet-(up|down) \.\d+s/, 'no sheet animation with its own hard-coded duration');
assert.match(officialCss, /html\[data-cw-v4\]\[data-cw-sheet-anim\] body\{transition:scale var\(--cw-sheet-dur\) var\(--cw-sheet-curve\)/, 'the page behind scales with the sheet timing');
assert.match(officialLayout, /function sheetDrag\(el, handle, close\)/, 'sheets can be dragged down to close');
assert.match(officialLayout, /el\.toggleAttribute\('data-cw-sheet-under'/, 'a sheet under another sheet pushes back');
assert.match(officialLayout, /function decorateStPopup\(dlg\)/, 'large ST popups get the sheet header');
assert.match(officialCss, /:is\(dialog,#cw-spec\)\.cw-st-sheet \.extensions_info \.extension_toggle>input\[type=checkbox\]:checked/, 'extension manager toggles are switches (ID-weighted selector beats the theme popup button rule)');
/* 2.0.214（Lulu：取色器打不开、顶上 / 左边白边、编辑页没照 HTML）：取色面板不被裁、往左展开；提示词编辑页搬进最上层 dialog；编辑页照 design-sheet-v1 */
assert.match(officialCss, /:is\(\.cw-v4-section,\.cw-v4-row\):has\(toolcool-color-picker\)\{content-visibility:visible!important/, 'rows with a color picker are not paint-clipped');
assert.doesNotMatch(officialCss, />toolcool-color-picker\{[^}]*overflow:hidden/, 'the color picker host must not clip its popup');
assert.match(officialLayout, /c\.setAttribute\('popup-position', 'right'\)/, 'color picker opens towards the left (the swatch is at the right edge)');
assert.match(officialLayout, /function hostPm\(pm\)/, 'prompt editor is hosted in a top-layer dialog on phones');
assert.doesNotMatch(officialCss, /claude-pm-open body\{overflow:visible/, 'body keeps clipping while the prompt editor is open (no off-screen rail leaking in)');
assert.match(officialCss, /#completion_prompt_manager_depth_block,#completion_prompt_manager_order_block\)\[style\*="visibility: hidden"\]\{display:none!important\}/, 'hidden depth / order blocks take no space');
assert.match(officialCss, /dialog\.cw-v4-editor #claude-web-settings \.claude-web-field>select\{grid-column:2/, 'Claude Web settings rows put the value on the right like the app');
assert.match(officialLayout, /#claude-web-colors>summary'\)/, 'custom colors open as a nested sheet');
/* 2.0.215（Lulu）：设置里点角色 = 进入编辑，不再强制进聊天；开始聊天放进 ⋯ */
const drawersSrc = fs.readFileSync(path.join(root, 'official-drawers.js'), 'utf8');
assert.match(drawersSrc, /e\.stopPropagation\(\);select\(true\)\.catch\(console\.error\);\};/, 'tapping a character row opens its editor');
assert.match(drawersSrc, /\['开始聊天',null,false,\(\)=>select\(false\)/, 'start chat lives in the row menu');
/* 2.0.216（Lulu：角色卡头像 / 筛选图标没对齐）：列表类分区里的原生行和工具条补 16px；「其他设置」做成一行 */
assert.match(officialCss, /:is\(#rm_print_characters_block \.character_select,#user_avatar_block \.avatar-container\)\{padding-left:16px!important;padding-right:16px!important\}/, 'character and persona rows align with the card padding');
assert.match(officialCss, /\.cw-v4-entries :is\(\.rm_tag_controls,\.completion_prompt_manager_footer\)\{padding-left:16px!important/, 'tag filters and the prompt list toolbar align with the card padding');
assert.match(officialCss, /\.cw-v4-leftovers>button\.cw-v4-button::before\{content:attr\(title\)/, 'leftover settings show as a 其他设置 row');
/* 2.0.217（Lulu：提示词编辑页打开有点慢）：popover 代替 showModal（不让整页 inert）、跳过酒馆的 jQuery 滑动、根节点标记不用 class */
assert.match(officialLayout, /const canPopover = typeof win\.HTMLElement\.prototype\.showPopover === 'function';/, 'prompt editor uses a popover when available');
assert.match(officialLayout, /win\.jQuery\?\.\(pm\)\.stop\(true, true\)/, 'ST slideDown / slideUp on the prompt editor is finished at once on phones');
assert.match(officialLayout, /doc\.addEventListener\('keydown', pmEsc, true\)/, 'Escape still closes the prompt editor without a modal focus trap');
assert.match(index, /if \(hostDocument\.documentElement\.hasAttribute\('data-cw-v4-settings'\)\) return;/, 'Clawd eye tracking pauses while settings are open');
for (const f of ['day-mobile.css','night-mobile.css','compat-mobile-day.css','compat-mobile-night.css']) assert.doesNotMatch(fs.readFileSync(path.join(root, 'styles', f), 'utf8'), /\.claude-(pm-open|top-drawer-open)\b/, f + ': root markers are data attributes now');
/* 2.0.218（Lulu：showModal 有没有别的办法）：手机弹出页 show()+showPopover() 进最上层 + 透明挡板 + 自己接 Escape；设置页 sync 不再每帧自激 */
assert.match(officialLayout, /win\.HTMLDialogElement\.prototype\.showModal = function \(\) \{ (?:tagDanger\(this\); )?if \(liftable\(this\)\) return liftDialog\(this\);/, 'phone sheet dialogs are lifted without showModal');
assert.match(officialLayout, /function shieldUp\(\)/, 'a shield under lifted sheets blocks taps on the page behind');
assert.match(index, /element\.matches\(':popover-open,\[data-cw-lifted\]'\)/, 'lifted sheets are not treated as external fullscreen modals');
assert.match(officialLayout, /if \(panel\.classList\.contains\('cw-v4-inactive'\) !== off\) panel\.classList\.toggle\('cw-v4-inactive', off\);/, 'sync only writes panel classes when they change (no per-frame self-triggering loop)');
assert.match(drawersSrc, /if\(!panel\.classList\.contains\('cw-v4-extension-page'\)\)panel\.classList\.add\('cw-v4-extension-page'\);/, 'extensions page class is not rewritten on every sync');
assert.match(officialCss, /@media\(min-width:701px\)\{html\[data-cw-v4\] body #top-settings-holder#top-settings-holder \.cw-v4-editor>\.cw-v4-editor-head>\.cw-v4-editor-back\{display:none!important\}\}/, 'desktop editor dialog has no phone back button');
/* 2.0.219（Lulu：点扩展的设置，扩展页自己跳；点「管理」按钮往右挪）*/
assert.match(officialLayout, /if \(!d\.open\) d\.setAttribute\('open', ''\);/, 'lifted sheets open without show() (its autofocus scrolls the settings panel)');
assert.doesNotMatch(officialLayout, /nativeShow\.call/, 'no dialog.show() on lifted sheets');
assert.match(officialLayout, /\(node\.matches\('textarea'\) \? node : mobile\(\) \? back : close\)\.focus\(\{preventScroll: true\}\)/, 'editor focus never scrolls the panel');
assert.match(officialCss, /:is\(button,\.menu_button,\.inline-drawer-toggle,\.icon-button\):active\{transform:none!important\}/, 'no press-shrink on buttons inside settings pages and sheets');
/* 2.0.220（Lulu：管理扩展升起时快到顶停一下再到；动画改 0.28 秒） */
assert.match(officialCss, /:not\(\.transparent_dialogue_popup\):is\(\[opening\],\[closing\]\)::backdrop\{animation:none!important\}/, 'ST backdrop fade must not end our sheet animation early');
assert.match(officialLayout, /const SHEET_MS = 280,/, 'JS sheet timing matches the 0.28s CSS duration');
/* 2.0.221（Lulu：打开某个扩展的设置，它那一行从列表里消失） */
assert.match(officialLayout, /const standRow = node\.querySelector\?\.\(':scope>\.cw-v4-extension-row'\);/, 'an inert copy of the extension row stays in the list while its block is in the sheet');
assert.match(officialLayout, /anchor\.replaceWith\(node\);\n\s*standIn\?\.remove\(\);/, 'the stand-in row is removed when the real block comes back');
/* 2.0.241（Lulu：下拉里选一项，整个设置自动关掉）：列表挂在 body 上，酒馆 html 的 mousedown 当成点了抽屉外面 */
assert.match(officialLayout, /for \(const t of \['mousedown', 'touchstart'\]\) m\.addEventListener\(t, e => e\.stopPropagation\(\), \{passive: true\}\);/, 'the dropdown menu keeps mousedown/touchstart from reaching the tavern outside-click drawer closer');
/* 2.0.243（Lulu：换成 Kemini 预设，它自带的配置窗口一点，设置就关了） */
assert.match(officialLayout, /if \(t instanceof win\.Element && !t\.closest\('#top-settings-holder'\)\) e\.stopPropagation\(\);/, 'desktop settings: presses on overlays outside #top-settings-holder do not reach the tavern outside-click drawer closer');
/* 2.0.244（Lulu：Kemini 预设的全屏配置窗口一出来，设置沉到主页下面）：设置开着时不降侧栏，改抬外部窗口 */
assert.match(index, /restoreExternalModalRailLayer\(\);\n\s*liftExternalModals\(modalOpen \? modals : \[\]\);/, 'external full-screen windows are lifted; the rail (and the settings inside it) is never lowered (2.0.246: sidebar vanished on the welcome page)');
assert.doesNotMatch(index, /rail\.style\.setProperty\('z-index', '1', 'important'\)/, 'the rail is no longer pushed down to z-index 1 for external windows');
assert.match(index, /externalModalObserver\.observe\(hostDocument\.documentElement, \{ attributes: true, attributeFilter: \['data-cw-v4-settings'\] \}\);/, 'opening / closing settings re-runs the rail layer sync');
/* 2.0.249（Lulu：欢迎页快速切换角色后，主页和聊天混在一起 / 开场白像是丢了）：v4 的用户消息规则不能在欢迎页生效 */
assert.ok(officialCss.includes('html[data-cw-v4] body:not(.clawd-welcome) #chat>.mes[is_user="true"] {display:flex!important;'), 'the v4 user-message display rule must not apply on the welcome page');
assert.doesNotMatch(officialCss, /html\[data-cw-v4\] body #chat>\.mes\[is_user="true"\] \{display:flex/, 'no unscoped v4 rule may un-hide user messages on the welcome page');
/* 2.0.250（Lulu：重 Roll 时在生成中点停止，会再 Roll 一次）：生成开始过就不再兜底点原生「→」 */
assert.match(index, /if \(swipeChanged \|\| generationRan\(\)\) return true;/, 'a reroll whose generation started (even if stopped) must not fall back to the native swipe_right');
assert.match(index, /const onStartCount = \(_type, _options, dryRun\) => \{ if \(!dryRun\) generationStartSeq \+= 1; \};/, 'generation starts are counted (dry runs excluded)');
console.log('✓ Claude Web 2.0.156 focused regressions passed');
