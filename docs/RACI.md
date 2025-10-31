# RACI Matrix — cyphercast Program

Defines decision-making roles for cross-functional activities.  
Roles: **R** = Responsible (executes work), **A** = Accountable (owns outcome), **C** = Consulted (provides input), **I** = Informed (kept in loop).

| Activity / Deliverable                    | Product Agent | Engineer Agent | Compliance Agent | Finance Agent | HR Agent |
| ---                                       | ---           | ---            | ---              | ---           | ---      |
| Feature ideation & prioritization         | R             | C              | I                | C             | I        |
| Frontend implementation (React + Solana)  | C             | A/R            | C                | I             | I        |
| Wallet security & compliance review       | C             | R              | A                | I             | I        |
| Financial modeling & token economics      | C             | C              | I                | A/R           | I        |
| Release readiness & change management     | A             | R              | C                | C             | I        |
| Documentation sync (HQ ↔ downstream)      | C             | A/R            | I                | I             | I        |
| Incident response & remediation           | I             | R              | A                | C             | C        |
| Training & upskilling program updates     | C             | R              | I                | I             | A        |
| Audit logging & compliance reporting      | I             | R              | A                | C             | I        |

> Review this matrix quarterly or when ownership changes. Updates must be logged in `audit/logs/<date>.md` with timestamps from `./scripts/current_time.sh`.
