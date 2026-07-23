import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "JS", "holidays-data.js");
const sourceUrl = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

function toYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseHolidays(csv) {
  const holidays = new Set();
  for (const line of csv.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = line.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}),/);
    if (!match) continue;
    holidays.add(toYmd(Number(match[1]), Number(match[2]), Number(match[3])));
  }
  return [...holidays].sort();
}

async function readCurrentFile() {
  try {
    return await readFile(outputPath, "utf8");
  } catch {
    return "";
  }
}

const response = await fetch(sourceUrl, {
  headers: { "User-Agent": "haraguchi-clinic-holiday-updater" },
});
if (!response.ok) {
  throw new Error(`内閣府の祝日CSVを取得できませんでした（HTTP ${response.status}）`);
}

const csv = new TextDecoder("shift_jis").decode(await response.arrayBuffer());
const holidays = parseHolidays(csv);
if (holidays.length === 0) {
  throw new Error("内閣府の祝日CSVから日付を読み取れませんでした");
}

const output = `// 内閣府「国民の祝日・休日」CSVから自動生成しています。手動で編集しないでください。\n// 更新スクリプト: scripts/update-holidays.mjs\n// 出典: ${sourceUrl}\nconst nationalHolidays = Object.freeze([\n${holidays.map((date) => `    '${date}'`).join(",\n")}\n]);\n`;

if (output === await readCurrentFile()) {
  console.log("祝日データは最新です。");
} else {
  await writeFile(outputPath, output, "utf8");
  console.log(`祝日データを更新しました（${holidays.length}日）。`);
}
