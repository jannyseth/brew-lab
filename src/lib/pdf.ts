import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// Receipts and payslips as PDF files. The built-in PDF fonts have no peso
// sign, so amounts are written as "PHP 1,234.00".

export const pdfMoney = (cents: number) =>
  `PHP ${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pdfDate = (date: Date) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila",
  }).format(date);

const ink = rgb(0.17, 0.11, 0.08);
const muted = rgb(0.45, 0.38, 0.32);

// Replace characters the standard fonts can't encode, so user-typed text never breaks the PDF.
const safe = (text: string) =>
  text
    .replace(/₱/g, "PHP ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");

/** A simple top-to-bottom writer that wraps long text and adds pages as needed. */
class Writer {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private size: [number, number],
    private margin: number,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = doc.addPage(size);
    this.y = size[1] - margin;
  }
  get width() {
    return this.size[0] - this.margin * 2;
  }
  private ensure(height: number) {
    if (this.y - height < this.margin) {
      this.page = this.doc.addPage(this.size);
      this.y = this.size[1] - this.margin;
    }
  }
  private wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of safe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, opts: { size?: number; bold?: boolean; color?: typeof ink; align?: "left" | "center" } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.regular;
    for (const line of this.wrap(text, font, size, this.width)) {
      this.ensure(size + 3);
      const x = opts.align === "center" ? this.margin + (this.width - font.widthOfTextAtSize(line, size)) / 2 : this.margin;
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? ink });
      this.y -= size + 3;
    }
  }
  /** Label on the left, value on the right. */
  row(label: string, value: string, opts: { size?: number; bold?: boolean } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.regular;
    const v = safe(value);
    const valueWidth = font.widthOfTextAtSize(v, size);
    const labelLines = this.wrap(label, font, size, this.width - valueWidth - 12);
    labelLines.forEach((line, i) => {
      this.ensure(size + 3);
      this.page.drawText(line, { x: this.margin, y: this.y - size, size, font, color: ink });
      if (i === 0) this.page.drawText(v, { x: this.margin + this.width - valueWidth, y: this.y - size, size, font, color: ink });
      this.y -= size + 3;
    });
  }
  rule(dashed = true) {
    this.ensure(10);
    this.y -= 4;
    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.margin + this.width, y: this.y },
      thickness: 0.6,
      color: muted,
      dashArray: dashed ? [2, 2] : undefined,
    });
    this.y -= 6;
  }
  gap(height = 6) {
    this.y -= height;
  }
}

async function newDoc(title: string, size: [number, number], margin: number) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Brew Lab");
  doc.setCreator("Brew Lab");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, w: new Writer(doc, size, margin, regular, bold) };
}

export type ReceiptData = {
  receiptNumber: string;
  copy: "Customer copy" | "Branch copy";
  branch: { name: string; address: string };
  order: {
    id: number;
    createdAt: Date;
    pickupName: string;
    note: string;
    totalCents: number;
    paidAt: Date | null;
    status: string;
    discountCents?: number;
    coinsUsed?: number;
  };
  items: { drinkName: string; summary: string; quantity: number; unitPriceCents: number }[];
};

/** A narrow, till-style receipt (80 mm wide). */
export async function receiptPdf(r: ReceiptData) {
  const { doc, w } = await newDoc(`Receipt ${r.receiptNumber}`, [227, 600], 14);
  w.text("Brew Lab", { size: 16, bold: true, align: "center" });
  w.text(r.branch.name, { align: "center" });
  w.text(r.branch.address, { size: 8, color: muted, align: "center" });
  w.gap(4);
  w.text(`ORDER RECEIPT - ${r.copy.toUpperCase()}`, { size: 7, color: muted, align: "center" });
  w.rule();
  w.row("Receipt no.", r.receiptNumber);
  w.row("Order", `#${r.order.id}`);
  w.row("Ordered", pdfDate(r.order.createdAt));
  w.row("Pickup name", r.order.pickupName);
  w.rule();
  for (const item of r.items) {
    w.row(`${item.quantity} x ${item.drinkName}`, pdfMoney(item.unitPriceCents * item.quantity), { bold: true });
    w.text(item.summary, { size: 7, color: muted });
    if (item.quantity > 1) w.text(`@ ${pdfMoney(item.unitPriceCents)} each`, { size: 7, color: muted });
    w.gap(3);
  }
  if (r.order.note) w.text(`Note: ${r.order.note}`, { size: 8 });
  if (r.order.discountCents) w.row(`Free drink (${r.order.coinsUsed} bean coins)`, `-${pdfMoney(r.order.discountCents)}`);
  w.rule();
  w.row("TOTAL", pdfMoney(r.order.totalCents), { size: 11, bold: true });
  w.text(
    r.order.status === "cancelled"
      ? "Cancelled"
      : r.order.paidAt
        ? `Paid at the counter - ${pdfDate(r.order.paidAt)}`
        : "Unpaid - pay at pickup",
    { size: 8 },
  );
  w.gap(10);
  w.text("Thank you for choosing Brew Lab!", { size: 8, align: "center" });
  w.text("This is an order receipt, not a BIR official receipt or sales invoice.", { size: 7, color: muted, align: "center" });
  return doc.save();
}

export type PayslipData = {
  entryId: number;
  branch: { name: string; address: string };
  employee: {
    name: string;
    position: string;
    payoutMethod: string | null;
    payoutAccountName: string | null;
    payoutAccountNumber: string | null;
  };
  periodStart: string;
  periodEnd: string;
  hours: string;
  hourlyRateCents: number;
  amountCents: number;
  note: string;
  recordedAt: Date;
};

/** Shows only the last 4 digits of an account number. */
export const maskAccount = (n: string | null) => (n ? `${"*".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}` : "");

/** An A5 payslip for the employee's and the branch's records. */
export async function payslipPdf(p: PayslipData) {
  const { doc, w } = await newDoc(`Payslip ${p.employee.name} ${p.periodStart}`, [420, 595], 36);
  w.text("Brew Lab", { size: 18, bold: true });
  w.text(`${p.branch.name} - ${p.branch.address}`, { size: 9, color: muted });
  w.gap(10);
  w.text("PAYSLIP", { size: 13, bold: true });
  w.text(`Reference PS-${String(p.entryId).padStart(6, "0")} - recorded ${pdfDate(p.recordedAt)}`, { size: 8, color: muted });
  w.rule(false);
  w.row("Employee", p.employee.name, { bold: true });
  w.row("Position", p.employee.position);
  w.row("Pay period", `${p.periodStart} to ${p.periodEnd}`);
  w.rule();
  w.row("Hours worked", Number(p.hours).toFixed(2));
  w.row("Hourly rate", pdfMoney(p.hourlyRateCents));
  w.rule();
  w.row("AMOUNT", pdfMoney(p.amountCents), { size: 12, bold: true });
  if (p.note) w.text(`Note: ${p.note}`, { size: 9 });
  w.gap(8);
  w.text("Receiving account", { size: 10, bold: true });
  if (p.employee.payoutMethod) {
    w.row("Method", p.employee.payoutMethod);
    if (p.employee.payoutAccountName) w.row("Account name", p.employee.payoutAccountName);
    if (p.employee.payoutAccountNumber) w.row("Account number", maskAccount(p.employee.payoutAccountNumber));
  } else {
    w.text("Not provided", { size: 9, color: muted });
  }
  w.gap(24);
  w.text("_______________________          _______________________", { size: 9, color: muted });
  w.text("Branch owner                                    Employee", { size: 8, color: muted });
  w.gap(16);
  w.text(
    "This payslip documents a payment recorded by the branch owner. Brew Lab does not process or hold wages; the branch owner remains responsible for paying employees and meeting all legal obligations as an employer.",
    { size: 7, color: muted },
  );
  return doc.save();
}
