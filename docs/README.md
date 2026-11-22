# Finance OS — Technical Documentation Index

Welcome to the **Finance OS** technical documentation suite. The architecture is cleanly divided into **Frontend** (UI components, App Router, design system) and **Backend** (financial engines, database schema, AI orchestration, live FX feeds).

---

## 📂 Architecture Map

```
docs/
├── README.md                          # Master documentation index (this file)
│
├── frontend/                          # Client-side UI & presentation architecture
│   ├── overview.md                    # Next.js 14 App Router, routes, components, and design system
│   └── budget-planner.md              # Goal-based envelope budget planner, UX specs & roadmap
│
└── backend/                           # Server-side business logic, APIs & data engines
    ├── api.md                         # REST API endpoints & Next.js Server Actions reference
    ├── database-schema.md             # PostgreSQL schema, Prisma models, constraints & indexes
    ├── ai-architecture.md             # Background AI engine (Gemini 3.5 Flash Lite) & "Why?" audit drawer
    └── fx-currency-architecture.md    # Live FX transfer rates engine, caching & multi-currency isolation
```

---

## 1. 🖥️ Frontend Documentation (`docs/frontend/`)

- **[Frontend Architecture & Overview](./frontend/overview.md)**
  - Comprehensive guide to the **Next.js 14 App Router** architecture.
  - Page workflows: Executive Overview (`/dashboard`), Accounts & Wallets (`/dashboard/accounts`), Envelopes (`/dashboard/budgets`), and AI Insights (`/dashboard/insights`).
  - Sage-Emerald Linear/Stripe-inspired design system (`#0F5147`), typography, Lucide icon rules (`react-icons/lu`), and reactive feedback states.
- **[Budget Planner & Envelope UX Specification](./frontend/budget-planner.md)**
  - Goal-based spending envelope methodology.
  - Interactive spend editing (`BudgetsClient.tsx`), exact allocation match badge (`✨ Coincides with allocation`), and dynamic remainder cushions.
  - User customization modal with live feedback and future slider roadmap.

---

## 2. ⚙️ Backend Documentation (`docs/backend/`)

- **[Backend API & Server Actions Reference](./backend/api.md)**
  - Detailed contract for all REST API endpoints (`/api/accounts`, `/api/transactions`, `/api/budgets`, `/api/goals`, `/api/fx/rate`, `/api/ai/*`).
  - Next.js Server Actions catalog for transactions, accounts, categories, and envelopes.
  - Postman collection integration guide.
- **[Database Schema & Models Reference](./backend/database-schema.md)**
  - PostgreSQL schema documentation with Prisma ORM (`lib/generated/prisma`).
  - `Decimal(14, 2)` monetary precision rule for zero floating-point error.
  - Multi-currency isolation architecture and entity relationships.
- **[AI Architecture & Zero-Hallucination Insights](./backend/ai-architecture.md)**
  - Server-side intelligence powered by **Google Gemini 3.5 Flash Lite**.
  - Verified ledger synthesis: strictly separating deterministic calculations from language formatting.
  - The "Why?" Mathematical Audit Drawer: providing instant verifiable proof for every financial observation.
  - Dynamic user-trained merchant learning and categorization rules.
- **[Live Foreign Exchange (FX) Engine](./backend/fx-currency-architecture.md)**
  - Real-time exchange rate engine connecting to live market feeds (Open Exchange Rates / ECB).
  - 1-hour in-memory TTL caching with atomic cache invalidation.
  - Multi-currency isolation policy (`KES`, `EUR`, `USD`, `GBP`) and offline test mocks.

---

## 3. 🚀 Quick Links
- **Project Root & Setup Guide**: [`README.md`](../README.md)
- **Postman API Collection**: [`postman/finance-os.postman_collection.json`](../postman/finance-os.postman_collection.json)
- **Test Suite**: Run `npm test` from the `finance-os` directory to execute Vitest suites.
