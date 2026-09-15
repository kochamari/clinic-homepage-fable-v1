import { readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "JS", "holidays-data.js");
export const sourceUrl = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseHolidays(csv) {
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.shift() !== "国民の祝日・休日月日,国民の祝日・休日名称") {
    throw new Error("祝日CSVの見出しが不正です（HTML等の異常応答を含む）");
  }
  const dates = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}),([^<>\r\n]+)$/);
    if (!match || !match[4].trim()) throw new Error(`祝日CSVに不正な行があります: ${line.slice(0, 80)}`);
    const value = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    if (!validDate(value) || dates.has(value)) throw new Error(`祝日の日付が不正・重複しています: ${value}`);
    dates.add(value);
  }
  if (!dates.size) throw new Error("祝日データが空です");
  return [...dates].sort();
}

export function readStoredDates(source) {
  const match = source.match(/const nationalHolidays = Object\.freeze\((\[[\s\S]*?\])\);/);
  if (!match) throw new Error("既存の祝日データを確認できません");
  const dates = JSON.parse(match[1].replace(/'/g, '"'));
  if (!Array.isArray(dates) || !dates.length || dates.some(date => typeof date !== "string" || !validDate(date))) {
    throw new Error("既存の祝日データが不正です");
  }
  return dates;
}

export function coverageOf(dates) {
  const counts = {};
  dates.forEach(date => { const year = date.slice(0, 4); counts[year] = (counts[year] || 0) + 1; });
  const years = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return { startYear: years[0], endYear: years.at(-1), counts };
}

export function validateHolidays(dates, previous = [], now = new Date()) {
  const coverage = coverageOf(dates);
  const currentYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric" }).format(now));
  // 翌年分は未公表の場合があるため、当年までを必須とする。
  if (coverage.startYear !== 1955 || coverage.endYear < currentYear) throw new Error("祝日の対象年が不足しています");
  for (let year = coverage.startYear; year <= coverage.endYear; year++) {
    const yearDates = dates.filter(date => date.startsWith(`${year}-`));
    const minimum = year >= 2016 ? 16 : 9;
    if (yearDates.length < minimum || !yearDates[0].startsWith(`${year}-01-`) || yearDates.at(-1).slice(5, 7) < "11") {
      throw new Error(`${year}年の祝日が不完全です`);
    }
  }
  const next = new Set(dates);
  if (previous.some(date => !next.has(date))) throw new Error("既存の祝日が欠落しています。公式の訂正かどうか確認してください");
  return coverage;
}

export function serializeHolidays(dates) {
  const { startYear, endYear, counts } = coverageOf(dates);
  return `// 内閣府「国民の祝日・休日」CSVから自動生成しています。手動で編集しないでください。\n// 更新スクリプト: scripts/update-holidays.mjs\n// 出典: ${sourceUrl}\nconst nationalHolidayCoverage = Object.freeze({\n    startYear: ${startYear},\n    endYear: ${endYear},\n    counts: Object.freeze(${JSON.stringify(counts)})\n});\nconst nationalHolidays = Object.freeze([\n${dates.map(date => `    '${date}'`).join(",\n")}\n]);\n`;
}

export async function updateHolidays({ fetchImpl = fetch, outputFile = outputPath, now = new Date() } = {}) {
  let current = "";
  try { current = await readFile(outputFile, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const previous = current ? readStoredDates(current) : [];
  const response = await fetchImpl(sourceUrl, {
    headers: { "User-Agent": "haraguchi-clinic-holiday-updater" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`祝日CSVを取得できませんでした（HTTP ${response.status}）`);
  if (/html/i.test(response.headers.get("content-type") || "")) throw new Error("祝日CSVの代わりにHTMLが返されました");
  const csv = new TextDecoder("shift_jis", { fatal: true }).decode(await response.arrayBuffer());
  const dates = parseHolidays(csv);
  validateHolidays(dates, previous, now);
  const output = serializeHolidays(dates);
  if (output === current) return { changed: false, count: dates.length };
  const temporary = `${outputFile}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, output, { encoding: "utf8", flag: "wx" });
    await rename(temporary, outputFile);
  } finally {
    await rm(temporary, { force: true });
  }
  return { changed: true, count: dates.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await updateHolidays();
  console.log(result.changed ? `祝日データを更新しました（${result.count}日）。` : "祝日データは最新です。");
}
