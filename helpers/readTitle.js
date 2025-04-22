import fs from "fs";
import path from "path";
import matter from "gray-matter";

export function readTitle(filepath) {
  const full = fs.readFileSync(filepath, "utf-8");
  const parsed = matter(full);
  return parsed.data.title || path.basename(filepath, path.extname(filepath));
}