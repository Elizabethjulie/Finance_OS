# Finance OS — Budget Planner Future Review & Evolution Roadmap

**Document Status**: Active / Scheduled for Review  
**Last Updated**: November 2026  
**Scope**: `lib/finance/budget.ts`, `services/budget/budget.ts`, `app/dashboard/budgets/`

---

## 1. Executive Summary & Context

Finance OS currently features a deterministic goal-based monthly budget generator. In response to initial calibration, the generator was customized to move away from rigid academic rules (such as flat 50/30/20) and arbitrary dividing heuristics. 

To match the user's authentic spending priorities, the baseline generator weights were calibrated against an empirical 27,200 KES allocation basket, with specific categories temporarily excluded.

This document records the current baseline assumptions, identifies known limitations, and establishes the formal roadmap for the upcoming **Budget Planner Review & Re-architecture**.

---

## 2. Current Calibration Baseline

### Active Category Proportions (27,200 KES Basket Benchmark)

| Category | Allocation | Share of Spend | Generator Weight | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Transport** | 10,000 KES | 36.76% | **36.8%** | Essential living expense |
| **Other** | 5,000 KES | 18.38% | **18.4%** | Flexible / Discretionary |
| **Savings** | 4,000 KES | 14.71% | **14.7%** | Goal baseline fallback |
| **Health** | 2,000 KES | 7.35% | **7.4%** | Essential living expense |
| **Shopping** | 2,000 KES | 7.35% | **7.4%** | Flexible / Discretionary |
| **Utilities** | 1,500 KES | 5.51% | **5.5%** | Essential living expense |
| **Entertainment** | 1,500 KES | 5.51% | **5.5%** | Flexible / Discretionary |
| **Giving** | 1,200 KES | 4.41% | **4.4%** | Flexible / Discretionary |

### Currently Excluded Categories

The following categories are actively filtered out from automated generation (`EXCLUDED_CATEGORY_NAMES` in `lib/finance/budget.ts`):
- `Rent` / `Housing`
- `Food` / `Dining` / `Groceries`
- `Education`
- `Family`

*Rationale*: The user explicitly requested to budget these categories outside the automated generator for now to prevent inaccurate estimations, as living situations (e.g. employer-provided housing, boarding schools, seasonal food prepayments) vary significantly.

---

## 3. Areas Identified for Future Review

### 3.1. User-Configurable Lifestyle Profiles (Personas)
- **Current Limitation**: Proportions are hardcoded as static constants in `lib/finance/budget.ts`.
- **Review Goal**: Introduce customizable budget profiles in User Settings:
  - *Commuter / Freelancer*: High transport, flexible workspace/other, irregular income discount.
  - *Family / Household*: Education, grocery scaling, dependent care allocations.
  - *Fixed-Cost Lean*: Direct rent + utility pass-through with minimal discretionary allocation.
  - *Custom*: User defines their own target percentage sliders per category.

### 3.2. Controlled Re-inclusion of Excluded Categories
- **Review Goal**: Support re-introducing `Rent`, `Food`, `Education`, and `Family` with intentional guardrails:
  - Toggle switch in Budget Settings: *"Include rent/food in automated generation"*.
  - When enabled, allow users to specify fixed recurring amounts (e.g. rent = 35,000 KES) rather than percentage guessing.
  - Separate fixed contract obligations (rent, tuition) from variable lifestyle spend (commute, dining out).

### 3.3. Historical Spending Anchoring & Learning
- **Current Limitation**: When transaction history is sparse, the engine falls back entirely to baseline weights.
- **Review Goal**:
  - Automatically anchor category allocations to the user's trailing 3-month rolling median once $\ge 30$ transactions exist.
  - Filter out statistical anomalies (e.g. one-off hospital emergency or annual insurance renewal).

### 3.4. Currency-Aware Cost-of-Living Models
- **Current Limitation**: Weights are calibrated predominantly around Kenyan urban cost structures (KES).
- **Review Goal**:
  - Differentiate default weights by currency (`KES`, `EUR`, `USD`, `GBP`).
  - Account for different cost structures: in European/US urban contexts, utilities and groceries represent a very different fraction of income compared to East Africa.

### 3.5. Interactive Visual Allocator (UI)
- **Review Goal**:
  - Add an interactive visual slider / pie allocator on `/dashboard/budgets`.
  - Let users lock certain categories (e.g. lock Transport at 10,000 KES) and auto-distribute the remainder among unlocked categories.
  - Display live unallocated surplus and savings rate indicators before clicking *"Save Budget"*.

---

## 4. Verification & Architecture Checklist for Reviewers

When conducting the future review:
1. **Mathematical Invariant**: Any changes to allocation logic must preserve `Decimal(14, 2)` precision and never exceed total normalized monthly income.
2. **Rounding Rules**: Keep `roundToSensibleStep(amount, currency)` (nearest 100 in KES, nearest 5 in EUR/USD/GBP) to ensure generated figures remain clean and human-friendly.
3. **Multi-Currency Isolation**: Budgets must remain strictly segregated by currency without implicit exchange rate conversion.
4. **Test Suite Coverage**: Ensure `tests/unit/budget.test.ts` is updated with corresponding test suites for each persona and profile configuration.

