# Engineering Best Practices — cyphercast

These guidelines define the default architecture, coding style, and development workflow for the cyphercast frontend (React + Solana). Treat them as the canonical reference when bootstrapping new features or reviewing pull requests.

## Project Structure

- Use a modular feature-first directory layout:
  ```
  app/                   # Next.js app router (or src/ for Vite)
    (marketing)/         # Public landing pages
    dashboard/           # Authenticated prediction dashboards
    stake/               # Token staking flows
  src/
    components/          # Shared UI primitives (wallet button, layout)
    features/            # Feature modules with index barrel exports
    hooks/               # Reusable hooks (wallet balance, transaction polling)
    lib/                 # Solana clients, IDL wrappers, helpers
    stores/              # Zustand/Redux stores with selectors
    styles/              # Tailwind config, tokens, global CSS
    utils/               # Formatting, validators, analytics helpers
    tests/               # Integration helpers, mocks
  ```
- Co-locate tests (`Component.test.tsx`), stories (`Component.stories.tsx`), and styles with their components whenever possible.
- Maintain `index.ts` barrel files per feature to control public APIs and tree-shaking.

## Coding Standards

- **TypeScript strictness:** enable `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- **ESLint config:** extend `next/core-web-vitals` (or `eslint-config-airbnb`), add plugins:
  - `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`
  - `eslint-plugin-security`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`
  - Custom rule: disallow `any`; enforce exhaustive `switch` with `ts-exhaustive-check`.
- **Formatting:** Prettier with 2-space indent, 100-character line width, `singleQuote: true`.
- **Naming conventions:**
  - Components: `PascalCase` with `.tsx`.
  - Hooks: `useCamelCase`.
  - Stores: `<feature>Store`.
  - Enums: `UPPER_SNAKE_CASE`.
- **Error handling:** Wrap RPC calls in typed services that return `Result<T, Error>`-style objects (use `neverthrow` or custom helpers).
- **Accessibility:** Use Radix/shadcn primitives where possible; always pair interactive elements with `aria-*` attributes and keyboard handlers.

## Solana Integration Patterns

- Centralize Solana connection in `lib/solana/connection.ts` with lazy provider creation.
- Use Anchor IDLs (`idl.json`) stored under `lib/solana/idl/`; auto-generate types via `anchor build` + `anchor idl fetch`.
- Implement transaction builders per feature in `features/<feature>/transactions.ts`.
- Provide deterministic PDAs via helper functions, validated with unit tests.
- Cache frequently accessed accounts with TanStack Query; set `staleTime` for idempotent data (e.g., `staleTime: 30_000` for balances).
- Abstract wallet adapter UI into `components/wallet/WalletProvider.tsx` and `WalletModal.tsx`.

## Styling & Theming

- Tailwind CSS + shadcn/ui as default:
  - Maintain design tokens in `styles/tokens.ts`.
  - Use `cn` utility for class composition; avoid string concatenation.
- For analytics-heavy screens, integrate Mantine charts/components in isolated wrappers (lazy-load where possible).
- Keep dark/light themes synchronized via CSS variables; store preferences in `localStorage`.
- Enforce accessible color contrast (WCAG AA) checked via Storybook accessibility panel.

## State Management

- Use Zustand slices under `stores/` for wallet, session, and app settings.
- Persist select slices with `zustand/middleware` (e.g., session metadata) while excluding sensitive keys.
- For asynchronous flows:
  - Wrap RPC calls with TanStack Query.
  - Use optimistic updates when possible; rollback on transaction failure.
- Keep derived state memoized (`createSelector` or selectors) to avoid unnecessary re-rendering.

## Testing Strategy

- Unit tests (Vitest/Jest) for hooks, utilities, and transaction builders.
- Component tests with React Testing Library; mock wallet context where necessary.
- Integration/smoke tests using Playwright:
  - Connect to localnet wallet (e.g., Phantom dev wallet) via automation env.
  - Cover wallet connect/disconnect, stake submission, reward claim flows.
- Snapshot/visual regression tests through Storybook + Chromatic or Percy for core screens.
- Enforce minimum coverage thresholds: 80% statements, 70% branches, 80% lines/functions.

## Tooling & Automation

- Package manager: `pnpm` with workspace support.
- Scripts:
  - `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm format`.
  - Add `pnpm check:wallet` to run wallet integration smoke tests locally.
- Git hooks via Husky:
  - `pre-commit`: `lint-staged` (eslint, prettier --check).
  - `pre-push`: `pnpm test --filter frontend`, `pnpm typecheck`.
- CI pipeline:
  - Install dependencies with `pnpm`.
  - Run lint, typecheck, tests, Playwright smoke suite (headless).
  - Build preview deploy (Vercel/Netlify) with environment variables gated.
- Observability:
  - Integrate Sentry or OpenTelemetry for error tracking.
  - Include structured logging (JSON) for wallet interactions.

## Documentation & Knowledge Sharing

- Maintain ADRs (Architecture Decision Records) under `docs/adr/`.
- Update integration docs in Codex HQ (`projects/cyphercast/docs/`); sync downstream via doc-sync checklist.
- Log significant engineering learnings in `reports/projects/cyphercast/staff_reports/`.
- Add Storybook docs for complex components and ensure designers sign off on changes.

## Security & Compliance

- Review dependencies quarterly; track CVEs with `pnpm audit` and GitHub Dependabot.
- Enforce Content Security Policy (CSP) in Next.js middleware.
- Validate all user inputs with Zod schemas before forming transactions.
- Never expose private keys or secrets in client code; rely on wallet adapters.
- Document threat modeling outcomes; ensure audit logs capture key interactions (stake submitted, rewards claimed).

## Release Cadence

- Sprint-based release (bi-weekly) with code freeze 24h prior.
- Tag releases with semantic versioning (`vX.Y.Z`) and changelog entries (`docs/CHANGELOG.md`).
- Require Product + Finance review per `pipeline.yaml` gates before production deployment.
