# Finance OS — Database Schema & Data Models

Finance OS uses **PostgreSQL** managed with **Prisma ORM**. The generated client is located at `lib/generated/prisma`.

---

## 1. Core Principles

1. **Monetary Precision**:
   - All monetary amounts (`amount`, `allocated`, `openingBalance`, `targetAmount`, `expectedIncome`, `savingsTarget`) are stored as `Decimal(14, 2)` (12 integer digits, 2 decimal places).
   - Floating-point representations (`Float`, `Double`) are strictly prohibited in the database layer to eliminate rounding discrepancies.
2. **Multi-Currency Isolation**:
   - Financial models (`Account`, `Transaction`, `Budget`, `Goal`, `IncomeSource`, `AIInsight`) carry an explicit `Currency` enum column (`KES`, `EUR`, `GBP`, `USD`).
   - Ledger queries filter by `userId` and `currency` to avoid mingling un-converted amounts.
3. **Soft Deletions**:
   - `Transaction` uses `deletedAt DateTime?` for soft deletion, preserving auditability and enabling reversible user actions.

---

## 2. Enums

### `Currency`
Supported multi-currency ledger denominations:
- `KES`: Kenyan Shilling (default base currency)
- `EUR`: Euro
- `GBP`: British Pound
- `USD`: United States Dollar

### `AccountType`
Financial account & wallet classification:
- `BANK`: Checking and current bank accounts
- `MOBILE_MONEY`: Mobile wallets (e.g., M-Pesa, Airtel Money)
- `MMF`: Money Market Funds & high-yield liquid assets
- `INVESTMENT`: Stocks, bonds, treasury bills
- `CASH`: Physical cash wallets
- `SAVINGS`: Designated bank savings accounts
- `OTHER`: Miscellaneous financial accounts

### `TransactionType`
Ledger flow classifications:
- `INCOME`: Inflow into an account
- `EXPENSE`: Outflow from an account
- `TRANSFER`: Movement between two user accounts (requires `transferAccountId`)
- `INVESTMENT_CONTRIBUTION`: Direct deposit to investment/MMF accounts
- `WITHDRAWAL`: Cash withdrawal
- `REFUND`: Reverse outflow / credit

### `Frequency`
Recurring income scheduling:
- `WEEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `ANNUALLY`, `IRREGULAR`

### `GoalType`
Financial target classification:
- `EMERGENCY_FUND`: 3–6 month living expense reserve
- `SAVINGS`: Medium-term savings target
- `INVESTMENT`: Long-term wealth accumulation
- `DEBT_PAYOFF`: Debt elimination target
- `CUSTOM`: User-defined financial objective

### `InsightType`
AI Monthly Audit classifications:
- `SAVINGS_OPPORTUNITY`: Identified surplus or unused discretionary capital
- `SPENDING_ALERT`: Surge detected across specific category envelopes
- `GOAL_PROGRESS`: Milestone pace tracking (ahead/behind target)
- `CASH_FLOW_TREND`: Net monthly liquidity variance

---

## 3. Entity Models & Relationships

### `User`
Root user entity storing profile and authentication credentials.
- `id`: CUID primary key
- `email`: Unique email address (`@unique`, indexed)
- `passwordHash`: Bcrypt-hashed password (cost factor 12)
- `baseCurrency`: User's primary currency (`KES` default)
- `country`: Optional ISO country code
- `onboardedAt`: Timestamp marking completion of onboarding wizard
- **Relations**: 1-to-many with `Account`, `Transaction`, `Category`, `Budget`, `Goal`, `IncomeSource`, `AIInsight`, `CategoryCorrectionRule`.

### `IncomeSource`
Recurring income streams feeding the deterministic budget envelope engine.
- `id`: CUID
- `userId`: Foreign key to `User` (cascading delete)
- `name`: Income label (e.g., "Salary", "Freelance", "Dividends")
- `amount`: `Decimal(14, 2)`
- `currency`: `Currency`
- `frequency`: `Frequency`
- `isActive`: Boolean flag

### `Account`
Multi-currency accounts tracking cash, banks, mobile money, and funds.
- `id`: CUID
- `userId`: Foreign key to `User`
- `name`: Account name (e.g., "M-Pesa", "KCB Checking", "Sanlam MMF")
- `type`: `AccountType`
- `currency`: `Currency`
- `openingBalance`: `Decimal(14, 2)` default `0.00`
- `isArchived`: Soft archival flag
- **Relations**:
  - `transactions`: Transactions sourced from this account
  - `incomingTransfers`: Transactions transferred into this account

### `Category`
Transaction classification categories with default global seeds and custom user extensions.
- `id`: CUID
- `userId`: Foreign key to `User` (`null` indicates a global default category)
- `name`: Category name
- `icon`: Icon identifier string
- `isDefault`: Boolean (`true` for shared system categories)
- **Constraints**: Unique per `[userId, name]`

### `Transaction`
Core double-entry-capable financial record.
- `id`: CUID
- `userId`: Foreign key to `User`
- `accountId`: Primary account debited/credited
- `transferAccountId`: Destination account (when `type === 'TRANSFER'`)
- `categoryId`: Optional foreign key to `Category`
- `type`: `TransactionType`
- `amount`: `Decimal(14, 2)`
- `currency`: `Currency`
- `description`: Transaction memo
- `notes`: Optional extended details
- `date`: Transaction effective timestamp
- `deletedAt`: Soft-delete timestamp
- **Indexes**:
  - `@@index([userId, date])` (chronological query optimization)
  - `@@index([userId, categoryId])` (spending by category optimization)
  - `@@index([accountId])`
  - `@@index([transferAccountId])`

### `Budget` & `BudgetCategory`
Goal-based deterministic monthly spending envelopes.
- `Budget`:
  - `id`: CUID
  - `userId`: Foreign key to `User`
  - `year`: Integer (e.g., 2026)
  - `month`: Integer (1–12)
  - `currency`: `Currency`
  - `expectedIncome`: `Decimal(14, 2)` derived from verified `IncomeSource`
  - `totalAllocated`: `Decimal(14, 2)` sum of envelope limits
  - `savingsTarget`: `Decimal(14, 2)` target emergency/growth reservation
  - `rationale`: Plain-language mathematical explanation of formula
  - **Constraint**: `@@unique([userId, year, month, currency])`
- `BudgetCategory`:
  - `budgetId`: Foreign key to `Budget`
  - `categoryId`: Foreign key to `Category`
  - `allocated`: `Decimal(14, 2)` spending envelope limit
  - `isEssential`: Boolean flag marking non-negotiable living expenses
  - `note`: Optional justification note
  - **Constraint**: `@@unique([budgetId, categoryId])`

### `Goal` & `GoalContribution`
Target-based financial growth milestones.
- `Goal`:
  - `id`: CUID
  - `name`: Goal title (e.g., "Emergency Fund", "House Downpayment")
  - `type`: `GoalType`
  - `targetAmount`: `Decimal(14, 2)`
  - `startingAmount`: `Decimal(14, 2)`
  - `currency`: `Currency`
  - `targetDate`: Target completion deadline
  - `isArchived`: Boolean flag
- `GoalContribution`:
  - Individual deposit events credited toward a goal, optionally linked to a source `Transaction`.

### `AIInsight`
Deterministic observations and executive summaries generated by the server-side AI engine.
- `id`: CUID
- `userId`: Foreign key to `User`
- `year`, `month`, `currency`: Target evaluation period
- `type`: `InsightType`
- `title`: High-level observation headline
- `summary`: Plain-language synthesis
- `actionableStep`: Concrete next action for the user
- `reasoning`: Structured JSON holding mathematical proof and audit facts backing the "Why?" drawer
- `isDismissed`: User dismissal flag

### `CategoryCorrectionRule`
User-trained keyword rules for automatic transaction categorization.
- `keyword`: Normalized merchant substring
- `categoryId`: Target category
- **Constraint**: `@@unique([userId, keyword])`

---

## 4. Migration & Schema Management

To update or inspect the database schema:
```bash
# Push schema changes to development database
npx prisma db push

# Regenerate Prisma Client
npx prisma generate

# Inspect data in interactive web GUI
npx prisma studio
```
