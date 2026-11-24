import { z } from "zod";

export const TransactionStatusSchema = z.enum(["pending", "approved", "flagged", "frozen"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "TRY"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const ChannelSchema = z.enum(["SWIFT Wire", "SEPA Instant", "Corporate Card", "API Payout"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  merchant: z.string(),
  category: z.string(),
  country: z.string(),
  amount: z.number().positive(),
  currency: CurrencySchema,
  channel: ChannelSchema,
  accountId: z.string(),
  velocity24hCount: z.number().int().nonnegative(),
  status: TransactionStatusSchema,
  note: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RecommendedActionSchema = z.enum(["APPROVE", "REVIEW", "FLAG", "FREEZE"]);
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

export const RiskReportSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  recommendedAction: RecommendedActionSchema,
  summary: z.string().min(10).max(500),
  redFlags: z.array(z.string()).max(6),
  toolChecks: z.array(z.object({ tool: z.string(), result: z.string() })),
  engine: z.enum(["gemini", "local-policy-fallback"]),
});
export type RiskReport = z.infer<typeof RiskReportSchema>;

export const AnalyzeRequestSchema = z.object({
  transactionId: z.string().min(1).max(64).optional(),
  customNote: z.string().max(1500).optional(),
});

export const UpdateStatusInputSchema = z.object({
  transactionId: z.string().min(1).max(64),
  nextStatus: TransactionStatusSchema,
  reason: z.string().min(3).max(240),
});

export interface AuditEntry {
  id: string;
  timestamp: string;
  transactionId: string;
  previousStatus: TransactionStatus;
  nextStatus: TransactionStatus;
  reason: string;
  actor: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /system\s*prompt/gi,
  /you\s+are\s+now\s+/gi,
  /disregard\s+policy/gi,
  /<\s*\/?\s*(script|system|assistant|user)\b[^>]*>/gi,
];

export function sanitizePromptInput(raw: string): { sanitized: string; flaggedPatterns: number } {
  let flaggedPatterns = 0;
  let cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .trim();

  for (const pattern of INJECTION_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      flaggedPatterns += matches.length;
      cleaned = cleaned.replace(pattern, "[REDACTED_DIRECTIVE]");
    }
  }
  return { sanitized: cleaned.slice(0, 1500), flaggedPatterns };
}

// shortcut: in-memory sliding-window rate limiter; replace with Redis/Upstash for multi-instance production
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit = 15,
  windowMs = 60_000,
  now = Date.now()
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const cutoff = now - windowMs;
  const recent = (rateBuckets.get(key) ?? []).filter((ts) => ts > cutoff);
  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(key, recent);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return { allowed: true, remaining: limit - recent.length, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  rateBuckets.clear();
}
