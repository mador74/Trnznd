import type { Transaction, Wallet } from './types';
import { sameAddress } from './chains';

/** Company-relative direction of a transfer, given the company's wallets. Null if it touches none of them. */
export function deriveDirection(tx: Pick<Transaction, 'chain' | 'from' | 'to'>, wallets: Wallet[]): { direction: Transaction['direction']; walletId?: string } | null {
  const mine = wallets.filter((w) => w.chain === tx.chain);
  const fromW = mine.find((w) => sameAddress(tx.chain, w.address, tx.from));
  const toW = mine.find((w) => sameAddress(tx.chain, w.address, tx.to));
  if (fromW && toW) return { direction: 'internal', walletId: toW.id };
  if (toW) return { direction: 'in', walletId: toW.id };
  if (fromW) return { direction: 'out', walletId: fromW.id };
  return null;
}
