import { jsPDF } from 'jspdf';
import { invoiceSubtotal, invoiceTax, invoiceTotal, lineTotal } from './invoice.js';
import { payToDetails } from './payto.js';

// The built-in PDF fonts only cover basic Latin, so swap typographic characters for plain ones.
const plain = (s) =>
  String(s ?? '')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '*')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\n]/g, '');

const money = (n, cur) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const d = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Builds an A4 invoice PDF and returns the jsPDF document. */
export function buildInvoicePdf({ inv, org, contact, payTo }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  const teal = [0, 168, 138];
  const ink = [17, 24, 39];
  const grey = [107, 114, 128];

  doc.setFillColor(10, 15, 30);
  doc.rect(0, 0, W, 6, 'F');

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', M, 26);
  doc.setFontSize(11);
  doc.text(plain(org.name), W - M, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  [org.address, org.email, org.regNo].filter(Boolean).forEach((l, i) => doc.text(plain(l), W - M, 25 + i * 4.5, { align: 'right' }));

  // Bill-to and invoice facts
  let y = 46;
  doc.setFontSize(8);
  doc.text('BILL TO', M, y);
  doc.text('INVOICE NO.', 120, y);
  doc.text('ISSUED', 150, y);
  doc.text('DUE', 175, y);
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text(plain(contact?.name), M, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(plain(contact?.email), M, y + 10.5);
  doc.text(inv.number, 120, y + 5.5);
  doc.text(d(inv.issueDate), 150, y + 5.5);
  doc.text(d(inv.dueDate), 175, y + 5.5);

  // Lines table
  y = 72;
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y - 5, W - 2 * M, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text('DESCRIPTION', M + 2, y);
  doc.text('QTY', 128, y, { align: 'right' });
  doc.text('UNIT PRICE', 158, y, { align: 'right' });
  doc.text(`AMOUNT (${inv.currency})`, W - M - 2, y, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  y += 9;
  for (const l of inv.lines) {
    const wrapped = doc.splitTextToSize(plain(l.desc), 95);
    doc.text(wrapped, M + 2, y);
    doc.text(String(l.qty), 128, y, { align: 'right' });
    doc.text(money(Number(l.unitPrice), ''), 158, y, { align: 'right' });
    doc.text(money(lineTotal(l), ''), W - M - 2, y, { align: 'right' });
    y += 5 * wrapped.length + 3;
    doc.setDrawColor(229, 231, 235);
    doc.line(M, y - 3, W - M, y - 3);
    if (y > 240) {
      doc.addPage();
      y = 24;
    }
  }

  // Totals
  y += 3;
  const row = (label, value, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 158, y, { align: 'right' });
    doc.text(value, W - M - 2, y, { align: 'right' });
    y += 6;
  };
  row('Subtotal', money(invoiceSubtotal(inv), inv.currency));
  if (Number(inv.taxRate)) row(`Tax ${inv.taxRate}%`, money(invoiceTax(inv), inv.currency));
  doc.setFontSize(12);
  row('Total due', money(invoiceTotal(inv), inv.currency), true);
  doc.setFontSize(10);

  // How to pay
  y += 6;
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.6);
  doc.line(M, y, M, y + 30);
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold');
  doc.text('How to pay', M + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = payToDetails(payTo, inv).map(plain);
  lines.forEach((l, i) => doc.text(doc.splitTextToSize(l, W - 2 * M - 6), M + 4, y + 10 + i * 5));
  y += 38;

  if (inv.notes) {
    doc.setTextColor(...grey);
    doc.text(doc.splitTextToSize(plain(inv.notes), W - 2 * M), M, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text(plain(`${org.name} - generated with TRNZND Treasury (demo)`), M, 287);
  return doc;
}

export function downloadInvoicePdf(args) {
  buildInvoicePdf(args).save(`${args.inv.number}.pdf`);
}
