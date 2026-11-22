# Finance OS 🪙

> **The Personal Financial Operating System with strict mathematical determinism, multi-currency isolation, live market exchange rates, and verifiable AI financial insights.**

---

## 📖 What is Finance OS?

**Finance OS** is a modern, high-precision personal finance platform engineered for professionals and households operating across local and international currencies. Unlike traditional expense trackers that rely on error-prone floating-point math or opaque AI summaries, Finance OS is built upon three foundational tenets:

1. **Zero-Hallucination Determinism**: All balances, cash flows, and budget calculations are computed deterministically using `decimal.js` and PostgreSQL `Decimal(14, 2)`. AI is strictly used to translate verifiable math into plain-language executive summaries.
2. **Multi-Currency Isolation**: Seamlessly supports **Kenyan Shilling (KES)**, **Euro (EUR)**, **US Dollar (USD)**, and **British Pound (GBP)**. Wallets, budgets, and transactions remain strictly isolated in their native currency to prevent ledger contamination.
3. **Live Market Exchange Rates**: Integrated real-time FX engine fetching live central bank and market rates without hardcoded values, complete with in-memory caching and offline fallback for automated test suites.
4. **Goal-Based Envelope Budgeting**: Dynamically allocates verified recurring income to priority living expenses, emergency funds, and growth milestones, featuring interactive spend editing and real-time remainder indicators.

---

## 🏛️ Architecture Overview

The codebase is organized into cleanly decoupled **Frontend** and **Backend** subsystems:

```
finance-os/
│
├── 📂 Frontend (UI & Client Application)
│   ├── app/                              # Next.js 14 App Router
│   │   ├── (auth)/                       # Authentication views (Login & Registration)
│   │   ├── onboarding/                   # Income & currency setup wizard
│   │   ├── dashboard/                    # Authenticated dashboard workspace
│   │   │   ├── page.tsx                  # Executive Overview (Server Component)
│   │   │   ├── DashboardClient.tsx       # Interactive financial balance sheet
│   │   │   ├── accounts/                 # Multi-currency accounts & wallets
│   │   │   ├── budgets/                  # Spending envelopes & live spend editor
│   │   │   └── insights/                 # Monthly AI audits & "Why?" ledger drawer
│   │   └── layout.tsx                    # Root layout & typography
│   └── components/                       # Shared UI Primitives
│       ├── Header.tsx                    # Navigation bar with currency switcher
│       ├── AddTransactionModal.tsx       # Transaction creator with AI auto-categorization
│       ├── AddAccountModal.tsx           # Multi-currency account modal
│       └── ui/                           # Lucide icons and UI widgets
│
├── ⚙️ Backend (Services, APIs & Data)
│   ├── app/api/                          # REST API Endpoints
│   │   ├── accounts/                     # Accounts & balance management
│   │   ├── transactions/                 # Ledger events with soft-delete
│   │   ├── budgets/                      # Deterministic envelope generation
│   │   ├── goals/                        # Savings & emergency fund pacing
│   │   ├── fx/rate/                      # Live FX currency conversion endpoint
│   │   └── ai/                           # AI categorization & monthly insights
│   ├── services/                         # Core Business Logic Layer
│   │   ├── fx/rates.ts                   # Live FX rates engine (Open ER / ECB feeds)
│   │   ├── account/balances.ts           # Multi-currency balance aggregation
│   │   ├── budget/budget.ts              # Deterministic envelope generation & actuals
│   │   ├── goal/goal.ts                  # Goal progress and monthly contribution pacing
│   │   └── dashboard/summary.ts          # Unified executive dashboard data synthesis
│   ├── lib/
│   │   ├── finance/                      # Pure, deterministic math algorithms (Decimal.js)
│   │   │   ├── balance.ts                # Account balance math
│   │   │   ├── budget.ts                 # Envelope generation & actuals
│   │   │   ├── currency.ts               # ISO formatting & currency validation
│   │   │   └── goal.ts                   # Target pacing formulas
│   │   ├── ai/                           # AI Provider (Google Gemini 3.5 Flash Lite)
│   │   │   ├── gemini.ts                 # SDK wrapper with retry resilience
│   │   │   ├── insights.ts               # Deterministic-to-language prompt synthesis
│   │   │   └── memory.ts                 # Dynamic merchant rule learning
│   │   └── generated/prisma/             # Type-safe Prisma Client
│   └── prisma/
│       └── schema.prisma                 # PostgreSQL schema with Decimal(14, 2) columns
│
├── 📚 Documentation
│   ├── docs/README.md                    # Master documentation index
│   ├── docs/frontend/                    # Frontend architecture & UI specs
│   └── docs/backend/                     # Backend APIs, schema & AI architecture
│
└── 🧪 Tests
    └── tests/unit/                       # 100% offline Vitest test suites
```

---

## ✨ Core Features

### 1. Goal-Based Spending Envelopes (`/dashboard/budgets`)
- **Automated Envelope Generation**: Formulates monthly allocations based on verified recurring income, prioritizing essentials, emergency fund funding, and active goal deadlines.
- **Live Match & Remainder Cushion**:
  - Displays `Spent / Allocated / Remainder`.
  - When spending coincides exactly with allocation: displays `✨ Coincides with allocation (0.00 left)`.
  - Color-coded remainder cushions (emerald for surplus, rose for overrun).
- **Interactive Spend Editing**: Expand any envelope via **"View & Edit Spend"** to modify individual transaction amounts inline with instant envelope recalculation.
- **Customizable Allocations**: Adjust monthly allocations via an interactive modal with live difference feedback as you type.

### 2. Live Market FX Engine (`/api/fx/rate`)
- Connects directly to real-time open exchange rate feeds (`https://open.er-api.com/v6/latest/{base}`).
- Zero hardcoded numbers or static conversion constants.
- 1-hour in-memory cache to respect rate limits and maximize sub-millisecond responsiveness.
- Seamless conversion across `KES`, `EUR`, `USD`, and `GBP`.

### 3. Transparent AI Financial Audits (`/dashboard/insights`)
- Monthly insights generated by **Google Gemini 3.5 Flash Lite** analyzing spending surges, savings opportunities, and goal pacing.
- **"Why?" Mathematical Drawer**: Click "Why?" on any insight to slide out the verified ledger audit trail showing the underlying mathematical facts backing the recommendation.

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js**: v20.x or higher (`v22.14.0` recommended)
- **PostgreSQL**: v14.x or higher running locally or in the cloud
- **npm** or **pnpm**

### 2. Clone & Install Dependencies
```bash
git clone <repository-url>
cd finance-os
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database connection string (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/finance_os?schema=public"

# NextAuth Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-secret-key"

# Google Gemini API Key (for AI categorization & insights)
GEMINI_API_KEY="your-gemini-api-key"
```

### 4. Database Setup & Seed
Push the Prisma schema to your PostgreSQL database and seed initial categories:
```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 5. Run the Application
Start the Next.js development server:
```bash
npm run dev
```

The application is now accessible at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Access & User Login

To log in to the pre-configured workspace:
- **URL**: `http://localhost:3000/login`
- **Email**: `bethjulius08@gmail.com`
- **Password**: `ManiMan20`

*(Or register a new account at `http://localhost:3000/signup` and complete the 2-step onboarding wizard).*

---

## 🧪 Testing & Verification

Finance OS includes comprehensive offline unit and integration tests covering financial algorithms, live FX rates, and balance sheets:

```bash
# Run all unit tests with Vitest (100% offline passing)
npm test

# Run TypeScript type-checking
npm run typecheck # or ./node_modules/.bin/tsc --noEmit

# Run ESLint validation
npm run lint

# Compile production build
npm run build
```

---

## 📚 Technical Documentation

For in-depth architectural specifications and implementation details, visit the `docs/` folder:

- **[Master Documentation Index](docs/README.md)**
- **Frontend**:
  - [Frontend Architecture & UI Overview](docs/frontend/overview.md)
  - [Goal-Based Budget Planner & UX](docs/frontend/budget-planner.md)
- **Backend**:
  - [Backend REST API & Server Actions](docs/backend/api.md)
  - [Database Schema & Prisma Models](docs/backend/database-schema.md)
  - [AI Architecture & Insights Engine](docs/backend/ai-architecture.md)
  - [Live Foreign Exchange (FX) Engine](docs/backend/fx-currency-architecture.md)

---

## 📄 License
Private & Proprietary. All rights reserved.
