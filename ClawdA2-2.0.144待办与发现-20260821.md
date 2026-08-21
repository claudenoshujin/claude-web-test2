# Clawd A2：边界 / 气泡 / 睡觉 / 回落 四处修复 + 诊断埋点

日期：2026-08-21
基线：`2.0.144` 测试版（由 `2.0.143` 提交 `e351bed` 继续开发）
对应：`给Claude诊断-2.0.143-Clawd高度与卡顿.md` 和用户当面提的三条

**Codex 进度（2026-08-21）：版本号、loader、build id 和测试断言已升到 2.0.144；
Android Via 已实测键盘开合与新增的 `tilt` / `wow`，A2 回落 trace 和完整抛掷回归仍未执行。**

---

## 0. 改了什么

| # | 问题 | 状态 |
|---|---|---|
| 1 | 左边界失效，Clawd 被弹进侧栏 | 已修，浏览器实测 |
| 2 | 向上只能到 140px，够不到聊天区 | 已修，浏览器实测 |
| 3 | 气泡不跟着 Clawd，留在输入框上 | 已修，机制实测 |
| 4 | 跺脚生气之后立刻睡觉 | 已修，未实测（要等 3 分钟） |
| 5 | 回落按帧算，掉帧的机器上成倍变慢 | 已修，未在真机实测 |
| 6 | 诊断埋点 | 已加，默认关闭 |

改动全在 `dist-extension/claude-web-test/index.js` 和 `tools/test-a2-interaction.mjs`。

---

## 1. 部署目录搞错了，先纠正这一条

**本地酒馆真正加载的是 `claude-web-test2`，不是 `claude-web-test`。**

我按旧交接文档 §6.1 一直往
`D:\SillyTavern-1.18.0\public\scripts\extensions\third-party\claude-web-test\`
里拷，但那个目录现在只剩一个 index.js（其余已被清掉），**没有 manifest.json，酒馆根本不加载它**。
浏览器实际加载的是 `.../third-party/claude-web-test2/loader-2.0.143.js`。

- 我这一轮的 index.js 已经拷进 `claude-web-test2`，`Ctrl+F5` 就能看到
- `claude-web-test2` 是个 git 工作区且 `auto_update: true`，我直接写文件会被后续的
  `git reset --hard` 冲掉。**正式路径仍然是仓库 → commit → push → 它自己更新**
- `.../third-party/claude-web-test\` 那个空壳建议删掉，留着只会让人再拷错一次

旧交接文档 §6.1 的第三行要改。

---

## 2. 边界：为什么原来是错的

浏览器里量到的真实几何（桌面 1396×931，rail 结构）：

```
#sheld       0 → 1396      整个铺满窗口
#chat        0 → 1396      同上
#form_sheld  0 → 1396      同上
#send_form   458 → 1190    居中，733 宽
#top-bar     0 → 280，占满高度，position:fixed   ← 侧栏是它
Clawd 归位   477 → 519, top 300
```

**三个候选容器全都从 0 开始，整个铺在侧栏底下。** 拿它们的 `left` 当左边界，
等于允许 Clawd 钻进侧栏——这就是截图里它被弹出去的原因，不是物理算错。

现在的规则：可活动范围 = 聊天容器减掉侧栏 / 顶栏之后剩下的那块。
侧栏是竖的还是横的按它自己的宽高比判断，不写死布局假设（手机形态下
`#top-bar` 可能是顶栏，那时候它限制的是上边界而不是左边界）。

拖拽和抛掷时右边界一直放到真实可视区右缘，不再因为装饰 Clawd 提前形成
一堵看不见的墙。只有最终落稳且确实盖住装饰 Clawd 时，才按 `maxxHome`
轻轻滑开；这一步不阻碍手指跟随。

`A2_CEILING = 140` 已经删掉。上边界现在按真实可视区算，键盘打开时容器变矮，
上边界跟着自动收，不需要额外分支。

### 实测结果

| 方向 | 停在哪 | 期望 | |
|---|---|---|---|
| 往左拖到底 | left = 287 | 侧栏右缘 280 + 留空 6 | ✅ |
| 往右拖到底（贴归位线） | right ≈ 1389 | 窗口右缘 1396 − 留空 6 | ✅ |
| 往上拖到顶 | top = 2 | 窗口顶 0 + 留空 6（含姿势缩放） | ✅ |

---

## 3. 顺带查出来的一个真 bug：预热的边界会永久过期

2.0.143 为了不在 `pointerdown` 强制布局，把边界改成预热。但预热只在
**挂载那一刻**和**输入框尺寸变化**（ResizeObserver）时跑。

问题是：聊天内容加载完之后，输入框是**位置**变了、**尺寸**没变，
ResizeObserver 根本不触发。于是「页面还没铺开时量到的那份边界」会一直留着。
实测后果是上边界跑到窗口外 116px——Clawd 能被拖出屏幕顶。

改法：给预热加有效期 `A2_BOUNDS_TTL = 800ms`，过期就在 `pointerdown` 里重量一次；
另外落定之后顺手重新预热一次，让下一次抓取大概率还能走快路径。

**一次手势最多读一次布局，这正是最初设计允许的那一次**（原始约束是
「`pointermove` 和 rAF 循环里一次都不许读」，那两处仍然是零读取）。
诊断文档自己也写了，2.0.143 把这次读取优化掉并没有解决安卓的卡顿，
所以为它换来一个静默的边界错误不划算。

---

## 4. 回落：改成按真实时间推进

原来每帧固定 `vy += g`、`v *= drag`，等于把「一帧」当时间单位：
60fps 一秒走 60 步，30fps 只走 30 步，同一次抛掷在掉帧的机器上墙钟时间直接翻倍。
诊断文档算的那张表（30fps 约为 60fps 的两倍）就是这个。

现在 rAF 回调吃时间戳，`k = 这一帧相当于几个 16.7ms`：

```js
by += P.g * k;
bx *= Math.pow(P.drag, k);
by *= Math.pow(P.drag, k);
A2.x += bx * k;
A2.fy += by * k;
```

`k` 夹在 `[0.5, 3]`，避免切后台再回来时一帧跳出去几百像素直接穿墙。

**这条只在真机上才验得出来**：桌面稳定 60fps，改前改后看不出差别。
验收方式见 §7。

---

## 5. 气泡跟随：走了一段弯路，记下来省得再踩

目标：气泡固定在 Clawd 右上角，跟着它走。

**第一版（错的）**：给气泡套一个跟随用的容器 `<span class="clawd-a2-follow">`，
挂在 `#send_form` 里，跟 Clawd 写同一份位移。

结果整个气泡消失了。查出来两件事：

1. 容器写了 `width: 0`，而气泡的 `max-width` 是 `min(44ch, 62%)`——百分比按包含块算，
   包含块一变成零宽，气泡就被压成零宽。
2. 改成 `width: 100%` 之后仍然不显示：**往 `#send_form` 里加任何未知子节点，
   computed display 都是 `none`**。拿一个什么都没有的 `<span>` 试，一样是 `none`。
   二分下来是 `claude-integrated-theme-live-style` 这张表干的。

所以这条路走不通，**不要再试图往 `#send_form` 里加节点**。

**第二版（现在这版）**：不加节点，直接推气泡本身，而且用独立的 `translate` 属性：

```js
toast.style.setProperty('translate', `${A2.x}px ${A2.fy}px`);
```

气泡的 `transform` 已经被 `translateY(-50%)` 和入场动画占着，写 `transform` 会把
入场动画顶掉。`translate` / `rotate` / `scale` 这三个独立属性在 `transform` 之前生效，
两边互不干扰，而且跟 `transform` 一样只走合成、不触发布局。
扩展自己已经在用这个属性（`html[data-claude-motion="off"]` 那条规则里有 `translate: 0 0`），
所以 Via 的 WebView 113 支持是有先例的。

定位从「右侧居中」改成「右上角」：`top` 压在按钮上沿，气泡自带的
`translateY(-50%)` 会把它整个抬到 Clawd 头顶偏右。

### 一个会让人白查半天的坑

我在浏览器里验的时候气泡一直是 `display: none`，差点以为没修好。
真相是那个浏览器停在**欢迎页**（`body.clawd-welcome`），扩展在欢迎页会主动
藏掉输入框上的装饰层，气泡跟着一起被藏。**验气泡必须先打开一个真实聊天。**
`translate` 的值实测跟 Clawd 的位置精确对上，机制本身是通的。

---

## 6. 跺脚之后立刻睡觉

睡觉由 `lastActivityAt` 驱动，`IDLE_SLEEP_MS = 180000`（3 分钟），
75% 处（135 秒）先进 drowsy。而 `lastActivityAt` 只有**敲键盘**和**聚焦输入框**会刷新。

跟 Clawd 玩不算「人在」——抓、拖、丢、戳一次都不刷新它。
所以连着玩两三分钟不碰键盘，它就会在你手里睡着，正好接在跺脚后面。

改法：加一个 `a2NoteInteraction()`，在 `a2Down` / `a2Poke` / `a2Ballistic` 里各调一次，
刷新 `lastActivityAt`（睡觉计时）和 `lastPokeAt`（冷落计时），并解除冷落。

副作用：`noteActivity()` 会把 `hasChatActivity` 置真，所以在欢迎页戳 Clawd 之后
它也会进入正常的打盹周期。这是合理的——敲一下键盘本来也是这个效果。

---

## 7. 诊断埋点

默认关闭，关闭时每个埋点只是一次布尔判断，不进数组、不读时钟。

```js
__claudeClawdInteraction.a2TraceStart()
// ……抓一次、拖一段、丢出去……
copy(JSON.stringify(__claudeClawdInteraction.a2Trace()))
__claudeClawdInteraction.a2TraceStop()
```

返回的东西：

- `marks`：`trace:start`（带 UA / dpr / 视口）、`pointerdown`（带坐标）、`ballistic:start`
- `frameCount` / `frames`：回落每一帧的时间戳和 `k`
- `frameGapMs`：帧间隔的中位数 / p95 / 最大值
- `ballisticWallMs`：回落总墙钟时间
- `longTasks`：`PerformanceObserver` 的 longtask（Via 不支持就是空数组，不报错）

全部用 `performance.now()`，不数帧——数帧就测不出「掉帧导致回落变慢」这件事。

**诊断文档要的埋点还差几项我没加**：第一个 `pointermove` 的到达时间、
第一次写 transform 的时间、写完之后连续两个 rAF 的时间、`getCoalescedEvents()` 数量。
这几项要在 `a2Move` 和 `a2Place` 里插，会落在真正的热路径上，
我不想在没有真机数据的情况下先往热路径塞东西。**如果你要做那组 A/B，
先按 §8 拿一次基线，再决定要不要加。**

---

## 8. 你的任务

### 8.1 版本号（四处一起改，漏一处静态测试第一行就红）

1. `manifest.json` 的 `version` 和 `js`
2. 新建 `loader-2.0.144.js`
3. `index.js` 第 367 行附近的 build 字符串
4. `tools/test-2.0.118-regressions.js` 第 10、11 行的断言和第 96 行的文案

### 8.2 自检

```powershell
Set-Location -LiteralPath 'E:\Crab Pot\项目\酒馆\Claude-Clawd-酒馆助手\dist-extension\claude-web-test'
node --check index.js
node tools\test-2.0.118-regressions.js
node tools\test-2.0.118-runtime.mjs
node tools\test-a2-interaction.mjs
git --no-pager diff --check
```

`test-a2-interaction.mjs` 这一轮加了两组断言：气泡用 `translate` 跟随且不碰
`transform`；以及几条静态约束（不许再出现 `A2_CEILING`、`a2Walls` 必须提到
`#sheld` 和 `#top-bar`、回落必须有 `Math.pow(P.drag, k)`、`a2NoteInteraction`
至少被调 4 次）。同时按 2.0.143 的实际行为更新了两条过时断言：
`touch-action` 现在断言的是样式表里的常驻规则而不是内联属性，
`grab` 姿势现在断言的是 pointerdown 就上。

### 8.3 桌面目检（在**真实聊天页**，不是欢迎页）

- [ ] 拖到左边停在侧栏边上，不进侧栏
- [ ] 拖到顶能到聊天区顶部，不再只有 140px
- [ ] 贴着输入框往右拖，不压到右上角那只装饰 Clawd
- [ ] 气泡跟着 Clawd 走，固定在它右上角，拖动时不歪不变形
- [ ] 连着玩三四分钟不碰键盘，它不会在你手里睡着
- [ ] 落地、弹跳、生气序列的观感

### 8.4 安卓（唯一还没做的验收）

回落那条只在真机上验得出来：

- [ ] 同一次抛掷，60fps 和 30fps 下的墙钟时间应该基本一致
      （用 `a2Trace()` 的 `ballisticWallMs` 和 `frameGapMs` 对比）
- [ ] 拖 Clawd 不会把聊天滚起来
- [ ] 长聊天 + 键盘弹出 + 流式输出同时发生时再来一遍
- [ ] 键盘开合两次，边界跟着变，Clawd 不飘、不越界
- [ ] 12 段抛掷不掉帧（对照 `diagnostics/clawd-frameswap-perf.html`）

抓取延迟那组 A/B 按诊断文档 §「建议的诊断 A/B」做，先拿电脑端基线。

---

## 9. 已验证 / 未验证

**在真浏览器里实测过的：** 左右上三个边界的精确停靠位置、气泡的 `translate`
跟 Clawd 位置精确对应、新代码确实加载生效。

**只跑了自动化测试的：** 六组 A2 行为断言 + 两组新断言，三个测试全过，
`node --check` 过。

**完全没验的：** 安卓的一切；回落改成按时间推进之后在掉帧设备上的实际表现；
「玩三分钟不睡着」需要真的等三分钟；真实聊天页里气泡的观感。

**明确不知道的：** `claude-integrated-theme-live-style` 里到底是哪条规则在藏
`#send_form` 的未知子节点——我用选择器匹配没找到，是靠逐张关样式表二分定位到
这张表的。现在的实现绕开了这个问题（不加节点），所以没有继续追。
如果以后要往输入框里加东西，得先把那条规则找出来。
