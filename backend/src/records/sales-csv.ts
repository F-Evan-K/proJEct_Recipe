import { BadRequestException } from "@nestjs/common";
import { saleConditionError } from "./sale-rules";

const columns = ["menu_id", "tanggal", "porsi", "kondisi"];
const conditions = ["normal", "stockout", "tutup"] as const;
type Condition = (typeof conditions)[number];
export type CsvIssue = { line: number; message: string };
export type CsvSale = {
  line: number;
  menuId: number;
  businessDate: string;
  quantity: number;
  condition: Condition;
  closed: boolean;
  stockout: boolean;
};

function cells(line: string, separator: string) {
  if (line.length > 256) return null;
  const cell = new RegExp(`\\s*(?:"((?:""|[^"])*)"|([^"${separator}]*?))\\s*(${separator}|$)`, "gy");
  const values: string[] = [];
  let index = 0;
  do {
    cell.lastIndex = index;
    const match = cell.exec(line);
    if (!match) return null;
    values.push((match[1]?.replaceAll('""', '"') ?? match[2]).trim());
    index = cell.lastIndex;
    if (!match[3]) return values;
  } while (index <= line.length);
  return values;
}

export function parseSalesCsv(csv: string, today: string) {
  if (Buffer.byteLength(csv, "utf8") > 60000)
    throw new BadRequestException("Ukuran CSV maksimal 60 KB.");

  const lines = csv.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => text.trim() !== "");
  const header = lines.shift();
  if (!header) throw new BadRequestException("File CSV kosong.");
  const separator = header.text.includes(";") ? ";" : ",";
  const names = cells(header.text, separator);
  if (names?.length !== columns.length || columns.some(name => !names.includes(name)))
    throw new BadRequestException("Kolom CSV harus berisi menu_id, tanggal, porsi, kondisi. Gunakan template dari halaman.");
  if (!lines.length || lines.length > 1000)
    throw new BadRequestException("Satu file harus berisi 1 sampai 1.000 baris penjualan.");

  const indices = columns.map(name => names.indexOf(name));
  const sales: CsvSale[] = [];
  const issues: CsvIssue[] = [];
  const seen = new Map<string, number>();
  for (const { text, line } of lines) {
    const values = cells(text, separator);
    if (values?.length !== columns.length) {
      issues.push({ line, message: "Format baris tidak valid. Gunakan empat kolom pada satu baris." });
      continue;
    }
    const [id, businessDate, portions, flag] = indices.map(index => values[index]);
    const menuId = Number(id);
    const quantity = Number(portions);
    const condition = conditions.find(candidate => candidate === flag.toLowerCase());
    const date = new Date(businessDate + "T00:00:00Z");
    let message: string | undefined;
    if (!/^\d+$/.test(id) || menuId < 1 || menuId > 2147483647)
      message = "Isi menu_id dengan ID menu yang terdaftar.";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || businessDate < "1000-01-01" ||
      !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== businessDate)
      message = "Gunakan tanggal kalender yang valid dengan format YYYY-MM-DD.";
    else if (!/^\d+$/.test(portions) || quantity > 1000000)
      message = "Porsi harus bilangan bulat antara 0 dan 1.000.000.";
    else if (!condition)
      message = "Kondisi harus normal, stockout, atau tutup.";
    if (message || !condition) {
      issues.push({ line, message: message ?? "Kondisi tidak valid." });
      continue;
    }

    const sale = { line, menuId, businessDate, quantity, condition, closed: condition === "tutup", stockout: condition === "stockout" };
    const conditionError = saleConditionError(sale, today);
    const key = `${menuId}:${businessDate}`;
    const previous = seen.get(key);
    if (conditionError) issues.push({ line, message: conditionError });
    else if (previous !== undefined) issues.push({ line, message: `Menu dan tanggal sudah muncul di baris ${previous}.` });
    else {
      seen.set(key, line);
      sales.push(sale);
    }
  }
  return { sales, issues };
}
