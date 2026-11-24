export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: false },
  modules: ["@nuxtjs/tailwindcss"],
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "FinGuard AI (Nuxt) — Real-Time FinTech Transaction & Risk Analyzer",
      meta: [
        {
          name: "description",
          content:
            "AI-assisted FinTech compliance dashboard built with Nuxt 3, Vue 3 Composition API, Nitro, TypeScript, Zod, Gemini API, CSP headers, and prompt-injection guardrails.",
        },
      ],
    },
  },
});
