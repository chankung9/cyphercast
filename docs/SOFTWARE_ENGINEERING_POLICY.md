# Cyphercast Software Engineering Policy (Enterprise Grade)

This policy defines mandatory engineering practices for the cyphercast program to achieve enterprise-grade quality, security, and compliance. All contributors (internal and external) must adhere to these requirements before merging code into main branches or promoting releases.

## 1. Governance & Ownership

- **Technical Owner:** Engineer agent (Codex HQ) maintains architectural oversight.
- **Product Owner:** Product agent defines feature scope and approves release notes.
- **Compliance & Security:** Legal and Compliance agents must review high-risk changes (wallet flows, on-chain logic).
- **RACI Matrix:** Maintain a RACI table in `docs/RACI.md` (Product: Responsible, Engineer: Accountable, Finance/Compliance: Consulted, HR: Informed).

## 2. Branching & Release Management

- `main`: production-ready, tagged releases only.
- `develop`: integration branch for completed features, requires CI green and Product approval.
- Feature branches: `feature/<epic>-<short-desc>` start from `develop`, rebase regularly.
- Hotfix branches: `hotfix/<issue-id>` from `main`, must back-merge into `develop`.
- Releases follow semantic versioning; tag format `cyphercast-vX.Y.Z`.
- Maintain release notes in `docs/CHANGELOG.md` with links to audit logs and deployment artifacts.

## 3. Code Review Standards

- Minimum two approvals: one Engineer peer, one domain reviewer (Product or Security for sensitive paths).
- Blocker conditions:
  - Failing CI checks.
  - Missing tests for new logic.
  - Security policy violations (lint rule errors, dependency vulnerabilities).
- Enforce GitHub CODEOWNERS mapping to core directories; engineer agent must be a required reviewer for `app/`, `src/lib/solana/`, and `scripts/`.

## 4. Secure Development Lifecycle

- Threat modeling required for new dApp flows; document outcomes in `docs/threat-models/<feature>.md`.
- Mandatory static analysis:
  - ESLint security rules.
  - `pnpm audit --prod` in CI with severity thresholds (fail on high/critical).
- Dependency management: pin versions, use Renovate to auto-PR upgrades, review within 7 days.
- Secrets management: environment variables stored in `.env.local` (gitignored) and centralized secret vault (1Password/Vault) for production.
- Access control: limit RPC endpoints and API keys to environment-specific least privilege.

## 5. Testing & Quality Gates

- **Unit Tests:** >=80% coverage; failure to meet threshold requires justification in PR description.
- **Integration Tests:** Playwright smoke against staging wallet endpoints before merge.
- **Performance Budgets:** Lighthouse score >= 90 (Performance, Accessibility); track in CI using `lighthouse-ci`.
- **Observability Checks:** Sentry DSN configured, ensure error alerts linked to on-call rotation.
- **Rollback Plan:** Each release must include rollback steps in the deployment checklist.

## 6. Documentation Requirements

- Every feature PR must update relevant docs:
  - `projects/cyphercast/docs/` for HQ records.
  - Downstream repository docs via doc-sync checklist.
- Architecture Decision Records (ADRs) for significant choices (state management, wallet provider changes).
- Onboarding runbooks stored in `docs/runbooks/`.
- Maintain API schema (GraphQL/REST) under version control; update when endpoints change.

## 7. Environment & Infrastructure

- Environments: local (developer), staging (CI/CD deploy), production (mainnet). Optionally preview environments per PR.
- Infrastructure as Code (IaC) required for backend services; track via Terraform/Pulumi repos.
- Monitoring dashboards (Grafana/Datadog) must be linked in `docs/observability.md`.
- Incident response: follow `reports/incidents/INCIDENT_TEMPLATE.md`; declare within 1 hour of detection.

## 8. Compliance & Audit Trail

- Log key actions (deployments, doc syncs, release approvals) in `audit/logs/<date>.md` with timestamps from `./scripts/current_time.sh`.
- Retain CI build artifacts and logs for 90 days.
- Conduct quarterly security reviews; file summary under `reports/audit/`.
- GDPR/PDPA considerations: ensure personal data handling (if any) meets regional laws; document DPA agreements.

## 9. Training & Upskilling

- Engineers must complete the `FRONTEND_UPSKILL_GUIDE.md` curriculum prior to handling Solana-facing UI features.
- Schedule quarterly knowledge-sharing sessions; capture notes in `reports/projects/cyphercast/training/`.
- Track certifications or courses (Anchor, Solana Bootcamp) in HR records.

## 10. Enforcement

- Policy violations trigger remediation plans logged in `audit/logs/`.
- Repeat violations escalate to Compliance agent and may result in merge blocks.
- Review and update this policy bi-annually or when major architectural changes occur.
