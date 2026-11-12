export type Chain = 'ETH' | 'SOL' | 'TRX';
export type Token = 'USDT' | 'USDC';
/** Direction relative to the company as a whole (all of its wallets). */
export type Direction = 'in' | 'out' | 'internal';
/** receivable = we asked someone to pay us; payable = someone asked us to pay them. */
export type RequestKind = 'receivable' | 'payable';
export type TxSource = 'api' | 'csv' | 'manual' | 'demo';
export type TxCategory = 'internal' | 'fee' | 'refund' | 'owner' | 'exchange' | 'overpayment' | 'other';

export interface Wallet {
  id: string;
  label: string;
  chain: Chain;
  address: string;
  createdAt: string;
  /** Per-token sync cursor (block number, timestamp or signature, depending on chain). */
  cursor?: Partial<Record<Token, string>>;
  lastSyncAt?: string;
  lastSyncError?: string;
  demo?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  addresses: { chain: Chain; address: string }[];
  notes?: string;
}

export interface PaymentRequest {
  id: string;
  number: string;
  kind: RequestKind;
  contactId?: string;
  counterparty: string;
  /** Wallet the counterparty is expected to pay from (receivable) or that we pay to (payable). */
  counterpartyAddress?: string;
  /** Our wallet: receiving wallet for receivables, paying wallet for payables. */
  walletId?: string;
  chain: Chain;
  token: Token;
  /** Amount in micro-units (6 decimals, 1 USDT = 1_000_000). */
  amount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  reference: string;
  description?: string;
  voided?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  chain: Chain;
  token: Token;
  hash: string;
  timestamp: string; // ISO 8601 UTC
  from: string;
  to: string;
  /** Micro-units, always positive. */
  amount: number;
  walletId?: string;
  direction: Direction;
  memo?: string;
  block?: number;
  source: TxSource;
  /** Set when the transaction (or the unallocated remainder of it) is explained without a payment request. */
  category?: TxCategory;
  note?: string;
  importedAt: string;
}

export interface Allocation {
  id: string;
  txId: string;
  requestId: string;
  amount: number; // micro-units
  method: 'auto' | 'manual';
  createdAt: string;
}

export interface Adjustment {
  id: string;
  requestId: string;
  amount: number; // micro-units, positive reduces the outstanding balance
  reason: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface Settings {
  companyName: string;
  requestPrefix: string;
  nextRequestNumber: number;
  /** Absolute matching tolerance in micro-units. */
  toleranceAbs: number;
  /** Relative matching tolerance in percent of the request amount. */
  tolerancePct: number;
  /** Days after the due date during which a payment still scores as "on time". */
  dateWindowDays: number;
  etherscanApiKey?: string;
  trongridApiKey?: string;
  solanaRpcUrl?: string;
  theme: 'dark' | 'light';
}

export interface AppData {
  version: 1;
  settings: Settings;
  wallets: Wallet[];
  contacts: Contact[];
  requests: PaymentRequest[];
  transactions: Transaction[];
  allocations: Allocation[];
  adjustments: Adjustment[];
  activity: ActivityEntry[];
}

export const CHAINS: Chain[] = ['ETH', 'SOL', 'TRX'];
export const TOKENS: Token[] = ['USDT', 'USDC'];
export const CATEGORY_LABELS: Record<TxCategory, string> = {
  internal: 'Internal transfer',
  fee: 'Fee / network cost',
  refund: 'Refund',
  owner: 'Owner / capital movement',
  exchange: 'Exchange deposit / withdrawal',
  overpayment: 'Overpayment held as credit',
  other: 'Other (see note)',
};
