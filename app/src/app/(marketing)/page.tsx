import Link from "next/link";
import type { Metadata } from "next";

const highlights = [
  {
    title: "Wallet aware",
    description: "Pre-wire Phantom / Backpack flows with optimistic UI states.",
  },
  {
    title: "Surfpool ready",
    description: "One command spin-up for validator + doc-linked smoke tests.",
  },
  {
    title: "Analytics hooks",
    description: "Emit structured stake / claim events for dashboards and alerts.",
  },
];

export const metadata: Metadata = {
  title: "Cyphercast · Watch. Predict. Earn.",
};

export default function MarketingPage() {
  return (
    <div className="space-y-12">
      <section className="grid gap-10 rounded-2xl border border-border/60 bg-card p-8 shadow-2xl shadow-primary/10 sm:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Solana Interactive Streaming</p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Turn every live moment into an on-chain economy.
          </h1>
          <p className="text-lg text-muted-foreground">
            Cyphercast lets viewers stake SPL tokens on live predictions, tips creators automatically, and pays out winners instantly.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/40 transition hover:-translate-y-0.5"
            >
              View operator dashboard
            </Link>
            <Link
              href="/stake"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              Explore stake flow
            </Link>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Phase", value: "2.5 complete" },
              { label: "TVL proven", value: "50K demo tokens" },
              { label: "Latency", value: "<1s Surfpool" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</dt>
                <dd className="text-xl font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-xl border border-primary/40 bg-gradient-to-b from-primary/15 to-secondary/20 p-6">
          <p className="text-sm text-muted-foreground">Pipeline snapshot</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-lg bg-background/60 px-4 py-3">Phase 3 · Frontend scaffold ✅</li>
            <li className="rounded-lg bg-background/60 px-4 py-3">Phase 3 · Wallet integration ⌛</li>
            <li className="rounded-lg bg-background/60 px-4 py-3">Phase 4 · Creator pilots 🔜</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-border/50 bg-card/60 p-5 shadow-lg shadow-black/10"
          >
            <h3 className="text-base font-semibold text-primary">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
