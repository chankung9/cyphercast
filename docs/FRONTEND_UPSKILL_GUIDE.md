# Frontend Upskill Guide — React + Solana Web3

Codex engineers stepping into the cyphercast frontend must master React, modern Web3 tooling, and Solana-specific UX patterns. Use this guide to chart the skill areas, preferred tooling, and reference frameworks we expect the team to know before tackling implementation work.

## Core React + TypeScript Competencies

- React 18 with hooks, concurrent rendering, and Suspense-aware patterns.
- TypeScript-first codebase: strict mode (`"strict": true`), discriminated unions for Web3 state, utility types for API responses.
- State management:
  - Local UI: `useState`, `useReducer`, `useMemo` with linting rules to prevent stale closures.
  - Global app state: prefer [Zustand](https://github.com/pmndrs/zustand) or [Redux Toolkit](https://redux-toolkit.js.org/) for predictable wallet + session state.
  - Async data: [TanStack Query](https://tanstack.com/query/latest) or [SWR](https://swr.vercel.app/) for RPC calls, caching, and refetch orchestration.
- Routing: [Next.js App Router](https://nextjs.org/docs/app) or [React Router v6+](https://reactrouter.com/) with code-splitting for feature gates (e.g., gated staking flows).
- Forms & validation: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for schema-safe payloads targeting Solana PDAs.
- Testing: Vitest/Jest for unit tests, React Testing Library for components, Cypress/Playwright for wallet interaction smoke tests.

## Solana Web3 Integration Skill Set

- Wallet adapters:
  - [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) with React UI components.
  - Composability with `@solana/wallet-adapter-react` context; guard pages for wallet requirements.
- Client SDKs:
  - `@solana/web3.js` for low-level RPC and transaction assembly.
  - Anchor client (`@project-serum/anchor`) pattern: IDL typing, `Provider` setup, robust error handling (e.g., `AnchorError` mapping).
- Transaction UX:
  - Staged UX (prepare → review → submit → confirm) to keep users in sync with Solana finality.
  - Toast/notification framework (e.g., [sonner](https://sonner.emilkowal.ski/) or [react-hot-toast](https://react-hot-toast.com/)) integrated with confirmation polling.
- RPC and cluster management:
  - Understand cluster selection (localnet, devnet, mainnet-beta) + fallback providers (Helius, Triton).
  - Rate-limit handling, caching of account fetches, and error classification for user messaging.
- Security posture:
  - Sanitizing user input to prevent malicious transaction data.
  - Guarding against replays (nonces, blockhash expiry awareness).
  - Secure storage of session tokens; no long-lived secret keys client-side.

## Styling & Component Framework Options

Evaluate the following combinations to deliver a polished, maintainable UI:

- **Tailwind CSS + shadcn/ui**  
  - Pros: Composable utility classes, design system primitives, Radix-based accessibility.  
  - Use cases: Fast iteration, fine-grained control, dark mode support.
- **Chakra UI**  
  - Pros: Theme-first API, accessible components out of the box, good for dashboard experiences.  
  - Consider for: Rapid prototyping, teams favoring props-based styling.
- **Mantine**  
  - Pros: Rich component suite (data tables, notifications), hooks collection.  
  - Consider for: Data-heavy screens like prediction analytics.
- **Material UI (MUI)**  
  - Pros: Enterprise design language, strong a11y, theming.  
  - Cost: Heavier bundle, may require custom tokens to match Solana branding.
- **Styled Components / Emotion**  
  - Pros: Colocated styling, dynamic theming.  
  - Use for: Niche components requiring CSS-in-JS beyond utility classes.
- **Radix Primitives + Vanilla Extract**  
  - Pros: Low-level primitives with zero-runtime CSS.  
  - Use for: Design system purists, performance-sensitive flows.

> **Recommendation:** Start with **Next.js + Tailwind CSS + shadcn/ui** (aligns with Solana dApp Scaffold) and layer Mantine or Chakra for complex dashboard widgets if needed. Maintain a tokens-based theme file for brand cohesion.

## Reference Templates & Scaffolds

- [Solana dApp Scaffold (React/Next.js)](https://github.com/solana-developers/dapp-scaffold)  
  Ready-made wallet adapter integration, Tailwind setup, example transactions.
- [solana-labs/wallet-adapter examples](https://github.com/solana-labs/wallet-adapter/tree/master/packages/example)  
  Demonstrates wallet contexts, modals, and multi-wallet support.
- [Anchor React Template (metaplex-foundation)](https://github.com/metaplex-foundation/js-examples)  
  Anchor-client integration with typed IDLs.
- [Create Web3 Dapp (Vite + TypeScript)](https://github.com/solana-developers/solana-vite-template)  
  Lightweight alternative if Next.js routing is not required.

Study these repos to understand folder structure, wallet modal configuration, and environment variable hygiene.

## Development Tooling Expectations

- Use [PNPM](https://pnpm.io/) or [Yarn Berry] for workspace support (monorepo-friendly) unless downstream repo mandates npm.
- Linting:
  - ESLint with React, TypeScript, and security plugins (`eslint-plugin-security`, `eslint-plugin-import`).
  - Prettier for formatting consistency; integrate with Husky pre-commit hooks.
- Git hooks:
  - `lint-staged` for running ESLint + type-check on staged files.
  - Pre-push hook for unit tests or targeted integration tests.
- Storybook or [Ladle](https://ladle.dev/) for component previews; ensures design consistency and accessible states.
- Visual regression testing (Chromatic or Loki) for critical UI flows (predictions dashboard, staking modals).

## Learning Roadmap

1. **Foundation (Week 1-2)**  
   TypeScript essentials, React hooks patterns, Tailwind CSS fundamentals, Next.js routing basics.
2. **Solana Integration (Week 3-4)**  
   Wallet adapter API, connecting to devnet/localnet, signing transactions, error surfaces.
3. **UX + State Management (Week 5)**  
   Build wallet-aware components, integrate TanStack Query for RPC data, implement optimistic UI patterns.
4. **Testing & Security (Week 6)**  
   Write component tests, mock wallet contexts, fuzz transaction builders, run Lighthouse for performance/accessibility.
5. **Architecture Patterns (Week 7+)**  
   Introduce feature modules, micro-frontends (if needed), analytics instrumentation, enterprise observability stacks.

## Skill Verification

- Complete a mini-project that:
  - Connects to devnet, displays wallet balances, lets users stake tokens in a mock pool.
  - Uses the recommended styling stack and logs actions to console analytics.
- Submit code review demonstrating adherence to lint rules, accessible components, and typed transaction builders.
- Document learnings in `reports/projects/cyphercast/staff_reports/` referencing timestamps from `./scripts/current_time.sh`.
