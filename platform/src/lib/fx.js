// Display currencies. Every value is stored and calculated in USD; these rates only change
// how totals are shown. DEMO rates (USD per 1 unit), approximate and NOT live market data. Several
// target-market currencies (e.g. ARS, NGN, EGP) move fast, so production needs a live, timestamped feed.
// AED uses its official USD peg of 3.6725 AED per USD.

export const DISPLAY_CURRENCIES = {
  USD: { name: 'US Dollar', usdPer: 1 },
  EUR: { name: 'Euro', usdPer: 1.08 },
  GBP: { name: 'British Pound', usdPer: 1.27 },
  CHF: { name: 'Swiss Franc', usdPer: 1.12 },
  SGD: { name: 'Singapore Dollar', usdPer: 0.75 },
  AED: { name: 'UAE Dirham', usdPer: 1 / 3.6725 },
  AUD: { name: 'Australian Dollar', usdPer: 0.66 },
  JPY: { name: 'Japanese Yen', usdPer: 0.0067 },
  // Latin America
  BRL: { name: 'Brazilian Real', usdPer: 1 / 5.5, region: 'Latin America' },
  MXN: { name: 'Mexican Peso', usdPer: 1 / 18.5, region: 'Latin America' },
  COP: { name: 'Colombian Peso', usdPer: 1 / 4000, region: 'Latin America' },
  CLP: { name: 'Chilean Peso', usdPer: 1 / 950, region: 'Latin America' },
  PEN: { name: 'Peruvian Sol', usdPer: 1 / 3.7, region: 'Latin America' },
  ARS: { name: 'Argentine Peso', usdPer: 1 / 1200, region: 'Latin America' },
  // Africa
  NGN: { name: 'Nigerian Naira', usdPer: 1 / 1550, region: 'Africa' },
  KES: { name: 'Kenyan Shilling', usdPer: 1 / 129, region: 'Africa' },
  ZAR: { name: 'South African Rand', usdPer: 1 / 18, region: 'Africa' },
  GHS: { name: 'Ghanaian Cedi', usdPer: 1 / 12.5, region: 'Africa' },
  EGP: { name: 'Egyptian Pound', usdPer: 1 / 49, region: 'Africa' },
  // South-East Asia
  IDR: { name: 'Indonesian Rupiah', usdPer: 1 / 16300, region: 'South-East Asia' },
  PHP: { name: 'Philippine Peso', usdPer: 1 / 57, region: 'South-East Asia' },
  VND: { name: 'Vietnamese Dong', usdPer: 1 / 25500, region: 'South-East Asia' },
  THB: { name: 'Thai Baht', usdPer: 1 / 33, region: 'South-East Asia' },
  MYR: { name: 'Malaysian Ringgit', usdPer: 1 / 4.3, region: 'South-East Asia' },
};
for (const k of ['USD', 'EUR', 'GBP', 'CHF', 'SGD', 'AED', 'AUD', 'JPY']) DISPLAY_CURRENCIES[k].region = DISPLAY_CURRENCIES[k].region || (k === 'SGD' ? 'South-East Asia' : 'Global');
export const REGIONS = ['Global', 'Latin America', 'Africa', 'South-East Asia'];

/** Converts a USD amount into `code` (falls back to USD for an unknown code). */
export function fromUsd(usdAmount, code) {
  const c = DISPLAY_CURRENCIES[code] || DISPLAY_CURRENCIES.USD;
  return usdAmount / c.usdPer;
}
