// See https://observablehq.com/framework/config for documentation.
import MarkdownItContainer from "markdown-it-container";
import { readdirSync } from "fs";
import { join } from "path";
import { generatePages } from "./helpers/generatePages.js";

export default {
  // The project’s title; used in the sidebar and webpage titles.
  title: "Modern IT",

  // Content to add to the head of the page, e.g. for a favicon:
  head: '<link rel="icon" href="observable.png" type="image/png" sizes="32x32">',

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
