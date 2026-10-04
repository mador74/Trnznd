// Invoice maths and status (pure; unit tested in invoice.test.js).

const round2 = (n) => Math.round(n * 100) / 100;

export const lineTotal = (l) => round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0));
export const invoiceSubtotal = (inv) => round2(inv.lines.reduce((s, l) => s + lineTotal(l), 0));
export const invoiceTax = (inv) => round2(invoiceSubtotal(inv) * ((Number(inv.taxRate) || 0) / 100));
export const invoiceTotal = (inv) => round2(invoiceSubtotal(inv) + invoiceTax(inv));

/** Stored status plus the derived "overdue" state for sent invoices past their due date. */
export function invoiceStatus(inv, today = new Date().toISOString().slice(0, 10)) {
  if (inv.status === 'sent' && inv.dueDate < today) return 'overdue';
  return inv.status;
}

export function validateInvoice(inv) {
  const errors = [];
  if (!inv.contactId) errors.push('Choose who the invoice is to.');
  if (!inv.payToConnectionId) errors.push('Choose where you want to be paid.');
  if (!inv.lines.length || inv.lines.some((l) => !String(l.desc).trim())) errors.push('Every line needs a description.');
  if (inv.lines.some((l) => !(Number(l.qty) > 0) || Number(l.unitPrice) < 0 || l.unitPrice === '')) errors.push('Quantities must be above zero and prices zero or more.');
  if (invoiceTotal(inv) <= 0) errors.push('The invoice total must be above zero.');
  if (inv.dueDate < inv.issueDate) errors.push('The due date cannot be before the issue date.');
  return errors;
}

/** Ledger receipts that could settle this invoice: same asset, same receiving account, money in, not already used. */
export function matchCandidates(inv, transactions) {
  const total = invoiceTotal(inv);
  return transactions
    .filter((t) => t.connectionId === inv.payToConnectionId && t.asset === inv.currency && t.amount > 0 && !t.invoiceId && t.type === 'deposit')
    .map((t) => ({ t, diff: Math.abs(t.amount - total) }))
    .sort((a, b) => a.diff - b.diff || b.t.date.localeCompare(a.t.date))
    .slice(0, 8)
    .map(({ t, diff }) => ({ ...t, exact: diff < 0.005 }));
}
