/* Versioned entry point: 字体轴（独立下拉：跟风格 / 思源宋 / 思源黑 / 系统无衬线 / 关掉）。

   改了 styles/*.css 就必须新建这个文件并改 manifest 的 js 字段，
   否则 index.js 的 URL 不变，浏览器直接吃缓存，CSS 也跟着冻住。 */
import './index.js?v=2.0.48';
