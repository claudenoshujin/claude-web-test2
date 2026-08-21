const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.js');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.version, '2.0.142');
assert.equal(manifest.js, 'loader-2.0.142.js');
assert.match(
  fs.readFileSync(path.join(root, manifest.js), 'utf8'),
  /index\.js\?v=2\.0\.142/,
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
assert.match(index, /usesNativeAndroidKeyboardLayout\(\)[\s\S]*removeProperty\(MOBILE_COMPOSER_TRANSLATE_PROPERTY\)/, 'Android must not receive a second keyboard translation');
assert.doesNotMatch(index, /function scheduleMobileComposerTranslate\(\) \{[\s\S]{0,300}?usesNativeAndroidKeyboardLayout\(\)[\s\S]{0,120}?return;/, 'Android scheduling must reach the stale-translation cleanup branch');
assert.match(index, /function ensureAndroidKeyboardPanAnchor\([^)]*\)[\s\S]*height:64px[\s\S]*pointer-events:none/, 'Via needs the inert 64px fixed pan anchor');
assert.match(index, /handleFocusIn[\s\S]*ensureAndroidKeyboardPanAnchor\(true\)/, 'Via cold start must remount the pan anchor before IME adjustPan');
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

console.log('✓ Claude Web 2.0.142 focused regressions passed');
