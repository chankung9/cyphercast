const milestones = [
  { title: "Streams live", value: "8" },
  { title: "Active viewers", value: "1.2K" },
  { title: "Vault TVL", value: "42,500 SPL" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">Operations dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Snapshot of Solana program activity used by operators and compliance reviewers.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {milestones.map((item) => (
            <div key={item.title} className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.title}</p>
              <p className="text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Stream health</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-lg bg-background/70 px-4 py-3">
              <span>Creator AMA</span>
              <span className="text-muted-foreground">Lock in 12m</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-background/70 px-4 py-3">
              <span>Launch Countdown</span>
              <span className="text-muted-foreground">Tip 5%</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-background/70 px-4 py-3">
              <span>Esports Finals</span>
              <span className="text-muted-foreground">Stake cap 2,500</span>
            </li>
          </ul>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Compliance checklist</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Doc-sync proof stored in audit/logs/</li>
            <li>Surfpool smoke run ID appended to release</li>
            <li>Stake anomaly alerts configured</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
