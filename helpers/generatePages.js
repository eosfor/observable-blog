import fs from "fs";
import path from "path";
import matter from "gray-matter";

export function walkMarkdownFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

export function readPageInfo(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const { data } = matter(content);

  const title = data.title || path.basename(filepath, ".md");
  const section = data.section || null;
  const date = data.date ? new Date(data.date) : null;

  const relativePath = filepath.replace(/^src\//, "/").replace(/\.md$/, "");

  return { title, path: relativePath, section, date };
}

export function generatePages(root = "src") {
  const files = walkMarkdownFiles(root).map(readPageInfo);

  // Главная страница
  const homePage = files.find((f) => f.path === "/index");
  const contentPages = files.filter((f) => f.path !== "/index");

  // Группировка по section
  const grouped = new Map();

  for (const page of contentPages) {
    const section = page.section || "Uncategorized";

    if (!grouped.has(section)) {
      grouped.set(section, []);
    }

    grouped.get(section).push(page);
  }

  // Сортировка внутри секций
  const sectionPages = [...grouped.entries()].map(([section, pages]) => ({
    name: section,
    pages: pages
      .sort((a, b) => {
        if (a.date && b.date) return b.date - a.date;
        if (a.date) return -1;
        if (b.date) return 1;
        return a.title.localeCompare(b.title);
      })
      .map(({ title, path }) => ({ name: title, path }))
  }));

  // Собираем итоговую структуру
  const finalPages = [];

  if (homePage) {
    finalPages.push({
      name: homePage.title,
      path: homePage.path
    });
  }

  return [...finalPages, ...sectionPages];
}