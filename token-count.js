/* 「约 N Token」：用酒馆现成的 getTokenCountAsync，输入停下 400ms 后再算一次（不是每次按键都算）。
   返回 {stop()}；文本框变了就算，元素被移出文档后自动不再更新。 */
export function watchTokens(win, input, render, delay = 400) {
  let timer = 0, seq = 0, stopped = false;
  const count = async () => {
    timer = 0; const mine = ++seq;
    const fn = win.SillyTavern?.getContext?.()?.getTokenCountAsync; if (!fn) { render(null); return; }
    try { const n = await fn(input.value || ''); if (!stopped && mine === seq) render(n); } catch { if (!stopped && mine === seq) render(null); }
  };
  const schedule = () => { if (stopped) return; win.clearTimeout(timer); timer = win.setTimeout(count, delay); };
  input.addEventListener('input', schedule); count();
  return { refresh: schedule, stop() { stopped = true; win.clearTimeout(timer); input.removeEventListener('input', schedule); } };
}
export const tokenText = (t, n) => n == null ? '' : t(`约 ${n} Token`, `~${n} tokens`);
