// See https://observablehq.com/framework/config for documentation.
import MarkdownItContainer from "markdown-it-container";
import { readdirSync } from "fs";
import { join } from "path";
import { generatePages } from "./helpers/generatePages.js";

export default {
  // The project’s title; used in the sidebar and webpage titles.
  title: "Modern IT",

  // Content to add to the head of the page, e.g. for a favicon:
  head: `<!-- Yandex.Metrika counter -->
<script type="text/javascript" >
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(101433895, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/101433895" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`,

  // The path to the source root.
  root: "src",

  markdownIt: (md) =>
    md
      .use(MarkdownItContainer, "card") // ::: card
      .use(MarkdownItContainer, "tip") // ::: tip
      .use(MarkdownItContainer, "warning"), // ::: warning

  interpreters: {
    ".ps1": ["/usr/bin/pwsh"]
  },

  // Some additional configuration options and their defaults:
  theme: ["default"], // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  // footer: "Built with Observable.", // what to show in the footer (HTML)
  // sidebar: true, // whether to show the sidebar
  toc: true, // whether to show the table of contents
  pager: true, // whether to show previous & next links in the footer
  // output: "dist", // path to the output root for build
  search: true, // activate search
  // linkify: true, // convert URLs in Markdown to links
  typographer: true, // smart quotes and other typographic improvements
  // cleanUrls: true, // drop .html from URLs


  pages: generatePages("src")
};
