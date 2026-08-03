/* Versioned entry point: mono-line sidebar icons via CSS mask.

   这个文件存在的唯一理由是给 index.js 换一个新的 URL。
   manifest.json 的 js 字段指向的文件名、以及下面 import 的 ?v= 串，
   两个都必须每次发版跟着换 —— 只要 URL 一模一样，浏览器（尤其手机端和
   TauriTavern 这类原生壳）就直接吃缓存，index.js 里的任何改动都到不了客户端。
   而 styles/*.css 的 ?v= 是 index.js 算出来的，所以 index.js 一旦被缓存，
   CSS 也跟着一起冻住 —— 表现就是「明明推上去了、也点了更新，界面纹丝不动」。 */
import './index.js?v=2.0.34';
