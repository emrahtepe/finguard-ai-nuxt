<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-vue-next";
import type { AuditEntry, RiskReport, Transaction, TransactionStatus } from "~/server/utils/schemas";

const route = useRoute();
const router = useRouter();

const { data: initialData } = await useFetch<{
  transactions: Transaction[];
  auditLog: AuditEntry[];
}>("/api/ledger");

const transactions = ref<Transaction[]>(initialData.value?.transactions ?? []);
const auditLog = ref<AuditEntry[]>(initialData.value?.auditLog ?? []);
const selectedId = ref<string>(transactions.value[0]?.id ?? "");
const customNote = ref("");
const report = ref<RiskReport | null>(null);
const analyzing = ref(false);
const updating = ref(false);
const errorMsg = ref<string | null>(null);

const statusFilter = computed<TransactionStatus | "all">(
  () => (route.query.status as TransactionStatus) || "all"
);
const queryFilter = computed<string>(() => (route.query.q as string) || "");

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  flagged: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  frozen: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const RISK_STYLES = {
  LOW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  HIGH: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  CRITICAL: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

function setUrlParam(key: string, value: string) {
  const nextQuery = { ...route.query };
  if (!value || value === "all") delete nextQuery[key];
  else nextQuery[key] = value;
  router.replace({ query: nextQuery });
}

const filtered = computed(() =>
  transactions.value.filter((tx) => {
    if (statusFilter.value !== "all" && tx.status !== statusFilter.value) return false;
    if (queryFilter.value.trim()) {
      const q = queryFilter.value.trim().toLowerCase();
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.merchant.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.country.toLowerCase().includes(q)
      );
    }
    return true;
  })
);

const selectedTx = computed(
  () => transactions.value.find((tx) => tx.id === selectedId.value) ?? null
);

const counts = computed(() => ({
  total: transactions.value.length,
  pending: transactions.value.filter((t) => t.status === "pending").length,
  flagged: transactions.value.filter((t) => t.status === "flagged").length,
  frozen: transactions.value.filter((t) => t.status === "frozen").length,
}));

function selectRow(id: string) {
  selectedId.value = id;
  report.value = null;
}

async function handleStatusChange(tx: Transaction, nextStatus: TransactionStatus) {
  errorMsg.value = null;
  updating.value = true;
  const previousStatus = tx.status;
  // Optimistic update with rollback on error
  transactions.value = transactions.value.map((item) =>
    item.id === tx.id ? { ...item, status: nextStatus } : item
  );
  try {
    const res = await $fetch<{ transaction: Transaction; audit: AuditEntry }>("/api/status", {
      method: "POST",
      body: {
        transactionId: tx.id,
        nextStatus,
        reason: `Analyst action: set ${tx.id} to ${nextStatus}`,
      },
    });
    transactions.value = transactions.value.map((item) =>
      item.id === res.transaction.id ? res.transaction : item
    );
    auditLog.value = [res.audit, ...auditLog.value];
  } catch (err) {
    transactions.value = transactions.value.map((item) =>
      item.id === tx.id ? { ...item, status: previousStatus } : item
    );
    errorMsg.value = err instanceof Error ? err.message : "Status update failed.";
  } finally {
    updating.value = false;
  }
}

async function runAnalysis(mode: "transaction" | "custom") {
  analyzing.value = true;
  errorMsg.value = null;
  try {
    const body =
      mode === "transaction"
        ? { transactionId: selectedId.value }
        : { customNote: customNote.value.trim() };
    report.value = await $fetch<RiskReport>("/api/analyze", { method: "POST", body });
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : "Analysis request failed.";
  } finally {
    analyzing.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <ShieldCheck class="h-7 w-7 text-emerald-400" aria-hidden="true" />
          <div>
            <h1 class="text-lg font-semibold tracking-tight text-white">FinGuard AI · Nuxt</h1>
            <p class="text-xs text-slate-400">
              Real-Time Transaction Risk Monitor · Nuxt 3 + Vue 3 Composition API + Nitro + Gemini
            </p>
          </div>
        </div>
        <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          CSP + Prompt Guard Active
        </span>
      </div>
    </header>

    <main class="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <section aria-label="Ledger summary" class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-400">Monitored Ledger</p>
          <p class="mt-1 text-2xl font-bold text-white">{{ counts.total }}</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-400">Pending Review</p>
          <p class="mt-1 text-2xl font-bold text-amber-300">{{ counts.pending }}</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-400">Flagged Anomalies</p>
          <p class="mt-1 text-2xl font-bold text-orange-300">{{ counts.flagged }}</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-400">Frozen Holds</p>
          <p class="mt-1 text-2xl font-bold text-rose-300">{{ counts.frozen }}</p>
        </div>
      </section>

      <div
        v-if="errorMsg"
        role="alert"
        class="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        <AlertTriangle class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ errorMsg }}</span>
      </div>

      <div class="grid gap-6 lg:grid-cols-12">
        <section
          aria-label="Transactions ledger"
          class="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-7"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative flex-1">
              <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search transactions by ID, merchant, category, or country"
                :value="queryFilter"
                placeholder="Search TX ID, merchant, category, country..."
                class="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                @input="setUrlParam('q', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              <button
                v-for="st in (['all', 'pending', 'flagged', 'frozen', 'approved'] as const)"
                :key="st"
                type="button"
                class="rounded-lg border px-2.5 py-1.5 text-xs font-medium capitalize transition"
                :class="
                  statusFilter === st
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                "
                @click="setUrlParam('status', st)"
              >
                {{ st }}
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th class="py-2.5 pr-3">ID / Merchant</th>
                  <th class="py-2.5 pr-3">Amount</th>
                  <th class="py-2.5 pr-3">Channel</th>
                  <th class="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr v-if="filtered.length === 0">
                  <td colspan="4" class="py-8 text-center text-slate-400">
                    No transactions match the current filter.
                  </td>
                </tr>
                <tr
                  v-for="tx in filtered"
                  :key="tx.id"
                  tabindex="0"
                  :aria-selected="tx.id === selectedId"
                  class="cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  :class="tx.id === selectedId ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'"
                  @click="selectRow(tx.id)"
                  @keydown.enter.prevent="selectRow(tx.id)"
                  @keydown.space.prevent="selectRow(tx.id)"
                >
                  <td class="py-3 pr-3">
                    <div class="font-medium text-white">{{ tx.merchant }}</div>
                    <div class="text-xs text-slate-400">{{ tx.id }} · {{ tx.category }} · {{ tx.country }}</div>
                  </td>
                  <td class="py-3 pr-3 font-mono text-slate-100">
                    {{ tx.amount.toLocaleString("en-US") }} {{ tx.currency }}
                  </td>
                  <td class="py-3 pr-3 text-xs text-slate-300">
                    <div>{{ tx.channel }}</div>
                    <div class="text-slate-500">{{ tx.velocity24hCount }}x / 24h</div>
                  </td>
                  <td class="py-3">
                    <span
                      class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize"
                      :class="STATUS_STYLES[tx.status]"
                    >
                      {{ tx.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="space-y-5 lg:col-span-5">
          <div v-if="selectedTx" class="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-mono text-xs text-emerald-400">{{ selectedTx.id }}</p>
                <h2 class="text-base font-semibold text-white">{{ selectedTx.merchant }}</h2>
                <p class="mt-1 text-xs text-slate-400">{{ selectedTx.note }}</p>
              </div>
              <span
                class="rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize"
                :class="STATUS_STYLES[selectedTx.status]"
              >
                {{ selectedTx.status }}
              </span>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                :disabled="analyzing"
                class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                @click="runAnalysis('transaction')"
              >
                <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
                {{ analyzing ? "Analyzing..." : "Run AI Risk Analysis" }}
              </button>
              <button
                type="button"
                :disabled="updating"
                class="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                @click="handleStatusChange(selectedTx, 'approved')"
              >
                <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" /> Approve
              </button>
              <button
                type="button"
                :disabled="updating"
                class="inline-flex items-center gap-1 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-300 hover:bg-orange-500/20"
                @click="handleStatusChange(selectedTx, 'flagged')"
              >
                <ShieldAlert class="h-3.5 w-3.5" aria-hidden="true" /> Flag
              </button>
              <button
                type="button"
                :disabled="updating"
                class="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                @click="handleStatusChange(selectedTx, 'frozen')"
              >
                <Lock class="h-3.5 w-3.5" aria-hidden="true" /> Freeze
              </button>
            </div>

            <div
              v-if="report"
              aria-live="polite"
              class="space-y-3 rounded-lg border border-slate-700 bg-slate-950/90 p-4 text-xs"
            >
              <div class="flex items-center justify-between">
                <span class="rounded-full border px-2.5 py-0.5 font-semibold" :class="RISK_STYLES[report.riskLevel]">
                  {{ report.riskLevel }} · {{ report.riskScore }}/100
                </span>
                <span class="font-mono text-[11px] text-slate-400">
                  Action: {{ report.recommendedAction }} · {{ report.engine }}
                </span>
              </div>
              <p class="leading-relaxed text-slate-200">{{ report.summary }}</p>
              <ul v-if="report.redFlags.length" class="list-disc space-y-1 pl-4 text-rose-300">
                <li v-for="(flag, i) in report.redFlags" :key="i">{{ flag }}</li>
              </ul>
              <div v-if="report.toolChecks.length" class="space-y-1 border-t border-slate-800 pt-2">
                <p class="font-semibold text-slate-400">Deterministic Tool Checks</p>
                <div v-for="(tc, i) in report.toolChecks" :key="i" class="font-mono text-[11px] text-slate-300">
                  <span class="text-emerald-400">{{ tc.tool }}:</span> {{ tc.result }}
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div class="flex items-center gap-2">
              <FileSearch class="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 class="text-sm font-semibold text-white">Invoice / Wire Memo Scanner (Prompt-Guard)</h2>
            </div>
            <textarea
              v-model="customNote"
              rows="3"
              aria-label="Paste an invoice memo or wire narrative for risk analysis"
              placeholder="Paste a wire memo or test prompt injection..."
              class="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            <button
              type="button"
              :disabled="analyzing || !customNote.trim()"
              class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
              @click="runAnalysis('custom')"
            >
              Scan Memo
            </button>
          </div>

          <div class="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 class="text-sm font-semibold text-white">Audit Trail</h2>
            <ul class="max-h-44 space-y-2 overflow-y-auto text-xs">
              <li
                v-for="entry in auditLog"
                :key="entry.id"
                class="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5"
              >
                <div class="flex justify-between font-mono text-[11px] text-slate-400">
                  <span>{{ entry.transactionId }}: {{ entry.previousStatus }} → {{ entry.nextStatus }}</span>
                  <span>{{ entry.id }}</span>
                </div>
                <p class="mt-1 text-slate-300">{{ entry.reason }}</p>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>
