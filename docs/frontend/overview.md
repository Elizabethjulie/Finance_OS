# Finance OS — Frontend Architecture & UI Documentation

## 1. Overview
The **Finance OS** frontend is built on **Next.js 14 (App Router)** with **React 18 Server & Client Components**, styled with **Tailwind CSS**, and accessorized with **React Icons (`react-icons/lu`)**.

The UI emphasizes:
- **Clean Aesthetic**: Financial dashboard inspired by Linear and Stripe, using a sage-emerald palette (`#0F5147`), muted borders (`#E5EBE8`), and accessible high-contrast text.
- **Strict Multi-Currency Isolation**: Seamlessly toggles between currencies (`KES`, `EUR`, `USD`, `GBP`) across dashboards, budgets, and insights without blending accounts.
- **Zero-Hallucination & Mathematical Transparency**: Financial totals are computed deterministically before rendering; all observations link to verifiable audit trails.

---

## 2. Directory Structure

```
finance-os/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages (Login, Signup)
│   ├── onboarding/               # First-time profile & income setup flow
│   ├── dashboard/                # Main authenticated application shell
│   │   ├── page.tsx              # Executive Overview (server component)
│   │   ├── DashboardClient.tsx   # Overview UI & balance sheet
│   │   ├── accounts/             # Multi-currency accounts & wallets
│   │   ├── budgets/              # Goal-based envelope budget planner
│   │   └── insights/             # Plain-language monthly financial audit
│   └── layout.tsx                # Root layout & font configuration
│
├── components/                   # Reusable UI Components
│   ├── Header.tsx                # Sticky top bar with currency switcher & user profile
│   ├── AddTransactionModal.tsx   # Smart transaction modal with AI auto-categorization
│   ├── AddAccountModal.tsx       # Account creation modal (Cash, Bank, Mobile Money, MMF)
│   └── ui/                       # Icon primitives and visual widgets
```

---

## 3. Key Pages & Workflows

### A. Executive Overview (`/dashboard`)
- **Top Metrics**: Displays real-time Cash Available, Monthly Income, Total Spending, and Goal Progress.
- **Multi-Currency Account Cards**: Displays balances per account with native currency badges.
- **Recent Activity**: Quick view of recent income, expense, and transfer events with direction icons.

### B. Goal-Based Spending Envelopes (`/dashboard/budgets`)
- **Deterministic Budget Generation**: Formulates monthly allocations based on verified recurring income, prioritizing essentials, emergency fund funding, and active goal deadlines.
- **Multi-Currency Switcher**: Cycle between `KES`, `EUR`, `USD`, and `GBP` envelope budgets.
- **Live Match & Remainder Indicator**:
  - `Spent / Allocated / Remainder`
  - When spending coincides with allocation: displays `✨ Coincides with allocation (0.00 left)`.
  - Color-coded remainder cushions (emerald for surplus, rose for overrun).
- **Inline Spend Editing**: Click **"View & Edit Spend"** on any category envelope to view and adjust transaction amounts with instant envelope recalculation.
- **Customizable Allocations Modal**: Adjust monthly allocations with live difference feedback as you type.

### C. Monthly AI Insights (`/dashboard/insights`)
- **Structured Categories**: `SPENDING_SURGE`, `SAVING_OPPORTUNITY`, `BUDGET_PACING`, `GOAL_MILESTONE`.
- **"Why?" Drawer**: Click "Why?" on any card to slide out the verified ledger audit trail showing the underlying mathematical facts.
- **Multi-Month & Multi-Currency Navigation**: Historical monthly archive with dedicated currency filters.

---

## 4. Design Guidelines
1. **Typography & Spacing**:
   - Headers: Bold, tight letter-spacing (`tracking-tight text-slate-900`).
   - Labels & Badges: Compact uppercase or pill badges (`text-[10px]`, `text-[11px] font-semibold`).
2. **Icons**:
   - Exclusively uses `react-icons/lu` (Lucide Icons) and custom SVG components. Raw emojis are strictly avoided.
3. **State Feedback**:
   - Form buttons indicate pending transitions with loading spinners and disabled states (`useTransition`, `isPending`).
