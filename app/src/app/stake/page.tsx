const steps = [
  {
    title: "Connect wallet",
    detail: "Use Phantom, Backpack, or TestAdapter to load balances.",
  },
  {
    title: "Join stream",
    detail: "Initialize participant PDA + prefund token account.",
  },
  {
    title: "Stake prediction",
    detail: "Send SPL tokens to TokenVault with stake memo metadata.",
  },
  {
    title: "Claim reward",
    detail: "Payout determined by proportional stake after oracle resolution.",
  },
];

export default function StakePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Stake simulation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page will host the interactive stake widget powered by wallet adapters and TanStack Query.
        </p>
      </section>

      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-border/70 bg-background/60 p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Step {index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
