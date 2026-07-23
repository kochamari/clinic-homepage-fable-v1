import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pageFiles = [
  "index.html",
  "news.html",
  "service.html",
  "doctors.html",
  "access.html",
  "contact.html",
  "materials.html",
  "privacy.html",
  "facility-standards.html",
  "404.html",
];

const requiredFiles = [
  "CNAME",
  "robots.txt",
  "sitemap.xml",
  ...pageFiles,
  "CSS/style.css",
  "JS/script.js",
  "JS/site-config.js",
  "JS/analytics-consent.js",
  "JS/transition-init.js",
  "JS/holidays-data.js",
  "JS/news-data.js",
  "JS/news-loader.js",
  "JS/news-popup.js",
  "JS/clinic-hours.js",
];

const errors = [];
const htmlDocuments = new Map();

function absolutePath(relativePath) {
  return path.join(root, relativePath);
}

function displayPath(absolute) {
  return path.relative(root, absolute) || ".";
}

async function isFile(relativePath) {
  try {
    return (await stat(absolutePath(relativePath))).isFile();
  } catch {
    return false;
  }
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function addError(message) {
  errors.push(message);
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function attributeValues(html, attribute) {
  const values = [];
  const pattern = new RegExp(
    `\\b${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "gi",
  );
  let match;
  while ((match = pattern.exec(html))) {
    values.push({ value: match[2].trim(), index: match.index });
  }
  return values;
}

function idsIn(html) {
  const ids = new Set();
  const duplicates = [];
  const pattern = /\bid\s*=\s*(["'])([^"']+)\1/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const id = match[2];
    if (ids.has(id)) duplicates.push(id);
    ids.add(id);
  }
  return { ids, duplicates };
}

function tagCount(html, tag, closing = false) {
  const prefix = closing ? "</" : "<";
  const pattern = new RegExp(`${prefix}${tag}\\b`, "gi");
  return [...html.matchAll(pattern)].length;
}

function validateHtml(relativePath, source) {
  const html = stripComments(source);
  const label = relativePath;

  if (!/^<!doctype\s+html\s*>/i.test(html.trimStart())) {
    addError(`[HTML] ${label}: <!doctype html> がありません`);
  }

  if (!/<html\b[^>]*\blang\s*=\s*["']ja["']/i.test(html)) {
    addError(`[HTML] ${label}: html要素の lang="ja" がありません`);
  }

  for (const tag of ["html", "head", "body", "title", "main"]) {
    const opening = tagCount(html, tag);
    const closing = tagCount(html, tag, true);
    if (opening !== 1 || closing !== 1) {
      addError(
        `[HTML] ${label}: <${tag}> の開始・終了タグが不正です（開始 ${opening} / 終了 ${closing}）`,
      );
    }
  }

  if (!/<title\b[^>]*>\s*[^<\s]/i.test(html)) {
    addError(`[HTML] ${label}: title要素が空です`);
  }

  const { duplicates } = idsIn(html);
  for (const id of duplicates) {
    addError(`[HTML] ${label}: id="${id}" が重複しています`);
  }

  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const imageMatch of imageTags) {
    if (!/\balt\s*=\s*(["'])/i.test(imageMatch[0])) {
      addError(
        `[HTML] ${label}:${lineNumber(source, imageMatch.index)}: img要素に alt 属性がありません`,
      );
    }
  }
}

function isExternalReference(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
}

function splitReference(reference) {
  const hashIndex = reference.indexOf("#");
  const queryIndex = reference.indexOf("?");
  const pathEnd = Math.min(
    hashIndex === -1 ? reference.length : hashIndex,
    queryIndex === -1 ? reference.length : queryIndex,
  );
  return {
    pathPart: reference.slice(0, pathEnd),
    fragment: hashIndex === -1 ? "" : reference.slice(hashIndex + 1).split("?")[0],
  };
}

function resolveLocalReference(sourceFile, reference) {
  const { pathPart, fragment } = splitReference(reference);
  let decodedPath;
  let decodedFragment;
  try {
    decodedPath = decodeURIComponent(pathPart);
    decodedFragment = decodeURIComponent(fragment);
  } catch {
    return { error: "URLエンコードが不正です" };
  }

  const target = decodedPath === ""
    ? absolutePath(sourceFile)
    : path.resolve(
        root,
        decodedPath.startsWith("/")
          ? decodedPath.slice(1)
          : path.join(path.dirname(sourceFile), decodedPath),
      );
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    return { error: "サイト外のパスです" };
  }
  return { target, fragment: decodedFragment };
}

async function checkReference(sourceFile, reference, kind, source, index) {
  if (!reference || reference === "#" || isExternalReference(reference)) return;

  const resolved = resolveLocalReference(sourceFile, reference);
  if (resolved.error) {
    addError(
      `[${kind}] ${sourceFile}:${lineNumber(source, index)}: ${reference}（${resolved.error}）`,
    );
    return;
  }

  let targetInfo;
  try {
    targetInfo = await stat(resolved.target);
    if (!targetInfo.isFile()) throw new Error("not a file");
  } catch {
    addError(
      `[${kind}] ${sourceFile}:${lineNumber(source, index)}: ${reference} が見つかりません`,
    );
    return;
  }

  if (!resolved.fragment || !resolved.target.endsWith(".html")) return;

  const targetRelative = displayPath(resolved.target);
  let targetSource = htmlDocuments.get(targetRelative);
  if (targetSource === undefined) {
    targetSource = await readFile(resolved.target, "utf8");
  }
  if (!idsIn(stripComments(targetSource)).ids.has(resolved.fragment)) {
    addError(
      `[リンク] ${sourceFile}:${lineNumber(source, index)}: ${reference} のアンカーが見つかりません`,
    );
  }
}

async function checkHtmlReferences(relativePath, source) {
  const html = stripComments(source);
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  const imageReferences = new Set();
  for (const imageMatch of imageTags) {
    const sourceMatch = imageMatch[0].match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i);
    if (sourceMatch) imageReferences.add(sourceMatch[2].trim());
  }

  for (const { value, index } of attributeValues(html, "href")) {
    await checkReference(relativePath, value, "リンク", source, index);
  }

  for (const { value, index } of attributeValues(html, "src")) {
    if (imageReferences.has(value)) continue;
    await checkReference(relativePath, value, "リソース", source, index);
  }

  for (const imageMatch of imageTags) {
    const sourceMatch = imageMatch[0].match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!sourceMatch) {
      addError(
        `[画像] ${relativePath}:${lineNumber(source, imageMatch.index)}: img要素に src 属性がありません`,
      );
      continue;
    }
    await checkReference(
      relativePath,
      sourceMatch[2].trim(),
      "画像",
      source,
      imageMatch.index,
    );
  }
}

async function checkStylesheetReferences() {
  const relativePath = "CSS/style.css";
  if (!(await isFile(relativePath))) return;

  const source = await readFile(absolutePath(relativePath), "utf8");
  const pattern = /url\(\s*(?:(["'])([\s\S]*?)\1|([^\s)]+))\s*\)/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const value = (match[2] ?? match[3] ?? "").trim();
    await checkReference(relativePath, value, "CSS画像", source, match.index);
  }
}

async function checkJavaScriptSyntax() {
  const jsDirectory = absolutePath("JS");
  let entries;
  try {
    entries = await readdir(jsDirectory, { withFileTypes: true });
  } catch {
    addError("[JS] JS ディレクトリを読み込めません");
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const relativePath = path.join("JS", entry.name);
    const result = spawnSync(process.execPath, ["--check", absolutePath(relativePath)], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "構文エラー").trim();
      addError(`[JS] ${relativePath}: ${detail}`);
    }
  }
}

console.log("GitHub Pages公開用ファイルを検証しています...");

for (const relativePath of requiredFiles) {
  if (!(await isFile(relativePath))) {
    addError(`[必須ファイル] ${relativePath} が見つかりません`);
  }
}

for (const relativePath of pageFiles) {
  if (!(await isFile(relativePath))) continue;
  const source = await readFile(absolutePath(relativePath), "utf8");
  htmlDocuments.set(relativePath, source);
  validateHtml(relativePath, source);
}

for (const [relativePath, source] of htmlDocuments) {
  await checkHtmlReferences(relativePath, source);
}

await checkStylesheetReferences();
await checkJavaScriptSyntax();

if (errors.length > 0) {
  console.error(`\n検証に失敗しました（${errors.length}件）:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `検証に成功しました（必須ファイル ${requiredFiles.length}件 / HTML ${pageFiles.length}ページ / JS構文チェック完了）。`,
  );
}
