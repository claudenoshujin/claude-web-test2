const fs = require('node:fs');
const path = require('node:path');
const csstree = require('css-tree');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'styles', 'day-pc.css');
const outputPath = path.join(root, 'styles', 'compat.css');
const ast = csstree.parse(fs.readFileSync(sourcePath, 'utf8'));

function keepSelector(selector) {
  /* 兼容版的硬边界：欢迎页和消息内部归外部 JSON。即使某条规则同时包含
     Clawd，也不能把 .mes/.mes_text/reasoning/actions 一起带进来。 */
  if (/\b(?:welcomePanel|clawd-welcome|clawd-character|clawd-signoff-button)\b/i.test(selector)
    || /#chat\s*>?\s*\.mes|\.mes(?:_|\b)|\.claude-(?:user-message-actions|swipe-|reroll-button|has-preset-reasoning)/i.test(selector)) {
    return false;
  }
  return /\.typing_indicator\b/.test(selector)
    || /\.clawd-(?:rail|user|pc-top-actions|typing|generation-timer)\b/i.test(selector)
    || (/body\.claude-generation-active\b/i.test(selector)
      && /(?:\.typing_indicator|#send_form|#rightSendForm|#mes_stop|#send_but)/i.test(selector))
    || /\[data-claude-(?:clawd|motion|decorations|gen-timer)(?:=|\])/i.test(selector);
}

function render(node) {
  if (node.type === 'Rule') {
    if (node.prelude?.type !== 'SelectorList') return '';
    const selectors = node.prelude.children.toArray()
      .map(selector => csstree.generate(selector))
      .filter(keepSelector);
    if (!selectors.length) return '';
    return `${selectors.join(',\n')}${csstree.generate(node.block)}`;
  }

  if (node.type !== 'Atrule') return '';
  const name = String(node.name || '').toLowerCase();
  if (name.endsWith('keyframes')) return csstree.generate(node);
  if (!node.block?.children) return '';
  const body = node.block.children.toArray().map(render).filter(Boolean).join('\n');
  if (!body) return '';
  const prelude = node.prelude ? ` ${csstree.generate(node.prelude)}` : '';
  return `@${node.name}${prelude}{${body}}`;
}

const variables = `/* Claude Web compatibility framework.
 * Native SillyTavern themes own color, typography, backgrounds and stock layout.
 * This file styles only Claude Web's own components and the Clawd typing anchor. */
:root{
  --cl-canvas:var(--SmartThemeBlurTintColor,rgba(20,20,20,.92));
  --cl-surface:var(--SmartThemeChatTintColor,var(--cl-canvas));
  --cl-soft:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 8%,transparent);
  --cl-soft-hover:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 13%,transparent);
  --cl-line:var(--SmartThemeBorderColor,color-mix(in srgb,currentColor 18%,transparent));
  --cl-line-strong:color-mix(in srgb,var(--SmartThemeBodyColor,currentColor) 28%,transparent);
  --cl-ink:var(--SmartThemeBodyColor,currentColor);
  --cl-muted:var(--SmartThemeEmColor,var(--cl-ink));
  --cl-accent:var(--SmartThemeQuoteColor,var(--SmartThemeUnderlineColor,#d97757));
  --cl-accent-soft:color-mix(in srgb,var(--cl-accent) 16%,transparent);
  --cl-code:color-mix(in srgb,var(--cl-ink) 8%,transparent);
  --cl-code-ink:var(--cl-ink);
  --cl-sans:var(--mainFontFamily,system-ui,sans-serif);
  --cl-serif:var(--mainFontFamily,system-ui,sans-serif);
  --cl-body-weight:inherit;
  --cl-clawd-eye:#000;
  --cl-clawd-eye-row-a:#000;
  --cl-clawd-eye-row-b:var(--cl-accent);
  --cl-typing-float-animation:clawd-question-float 2.36s cubic-bezier(.37,0,.22,1) infinite;
  --cl-greeting-particle-animation:clawd-question-float 2.83s cubic-bezier(.37,0,.22,1) .41s infinite;
  --cw-text-body:var(--cl-ink);
  --cw-text-secondary:var(--cl-muted);
  --cw-text-muted:var(--cl-muted);
  --cw-text-faint:color-mix(in srgb,var(--cl-muted) 62%,transparent);
  --cw-mark:var(--cl-accent);
  --cw-hero:var(--cl-ink);
  --cw-surface-page:var(--cl-canvas);
  --cw-surface-raised:var(--cl-surface);
  --cw-surface-input:var(--cl-surface);
  --cw-surface-hover:var(--cl-soft-hover);
  --cw-rule-hairline:var(--cl-line);
  --cw-scrollbar:color-mix(in srgb,var(--cl-muted) 48%,transparent);
  --cw-scrollbar-hover:var(--cl-muted);
  --cw-shadow-floating:0 10px 28px color-mix(in srgb,#000 20%,transparent);
  --cw-radius-2:2px;
  --cw-radius-5:5px;
  --cw-radius-7:7px;
  --cw-radius-8:8px;
  --cw-radius-9:9px;
  --cw-radius-10:10px;
  --cw-radius-14:14px;
  --cw-radius-16:16px;
  --cw-radius-20:20px;
  --cw-radius-pill:999px;
  --cw-radius-circle:50%;
  --cw-fs-s:.86rem;
  --cw-lh-s:1.45;
  --cw-gut:12px;
  --cw-column:min(760px,100%);
  --cw-composer:min(760px,100%);
  --cw-c-list:240px;
  --cw-c-nav:68px;
  --cw-pb-top:0px;
  --cl-fs-md:14px;
  --cl-fs-meta:12px;
  --cl-font-ui:var(--mainFontFamily,system-ui,sans-serif);
  --cl-font-reading:var(--mainFontFamily,system-ui,sans-serif);
}
`;

const frameworkShell = `/* Framework ownership: Claude controls geometry; the active JSON controls content. */
@media (min-width:701px){
  html[data-claude-mode="compat"]{
    --cl-rail:280px;
    --cl-rail-nav:var(--SmartThemeBodyColor,var(--cw-text-body));
    --cl-rail-nav-hover:var(--SmartThemeQuoteColor,var(--cw-mark));
    --cl-rail-title:var(--SmartThemeBodyColor,var(--cw-text-body));
    --cl-rail-edge:var(--SmartThemeBorderColor,var(--cw-rule-hairline));
  }
  html[data-claude-mode="compat"] body #top-bar{
    position:fixed!important;inset:0 auto 0 0!important;
    width:var(--cl-rail)!important;min-width:var(--cl-rail)!important;max-width:var(--cl-rail)!important;
    height:100dvh!important;margin:0!important;border:0!important;border-right:1px solid var(--cl-rail-edge)!important;
    background:var(--SmartThemeBlurTintColor,var(--cw-surface-page))!important;
    box-shadow:none!important;z-index:3990!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder{
    position:fixed!important;inset:0 auto 0 0!important;
    display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
    align-items:stretch!important;justify-content:flex-start!important;gap:1px!important;
    width:var(--cl-rail)!important;min-width:var(--cl-rail)!important;max-width:var(--cl-rail)!important;
    height:100dvh!important;margin:0!important;padding:18px 8px 14px!important;
    overflow-x:hidden!important;overflow-y:auto!important;box-sizing:border-box!important;
    transform:none!important;filter:none!important;contain:none!important;
    background:var(--SmartThemeBlurTintColor,var(--cw-surface-page))!important;
    border:0!important;border-right:1px solid var(--cl-rail-edge)!important;z-index:3995!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>*{order:2}
  html[data-claude-mode="compat"] body #top-settings-holder>.clawd-rail-brand{order:0}
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer#rightNavHolder{order:3;margin-bottom:2px!important}
  html[data-claude-mode="compat"] body #top-settings-holder>.clawd-rail-recents{order:4}
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer{
    position:static!important;display:block!important;flex:0 0 auto!important;
    width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;
    margin:0!important;padding:0!important;transform:none!important;filter:none!important;
    perspective:none!important;backdrop-filter:none!important;contain:none!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-toggle{
    position:relative!important;display:flex!important;flex:0 0 auto!important;flex-direction:row!important;
    align-items:center!important;justify-content:flex-start!important;gap:0!important;
    width:100%!important;min-width:0!important;max-width:none!important;min-height:36px!important;height:36px!important;
    margin:0!important;padding:0!important;border-radius:8px!important;overflow:visible!important;
    transform:none!important;cursor:pointer!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-toggle>.drawer-icon{
    position:absolute!important;left:8px!important;right:auto!important;top:50%!important;bottom:auto!important;
    display:grid!important;place-items:center!important;flex:0 0 24px!important;
    width:24px!important;min-width:24px!important;max-width:24px!important;
    height:24px!important;min-height:24px!important;max-height:24px!important;
    margin:0!important;padding:0!important;transform:translateY(-50%)!important;
    background-position:center!important;background-repeat:no-repeat!important;background-size:contain!important;
    font-size:16px!important;line-height:24px!important;overflow:visible!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-toggle>.drawer-icon::before{
    max-width:24px!important;max-height:24px!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-content{
    position:fixed!important;inset:0 0 0 var(--cl-rail)!important;
    width:auto!important;min-width:0!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;
    margin:0!important;box-sizing:border-box!important;overflow-y:auto!important;z-index:4004!important;
  }
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-content.closedDrawer,
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-content:not(.openDrawer){display:none!important}
  html[data-claude-mode="compat"] body #top-settings-holder>.drawer>.drawer-content.openDrawer{display:block!important}
  html[data-claude-mode="compat"] body #sheld{
    top:0!important;left:0!important;right:0!important;width:100%!important;max-width:none!important;
    min-width:0!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;box-sizing:border-box!important;
  }
  html[data-claude-mode="compat"] body #chat{
    width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important;
    padding-left:calc(var(--cl-rail) + clamp(8px,2vw,28px))!important;
    padding-right:clamp(8px,2vw,28px)!important;overflow-x:hidden!important;
  }
  html[data-claude-mode="compat"] body #form_sheld{
    position:relative!important;inset:auto!important;transform:none!important;
    width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;
    padding:8px clamp(8px,2vw,28px) 18px calc(var(--cl-rail) + clamp(8px,2vw,28px))!important;
    border:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;
  }
}
html[data-claude-mode="compat"] body #form_sheld::before,
html[data-claude-mode="compat"] body #form_sheld::after{display:none!important;content:none!important}
html[data-claude-mode="compat"] body #send_form{
  position:relative!important;inset:auto!important;transform:none!important;
  display:flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:4px!important;
  width:calc(100% - 18px)!important;max-width:760px!important;min-width:0!important;min-height:58px!important;
  margin:0 auto!important;padding:6px 9px!important;box-sizing:border-box!important;
  background:var(--SmartThemeChatTintColor,var(--cw-surface-raised))!important;background-image:none!important;
  border:1px solid var(--SmartThemeBorderColor,var(--cw-rule-hairline))!important;border-radius:18px!important;
  box-shadow:0 10px 30px color-mix(in srgb,#000 16%,transparent)!important;backdrop-filter:none!important;
}
html[data-claude-mode="compat"] body #send_form>#nonQRFormItems{
  display:flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:4px!important;
  width:100%!important;min-width:0!important;
}
html[data-claude-mode="compat"] body #send_textarea{
  flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;
  margin:0!important;padding:8px!important;border:0!important;background:transparent!important;background-image:none!important;
  color:var(--SmartThemeBodyColor,var(--cw-text-body))!important;box-shadow:none!important;resize:none!important;
}
html[data-claude-mode="compat"] body :is(#leftSendForm,#rightSendForm){
  display:flex!important;flex:0 0 auto!important;align-items:center!important;gap:3px!important;height:auto!important;
}
html[data-claude-mode="compat"] body #send_but,
html[data-claude-mode="compat"] body #rightSendForm #mes_stop{
  display:grid!important;place-items:center!important;width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;
  margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;
  background:var(--SmartThemeQuoteColor,#c96442)!important;background-image:none!important;box-shadow:none!important;
}
`;

/* 不再从完整版 CSS 抽取任何规则。选择器过滤无法可靠判断一条规则是在画
   Claude 组件，还是同时改了外部主题依赖的消息节点；兼容版只维护这份明确的
   框架白名单。 */
fs.writeFileSync(outputPath, `${variables}\n${frameworkShell}\n`);
console.log(`Wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(frameworkShell)} bytes of framework CSS)`);
