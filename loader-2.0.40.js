/* Versioned entry point: 删掉三击踱步，常驻状态改用身外符号。

   改了 styles/*.css 就必须新建这个文件并改 manifest 的 js 字段，
   否则 index.js 的 URL 不变，浏览器直接吃缓存，CSS 也跟着冻住。 */
import './index.js?v=2.0.40';
