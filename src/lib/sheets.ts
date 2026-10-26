import "server-only";
import ExcelJS from "exceljs";

// Builds .xlsx downloads. Money columns hold real peso numbers (not text) so
// totals and formulas work in Excel and Google Sheets.

export type Column = { header: string; key: string; width?: number; money?: boolean; date?: boolean };
export type SheetSpec = { name: string; columns: Column[]; rows: Record<string, unknown>[]; note?: string };

const PESO = '"₱"#,##0.00';

export async function workbookResponse(filename: string, sheets: SheetSpec[]) {
  const book = new ExcelJS.Workbook();
  book.creator = "Brew Lab";
  book.created = new Date();

  for (const spec of sheets) {
    const sheet = book.addWorksheet(spec.name.slice(0, 31));
    sheet.columns = spec.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
    for (const row of spec.rows) {
      sheet.addRow(
        Object.fromEntries(spec.columns.map((c) => [c.key, c.money && typeof row[c.key] === "number" ? (row[c.key] as number) / 100 : row[c.key]])),
      );
    }
    spec.columns.forEach((c, i) => {
      if (c.money) sheet.getColumn(i + 1).numFmt = PESO;
      if (c.date) sheet.getColumn(i + 1).numFmt = "yyyy-mm-dd hh:mm";
    });
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6E6D8" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    if (spec.note) {
      sheet.addRow([]);
      sheet.addRow([spec.note]).font = { italic: true, color: { argb: "FF7A6656" } };
    }
  }

  const buffer = await book.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Dates in exported sheets are shown in Philippine time. */
export const sheetDate = (date: Date | null) => {
  if (!date) return null;
  const tz = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila";
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  // Excel has no time zones: store the local wall-clock time.
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes()));
};

export const fileDate = () => new Date().toISOString().slice(0, 10);
