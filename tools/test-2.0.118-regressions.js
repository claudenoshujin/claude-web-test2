const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.js');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.version, '2.0.189');
assert.equal(manifest.js, 'loader-2.0.189.js');
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
assert.match(index, /html\[data-claude-mode\] body\.\$\{EXTERNAL_MODAL_OPEN_CLASS\} #top-settings-holder[\s\S]*z-index: 1 !important;/, 'full-screen extension modals must render above the Claude rail in generated compatibility CSS');
assert.match(index, /externalModalObserver = new hostWindow\.MutationObserver\(scheduleExternalSurfaceIsolation\)/, 'modal style changes must be observed without enabling global attribute observation');
assert.match(index, /rail\.style\.setProperty\('z-index', '1', 'important'\)/, 'modal rail fallback must beat important cascade layers');
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
assert.match(index, /root\.classList\.toggle\('claude-pm-open'/, 'index.js must keep html.claude-pm-open in sync');
assert.match(index, /root\.classList\.toggle\('claude-top-drawer-open'/, 'index.js must keep html.claude-top-drawer-open in sync');
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
assert.match(index, /root\.classList\.toggle\('claude-rail-reordered'/, 'index.js must detect inline order on rail items');
assert.match(index, /frame\.style\.setProperty\('color-scheme', scheme, 'important'\)/, 'iframe element and injected document must share one color-scheme, or Chrome paints the frame opaque white');
assert.match(index, /data-claude-side-swipe="off"\] body button\.\$\{LEFT_SWIPE_PROXY_CLASS\}/, 'side swipe arrows must be switchable off');
assert.match(officialLayout, /if \(!rail\) \{ shell\.classList\.toggle\('cw-v4-show-nav'\); return; \} railOver\(true\);/, 'phone settings ≡ must open the Claude sidebar (not the desktop category list) without closing the page first');
assert.match(officialCss, /body\[data-clawd-menu\] #top-settings-holder#top-settings-holder \.cw-v4-panel\.openDrawer:not\(\.closedDrawer\)\{transition:filter 180ms ease,z-index 0s!important;z-index:-1!important;filter:brightness\(\.8\)!important/, 'sidebar over an open settings page must slide over the page, not close it (closing restyles the whole page)');
assert.match(officialCss, /html\[data-claude-mode="compat"\]\[data-cw-v4-settings\] \.cw-v4-shell\{z-index:10061!important\}/, 'compat settings header must sit above the raised holder');

assert.match(officialCss, /html\.cw-v4-rail-over\[data-cw-v4\]\[data-cw-v4-settings\] body #top-settings-holder#top-settings-holder\{transition:left/, 'delayed rail z-index must only apply when the rail was opened over a settings page (otherwise a white strip is left on the settings header)');
assert.match(index, /if \(mobileViewportMetricsDirty\) applyMobileViewportMetrics\(\);/, 'refreshClawd must not force a layout read of the viewport on every DOM change');
assert.match(index, /if \(now - recentFetchedAt <= RECENT_FETCH_TTL\) return false;\s*const slot/, 'recents must check the TTL before forcing layout with getClientRects');
/* 2.0.172：酒馆 keyboard.js 监听 body 及后代的 class 变化并重扫子树；body 上的高频状态不能写 class，写了也要先比较。 */
for (const theme of ['day-mobile', 'night-mobile', 'compat-mobile-day', 'compat-mobile-night']) assert.doesNotMatch(fs.readFileSync(path.join(root, 'styles', theme + '.css'), 'utf8'), /clawd-mobile-menu-open/, theme + '.css: sidebar state is body[data-clawd-menu], not a class');
assert.doesNotMatch(index + officialLayout, /clawd-mobile-menu-open|MOBILE_MENU_OPEN_CLASS/, 'sidebar state must not be a body class (it triggers a full-page rescan in keyboard.js)');
assert.doesNotMatch(index, /hostDocument\.body\.classList\.toggle\((GENERATING_CLASS|WELCOME_CLASS|EXTERNAL_MODAL_OPEN_CLASS)/, 'per-refresh body class writes must go through setBodyClass');
assert.doesNotMatch(officialLayout, /doc\.body\.classList\.toggle\('cw-v4-(filled|group-chat)'/, 'per-keystroke / per-sync body class writes must go through setBodyClass');
assert.match(officialLayout, /isOpen\(old\) && !old\.classList\.contains\('pinnedOpen'\)\) nativeToggle\(old\)\?\.click\(\);\s*\},true\);/, 'switching pages from the sidebar must close the old drawer synchronously (otherwise SillyTavern waits animation_duration and the half-closed page shows over the sidebar)');
assert.match(officialCss, /\.drawer-content\.cw-v4-panel:not\(\.openDrawer\)\{visibility:hidden!important;transition:none!important\}/, 'closed v4 pages must hide at once instead of playing the 280ms drawer close animation');
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
assert.match(officialCss, /body\.clawd-mobile-layout #top-settings-holder \.clawd-rail-recents \.recentChat:is\(\.cw-current,\.cw-recent-menu-open\) \.cw-recent-more/, 'phone: ⋯ shows on the current chat (others long-press)');
console.log('✓ Claude Web 2.0.156 focused regressions passed');
