import { INITIAL_TRANSACTIONS } from "./seed";
import type { AuditEntry, Transaction, TransactionStatus } from "./schemas";

// shortcut: in-memory demo store; replace with PostgreSQL/Drizzle for persistent multi-instance deployment
const transactions: Transaction[] = INITIAL_TRANSACTIONS.map((tx) => ({ ...tx }));
const auditLog: AuditEntry[] = [
  {
    id: "AUD-1001",
    timestamp: "2026-11-23T06:45:00Z",
    transactionId: "TX-9035",
    previousStatus: "pending",
    nextStatus: "frozen",
    reason: "Auto-held by KYB beneficiary mismatch rule.",
    actor: "policy-engine",
  },
];

export function getTransactions(): Transaction[] {
  return transactions.map((tx) => ({ ...tx }));
}

export function getTransactionById(id: string): Transaction | null {
  const found = transactions.find((tx) => tx.id === id);
  return found ? { ...found } : null;
}

export function getAuditLog(): AuditEntry[] {
  return auditLog.map((entry) => ({ ...entry }));
}

export function updateTransactionStatus(
  transactionId: string,
  nextStatus: TransactionStatus,
  reason: string,
  actor = "analyst@finguard.ai"
): { transaction: Transaction; audit: AuditEntry } | null {
  const target = transactions.find((tx) => tx.id === transactionId);
  if (!target) return null;

  const previousStatus = target.status;
  target.status = nextStatus;

  const audit: AuditEntry = {
    id: `AUD-${1001 + auditLog.length}`,
    timestamp: new Date().toISOString(),
    transactionId,
    previousStatus,
    nextStatus,
    reason,
    actor,
  };
  auditLog.unshift(audit);

  return { transaction: { ...target }, audit };
}
