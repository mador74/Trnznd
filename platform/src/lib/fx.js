// Display currencies. Every value is stored and calculated in USD; these rates only change
// how totals are shown. DEMO rates (USD per 1 unit), not live market data. AED uses its
// official USD peg of 3.6725 AED per USD.

export const DISPLAY_CURRENCIES = {
  USD: { name: 'US Dollar', usdPer: 1 },
  EUR: { name: 'Euro', usdPer: 1.08 },
  GBP: { name: 'British Pound', usdPer: 1.27 },
  CHF: { name: 'Swiss Franc', usdPer: 1.12 },
  SGD: { name: 'Singapore Dollar', usdPer: 0.75 },
  AED: { name: 'UAE Dirham', usdPer: 1 / 3.6725 },
  AUD: { name: 'Australian Dollar', usdPer: 0.66 },
  JPY: { name: 'Japanese Yen', usdPer: 0.0067 },
};

/** Converts a USD amount into `code` (falls back to USD for an unknown code). */
export function fromUsd(usdAmount, code) {
  const c = DISPLAY_CURRENCIES[code] || DISPLAY_CURRENCIES.USD;
  return usdAmount / c.usdPer;
}
