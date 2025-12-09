export type TransactionKind = "income" | "bill" | "saving";
export type SavingsMode = "fixed" | "percentage";

export type TransactionLike = {
  _id: string;
  type: TransactionKind;
  amountCents: number;
  date: string;
  isPaid: boolean;
  order: number;
  label: string;
  mode: SavingsMode;
  savingsPercentage?: number;
  linkedIncomeId?: string;
};

export function resolveSavingsAmounts<T extends TransactionLike>(transactions: T[]): T[] {
  const incomeLookup = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") {
      incomeLookup.set(tx._id, tx.amountCents);
    }
  }

  return transactions.map((tx) => {
    if (tx.type !== "saving" || tx.mode === "fixed") {
      return tx;
    }
    const incomeAmount = tx.linkedIncomeId
      ? incomeLookup.get(tx.linkedIncomeId) ?? 0
      : 0;
    const pct = tx.savingsPercentage ?? 0;
    const computed = Math.round((incomeAmount * pct) / 100);
    return { ...tx, amountCents: computed };
  });
}

export function calculateBalances(transactions: TransactionLike[], startingBalanceCents: number) {
  const resolved = resolveSavingsAmounts(transactions).sort((a, b) => a.order - b.order);

  // Running balance: starting balance + paid items only
  const currentBankBalanceCents = resolved.reduce((acc, tx) => {
    if (!tx.isPaid) return acc;
    const delta = tx.type === "income" ? tx.amountCents : -tx.amountCents;
    return acc + delta;
  }, startingBalanceCents);

  // Cumulative balances: always show running total from starting balance
  // regardless of paid status (for the "After" display on each item)
  let cumulative = startingBalanceCents;
  const projectedBalances: Record<string, number> = {};

  for (const tx of resolved) {
    const delta = tx.type === "income" ? tx.amountCents : -tx.amountCents;
    cumulative += delta;
    projectedBalances[tx._id] = cumulative;
  }

  const projectedEndBalanceCents = cumulative;

  return {
    resolved,
    currentBankBalanceCents,
    projectedBalances,
    projectedEndBalanceCents,
  };
}

export function formatCurrency(cents: number, currency = "USD") {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return formatter.format(cents / 100);
}

export function toCents(value: string) {
  const numeric = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(numeric)) return 0;
  return Math.round(numeric * 100);
}

