# Finance OS — Backend API & Server Actions Reference

All monetary amounts cross the client/server boundary as **positive decimal strings** with up to 2 decimal places (`^\d+(\.\d{1,2})?$`). Every authenticated endpoint and Server Action resolves `userId` strictly from the verified session (`requireUserId()`).

---

## 1. Allowed Enum Values

- **`Currency`**: `"KES"` | `"EUR"` | `"GBP"` | `"USD"`
- **`Frequency`**: `"WEEKLY"` | `"BIWEEKLY"` | `"MONTHLY"` | `"QUARTERLY"` | `"ANNUALLY"` | `"IRREGULAR"`
- **`AccountType`**: `"BANK"` | `"MOBILE_MONEY"` | `"MMF"` | `"INVESTMENT"` | `"CASH"` | `"SAVINGS"` | `"OTHER"`
- **`TransactionType`**: `"INCOME"` | `"EXPENSE"` | `"TRANSFER"` | `"INVESTMENT_CONTRIBUTION"` | `"WITHDRAWAL"` | `"REFUND"`

---

## 2. REST API Endpoints (`app/api/**`)

A complete Postman collection is available at [`postman/finance-os.postman_collection.json`](../postman/finance-os.postman_collection.json) with environment [`postman/finance-os.postman_environment.json`](../postman/finance-os.postman_environment.json).

### Auth & Onboarding
- **`POST /api/auth/signup`**
  - Request JSON: `{ name: string, email: string, password: string }`
  - Success (`201`): `{ user: { id, email, name } }`
  - Errors: `400` (validation message), `409` (`"An account with this email already exists."`)
- **`GET /api/auth/csrf`**, **`POST /api/auth/callback/credentials`**, **`GET /api/auth/session`** (NextAuth handlers)
- **`PATCH /api/onboarding/personal-info`**
  - Request JSON: `{ name: string, baseCurrency: Currency, country?: string }`
  - Success (`200`): `{ user: { id, name, baseCurrency, country } }`
- **`POST /api/onboarding/complete`**
  - Request JSON: `{ incomeSources: Array<{ name: string, amount: string, currency: Currency, frequency: Frequency }> }`
  - Success (`200`): `{ user: { id, onboardedAt } }`

### Accounts & Balances
- **`GET /api/accounts`** (calls `listAccountsWithBalances(userId)`)
  - Success (`200`):
    ```json
    {
      "accounts": [
        { "id": "acc_1", "name": "KCB Checking", "type": "BANK", "currency": "KES", "balance": "120500.00" }
      ],
      "totalsByCurrency": { "KES": "120500.00" }
    }
    ```
- **`POST /api/accounts`**
  - Request JSON: `{ name: string, type: AccountType, currency: Currency, openingBalance?: string }`
  - Success (`201`): `{ account: { id, name, type, currency, openingBalance, isArchived, createdAt } }`
- **`PATCH /api/accounts/[accountId]`**
  - Request JSON: `{ name?: string, type?: AccountType, currency?: Currency, isArchived?: boolean }`
  - Success (`200`): `{ account }` | Error (`404`): `{ error: "Account not found." }`
- **`DELETE /api/accounts/[accountId]`**
  - Archives the account (`isArchived = true`).
  - Success (`200`): `{ success: true }` | Error (`404`): `{ error: "Account not found." }`

### Categories
- **`GET /api/categories`**
  - Returns shared default categories (`isDefault: true, userId: null`) plus the user's custom categories, sorted alphabetically by `name`.
  - Success (`200`): `{ categories: Array<{ id, name, icon, isDefault, userId }> }`
- **`POST /api/categories`**
  - Request JSON: `{ name: string, icon?: string }`
  - Success (`201`): `{ category }`
  - Errors: `400` (`"Category name is required."`), `409` (`"A category with this name already exists."`)
- **`PATCH /api/categories/[categoryId]`**
  - Request JSON: `{ name: string }`
  - Success (`200`): `{ category }`
  - Errors: `403` (`"Default categories cannot be modified or deleted."`), `404` (`"Category not found."`), `409` (`"A category with this name already exists."`)
- **`DELETE /api/categories/[categoryId]`**
  - Deletes a custom category and sets `categoryId = null` on any transactions referencing it in a single database transaction.
  - Success (`200`): `{ success: true }`

### Transactions
- **`GET /api/transactions`**
  - Query params: `from`, `to` (ISO dates), `categoryId`, `accountId`, `type` (`TransactionType`), `limit` (1..200, default 50), `cursor` (transaction ID)
  - Success (`200`): `{ items: SerializedTransaction[], nextCursor: string | null }` (all `amount` values are `"0.00"` formatted strings)
- **`POST /api/transactions`**
  - Request JSON:
    ```json
    {
      "accountId": "acc_1",
      "transferAccountId": "acc_2",
      "categoryId": "cat_1",
      "type": "TRANSFER",
      "amount": "1500.00",
      "currency": "KES",
      "description": "Transfer to savings",
      "notes": "Optional note",
      "date": "2026-10-19T10:00:00.000Z"
    }
    ```
  - Success (`201`): `{ transaction }`
  - Errors:
    - `400`: `"Choose an account."`, `"Amount is required."`, `"Enter a valid amount (up to 2 decimal places)."`, `"Amount must be greater than zero."`, `"Add a short description."`, `"Enter a valid date."`, `"Choose a destination account for a transfer."`, `"Destination must be different from the source."`, `"Only transfers can have a destination account."`
    - `404`: `"Account not found."`, `"Category not found."`
    - `422`: `"Transaction currency must match the account currency."`, `"Transfers between accounts with different currencies are not yet supported."`
- **`PATCH /api/transactions/[transactionId]`**
  - Request JSON: `{ amount?: string, description?: string, notes?: string | null, date?: string, categoryId?: string | null }`
  - Success (`200`): `{ transaction }`
- **`DELETE /api/transactions/[transactionId]`**
  - Soft-deletes the transaction (`deletedAt = new Date()`).
  - Success (`200`): `{ success: true }`

### Dashboard Summary
- **`GET /api/dashboard/summary?year=2026&month=10`**
  - Success (`200`): `DashboardSummaryResult` containing `period`, `byCurrency` (`currentBalance`, `income`, `spending`, `saved`, `invested`, `netCashFlow`, `spendingByCategory`), `accounts`, `recentTransactions` (top 5), `emergencyFundProgress: null`, `budgetVsActual: null`, `upcomingObligations: []`.

---

## 3. Server Actions

### Accounts (`app/accounts/actions.ts`)
- **`createAccountAction(prevState, formData)`**
  - Form fields: `name`, `type`, `currency`, `openingBalance` (optional; empty defaults to `"0"`)
  - Returns: `{ success?: boolean, error?: string }`
- **`archiveAccountAction(accountId)`**

### Categories (`app/categories/actions.ts`)
- **`createCategoryAction(prevState, formData)`**
  - Form fields: `name`, `icon` (optional)
  - Returns: `{ success?: boolean, error?: string }`
- **`renameCategoryAction(categoryId, name)`** -> `{ success?: boolean, error?: string }`
- **`deleteCategoryAction(categoryId)`** -> `{ success?: boolean, error?: string }`

### Transactions (`app/transactions/actions.ts`)
- **`createTransactionAction(prevState, formData)`**
  - Form fields: `accountId`, `type`, `amount`, `currency`, `description`, `notes` (optional), `date`, `categoryId` (optional), `transferAccountId` (required when `type === "TRANSFER"`, must be omitted otherwise)
  - Returns: `{ success?: boolean, error?: string }`
- **`deleteTransactionAction(transactionId)`** -> `{ success?: boolean, error?: string }`
- **`updateTransactionCategoryAction(transactionId, categoryId | null)`** -> `{ success?: boolean, error?: string }`
- **`updateTransactionAction(transactionId, input)`** -> `{ success?: boolean, error?: string }`

### Service Functions (`services/**`)
- **`listAccountsWithBalances(userId)`** (`services/account/balances.ts`) -> `{ accounts: AccountWithBalance[], totalsByCurrency: Record<Currency, string> }`
- **`getDashboardSummary(userId, { year, month })`** (`services/dashboard/summary.ts`) -> `DashboardSummaryResult`

