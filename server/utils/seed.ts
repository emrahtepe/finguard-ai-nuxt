import type { Currency, RecommendedAction, RiskLevel, RiskReport, Transaction } from "./schemas";

const FX_TO_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  TRY: 0.029,
};

const HIGH_RISK_COUNTRIES = new Set(["KY", "VG", "PA", "RU", "BY", "KP"]);
const HIGH_RISK_CATEGORIES = new Set(["Crypto OTC", "Offshore Shell", "Gambling Gateway", "Unverified Wire"]);

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "TX-9041",
    timestamp: "2026-11-23T09:42:00Z",
    merchant: "Apex Offshore Holdings Ltd",
    category: "Offshore Shell",
    country: "KY",
    amount: 48500,
    currency: "USD",
    channel: "SWIFT Wire",
    accountId: "ACC-4410",
    velocity24hCount: 6,
    status: "pending",
    note: "Urgent split-invoice wire requested outside normal settlement window.",
  },
  {
    id: "TX-9040",
    timestamp: "2026-11-23T09:15:00Z",
    merchant: "BitFlow OTC Desk",
    category: "Crypto OTC",
    country: "VG",
    amount: 19200,
    currency: "EUR",
    channel: "API Payout",
    accountId: "ACC-2104",
    velocity24hCount: 9,
    status: "flagged",
    note: "API key rotated 12 minutes prior to burst payout sequence.",
  },
  {
    id: "TX-9039",
    timestamp: "2026-11-23T08:58:00Z",
    merchant: "Cloudflare Enterprise EU",
    category: "Cloud Infrastructure",
    country: "IE",
    amount: 4200,
    currency: "EUR",
    channel: "SEPA Instant",
    accountId: "ACC-1002",
    velocity24hCount: 1,
    status: "approved",
    note: "Monthly recurring infrastructure invoice matching approved PO-8821.",
  },
  {
    id: "TX-9038",
    timestamp: "2026-11-23T08:31:00Z",
    merchant: "Istanbul Logistics A.Ş.",
    category: "Supply Chain",
    country: "TR",
    amount: 315000,
    currency: "TRY",
    channel: "API Payout",
    accountId: "ACC-3309",
    velocity24hCount: 2,
    status: "approved",
    note: "Scheduled domestic freight settlement to verified beneficiary IBAN.",
  },
  {
    id: "TX-9037",
    timestamp: "2026-11-23T07:50:00Z",
    merchant: "NovaBet Settlement AG",
    category: "Gambling Gateway",
    country: "MT",
    amount: 14800,
    currency: "GBP",
    channel: "Corporate Card",
    accountId: "ACC-4410",
    velocity24hCount: 5,
    status: "pending",
    note: "Card-not-present charge from unwhitelisted MCC 7995 merchant.",
  },
  {
    id: "TX-9036",
    timestamp: "2026-11-23T07:12:00Z",
    merchant: "Stripe Billing UK",
    category: "SaaS Subscription",
    country: "GB",
    amount: 1290,
    currency: "GBP",
    channel: "Corporate Card",
    accountId: "ACC-1002",
    velocity24hCount: 1,
    status: "approved",
    note: "Standard recurring developer tooling subscription.",
  },
  {
    id: "TX-9035",
    timestamp: "2026-11-23T06:44:00Z",
    merchant: "PanTrade Clearing Corp",
    category: "Unverified Wire",
    country: "PA",
    amount: 62000,
    currency: "USD",
    channel: "SWIFT Wire",
    accountId: "ACC-7781",
    velocity24hCount: 4,
    status: "frozen",
    note: "Beneficiary name mismatch against KYB registry; auto-held pending analyst review.",
  },
  {
    id: "TX-9034",
    timestamp: "2026-11-23T06:05:00Z",
    merchant: "Figma Organization",
    category: "Design Tooling",
    country: "US",
    amount: 840,
    currency: "USD",
    channel: "Corporate Card",
    accountId: "ACC-1002",
    velocity24hCount: 1,
    status: "approved",
    note: "Quarterly design seat renewal.",
  },
];

export function convertToUsd(amount: number, currency: Currency): number {
  return Math.round(amount * FX_TO_USD[currency] * 100) / 100;
}

export function checkVelocityLimit(velocity24hCount: number, amountUsd: number) {
  if (velocity24hCount >= 5 || (velocity24hCount >= 3 && amountUsd >= 25_000)) {
    return {
      breached: true,
      detail: `Velocity breach: ${velocity24hCount} txns in 24h at $${amountUsd.toLocaleString("en-US")} USD.`,
    };
  }
  return {
    breached: false,
    detail: `Within normal velocity (${velocity24hCount} txns/24h, $${amountUsd.toLocaleString("en-US")} USD).`,
  };
}

export function lookupMerchantRisk(category: string, country: string) {
  const highCat = HIGH_RISK_CATEGORIES.has(category);
  const highGeo = HIGH_RISK_COUNTRIES.has(country.toUpperCase());
  if (highCat && highGeo) {
    return { elevated: true, detail: `High-risk category (${category}) combined with high-risk jurisdiction (${country}).` };
  }
  if (highCat) return { elevated: true, detail: `High-risk merchant category: ${category}.` };
  if (highGeo) return { elevated: true, detail: `Elevated jurisdiction risk: ${country}.` };
  return { elevated: false, detail: `Standard merchant profile (${category}, ${country}).` };
}

export function evaluateDeterministicRisk(
  tx: Transaction | null,
  sanitizedNote: string,
  flaggedInjectionCount: number
): RiskReport {
  let score = 12;
  const redFlags: string[] = [];
  const toolChecks: Array<{ tool: string; result: string }> = [];

  if (tx) {
    const usd = convertToUsd(tx.amount, tx.currency);
    toolChecks.push({ tool: "convertToUsd", result: `${tx.amount} ${tx.currency} = $${usd.toLocaleString("en-US")} USD` });

    const vel = checkVelocityLimit(tx.velocity24hCount, usd);
    toolChecks.push({ tool: "checkVelocityLimit", result: vel.detail });
    if (vel.breached) {
      score += 32;
      redFlags.push(vel.detail);
    }

    const merch = lookupMerchantRisk(tx.category, tx.country);
    toolChecks.push({ tool: "lookupMerchantRisk", result: merch.detail });
    if (merch.elevated) {
      score += 30;
      redFlags.push(merch.detail);
    }

    if (usd >= 25_000) {
      score += 18;
      redFlags.push(`High-value settlement ($${usd.toLocaleString("en-US")} USD exceeds $25k enhanced due-diligence threshold).`);
    }
  }

  if (/urgent|split-invoice|mismatch|rotated|unwhitelisted|offshore/i.test(sanitizedNote)) {
    score += 14;
    redFlags.push("Narrative contains compliance anomaly indicators (urgency, split-invoice, key rotation, or mismatch).");
  }

  if (flaggedInjectionCount > 0) {
    score = Math.min(100, score + 15);
    redFlags.push(`Input sanitization neutralized ${flaggedInjectionCount} prompt-injection directive(s).`);
  }

  score = Math.min(100, Math.max(0, score));
  let riskLevel: RiskLevel = "LOW";
  let recommendedAction: RecommendedAction = "APPROVE";
  if (score >= 80) {
    riskLevel = "CRITICAL";
    recommendedAction = "FREEZE";
  } else if (score >= 60) {
    riskLevel = "HIGH";
    recommendedAction = "FLAG";
  } else if (score >= 35) {
    riskLevel = "MEDIUM";
    recommendedAction = "REVIEW";
  }

  const targetName = tx ? `${tx.id} (${tx.merchant})` : "custom document excerpt";
  const summary =
    redFlags.length > 0
      ? `Policy evaluation for ${targetName} returned ${riskLevel} risk (${score}/100) based on ${redFlags.length} triggered control(s). Recommended action: ${recommendedAction}.`
      : `Policy evaluation for ${targetName} returned LOW risk (${score}/100) with no velocity, jurisdiction, or narrative anomalies detected.`;

  return {
    riskScore: score,
    riskLevel,
    recommendedAction,
    summary,
    redFlags,
    toolChecks,
    engine: "local-policy-fallback",
  };
}
