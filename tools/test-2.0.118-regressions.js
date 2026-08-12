const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.js');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.version, '2.0.119');
assert.equal(manifest.js, 'loader-2.0.119.js');
assert.match(
  fs.readFileSync(path.join(root, manifest.js), 'utf8'),
  /index\.js\?v=2\.0\.119/,
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
assert.match(index, /userSettingsRowOne[\s\S]*grid-template-columns: minmax\(0,1fr\) minmax\(132px,1fr\)/, 'mobile settings header must use independent columns');
assert.match(index, /grid-template-columns: 26px minmax\(0,1fr\)/, 'Prompt Manager must reserve a dedicated icon column');
assert.match(index, /MOBILE_REFRESH_MIN_GAP = 110/, 'mobile idle refreshes must be throttled for TT');

console.log('✓ Claude Web 2.0.119 focused regressions passed');
