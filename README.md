# FinGuard AI (Nuxt 3 + Vue 3 Edition)

AI-assisted FinTech Transaction & Risk Compliance Dashboard built with **Nuxt 3**, **Vue 3 Composition API (`<script setup>`)**, **Nitro Server Routes**, **TypeScript (`strict`)**, **Tailwind CSS**, **Zod**, **Vercel AI SDK + Gemini**, and **Vitest**.

> Part of the **FinGuard AI Framework Trio**:
> - [Next.js Edition](https://github.com/emrahtepe/finguard-ai)
> - **Nuxt 3 Edition** *(this repo)*
> - [Angular Edition](https://github.com/emrahtepe/finguard-ai-angular)

## Architecture Highlights

- **Nuxt 3 SSR + Nitro API:** Server-rendered initial ledger (`useFetch("/api/ledger")`) with URL-synced query filters (`useRoute` / `useRouter`).
- **Optimistic UI with Rollback:** Instant `Approve` / `Flag` / `Freeze` triage via `POST /api/status` (Zod-validated) with an immutable audit trail.
- **Applied AI + Deterministic Tool Grounding:** `POST /api/analyze` runs deterministic FinTech checks (`convertToUsd`, `checkVelocityLimit`, `lookupMerchantRisk`) and synthesizes a Zod-validated `RiskReport` via **Google Gemini (`@ai-sdk/google`)**, falling back gracefully to the deterministic policy engine when no API key is configured.
- **Security First:** Nitro `routeRules` CSP & security headers, prompt-injection sanitization (`sanitizePromptInput`), sliding-window IP rate limiter (HTTP `429` + `Retry-After`), and keyboard-accessible table controls.

## Quick Start

```bash
npm install
cp .env.example .env.local   # Optional: add GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```
