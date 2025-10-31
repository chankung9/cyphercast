# Wallet Adapter Stack (ADR-0001)

- **Status:** Accepted
- **Date:** 2025-10-31
- **Context:**  
  Cyphercast requires a consistent wallet integration layer for React-based Solana dApps. The solution must support multiple wallets (Phantom, Solflare, Backpack), align with the Next.js frontend stack, and offer a customizable modal experience compatible with shadcn/ui styling. Prior pilots mixed bespoke wallet connectors with outdated modals, causing UX fragmentation and maintenance overhead.
- **Decision:**  
  Adopt the official [@solana/wallet-adapter](https://github.com/solana-labs/wallet-adapter) suite with the `@solana/wallet-adapter-react` core, `@solana/wallet-adapter-react-ui` components as a base, and wrap the modal UI with shadcn/ui primitives for brand alignment. Configure default adapters (Phantom, Solflare, Backpack, Ledger, Torus) and expose extension points for future wallets via a centralized factory in `src/lib/solana/wallet.tsx`.
- **Consequences:**  
  - Positive: Leverages community-maintained adapters, reduces custom code, ensures rapid wallet updates, and integrates smoothly with Solana dev tooling.  
  - Positive: Unified theming via shadcn/ui ensures accessible, brand-compliant modals.  
  - Negative: Requires tree-shaking and dynamic import tuning to mitigate bundle size; engineers must monitor upstream wallet-adapter releases.  
  - Follow-up: Document adapter overrides in `ENGINEERING_BEST_PRACTICES.md` and add Playwright smoke tests for wallet connect/disconnect flows.
- **References:**  
  - projects/cyphercast/docs/FRONTEND_UPSKILL_GUIDE.md  
  - projects/cyphercast/docs/ENGINEERING_BEST_PRACTICES.md  
  - https://github.com/solana-labs/wallet-adapter  
  - https://ui.shadcn.com/
