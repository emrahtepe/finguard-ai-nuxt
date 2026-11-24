import { getAuditLog, getTransactions } from "../utils/store";

export default defineEventHandler(() => {
  return {
    transactions: getTransactions(),
    auditLog: getAuditLog(),
  };
});
