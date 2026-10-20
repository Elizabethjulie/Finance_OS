import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireUserId,
  mockSignupUser,
  mockSavePersonalInfo,
  mockCompleteOnboarding,
  mockListAccountsWithBalances,
  mockCreateAccount,
  mockUpdateAccount,
  mockArchiveAccount,
  mockListCategories,
  mockCreateCategory,
  mockRenameCategory,
  mockDeleteCategory,
  mockListTransactions,
  mockCreateTransaction,
  mockUpdateTransaction,
  mockSoftDeleteTransaction,
  mockGetDashboardSummary,
} = vi.hoisted(() => ({
  mockRequireUserId: vi.fn(),
  mockSignupUser: vi.fn(),
  mockSavePersonalInfo: vi.fn(),
  mockCompleteOnboarding: vi.fn(),
  mockListAccountsWithBalances: vi.fn(),
  mockCreateAccount: vi.fn(),
  mockUpdateAccount: vi.fn(),
  mockArchiveAccount: vi.fn(),
  mockListCategories: vi.fn(),
  mockCreateCategory: vi.fn(),
  mockRenameCategory: vi.fn(),
  mockDeleteCategory: vi.fn(),
  mockListTransactions: vi.fn(),
  mockCreateTransaction: vi.fn(),
  mockUpdateTransaction: vi.fn(),
  mockSoftDeleteTransaction: vi.fn(),
  mockGetDashboardSummary: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUserId: mockRequireUserId,
}));

vi.mock("@/services/auth/signup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/auth/signup")>();
  return {
    ...actual,
    signupUser: mockSignupUser,
  };
});

vi.mock("@/services/onboarding/onboarding", () => ({
  saveInitialPersonalInfo: mockSavePersonalInfo,
  completeOnboarding: mockCompleteOnboarding,
}));

vi.mock("@/services/account/balances", () => ({
  listAccountsWithBalances: mockListAccountsWithBalances,
}));

vi.mock("@/services/account/account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/account/account")>();
  return {
    ...actual,
    createAccount: mockCreateAccount,
    updateAccount: mockUpdateAccount,
    archiveAccount: mockArchiveAccount,
  };
});

vi.mock("@/services/category/category", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/category/category")>();
  return {
    ...actual,
    listCategories: mockListCategories,
    createCategory: mockCreateCategory,
    renameCategory: mockRenameCategory,
    deleteCategory: mockDeleteCategory,
  };
});

vi.mock("@/services/transaction/transaction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/transaction/transaction")>();
  return {
    ...actual,
    listTransactions: mockListTransactions,
    createTransaction: mockCreateTransaction,
    updateTransaction: mockUpdateTransaction,
    softDeleteTransaction: mockSoftDeleteTransaction,
  };
});

vi.mock("@/services/dashboard/summary", () => ({
  getDashboardSummary: mockGetDashboardSummary,
}));

import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { PATCH as onboardingPersonalInfoPATCH } from "@/app/api/onboarding/personal-info/route";
import { POST as onboardingCompletePOST } from "@/app/api/onboarding/complete/route";
import { GET as accountsGET, POST as accountsPOST } from "@/app/api/accounts/route";
import {
  PATCH as accountIdPATCH,
  DELETE as accountIdDELETE,
} from "@/app/api/accounts/[accountId]/route";
import { GET as categoriesGET, POST as categoriesPOST } from "@/app/api/categories/route";
import {
  PATCH as categoryIdPATCH,
  DELETE as categoryIdDELETE,
} from "@/app/api/categories/[categoryId]/route";
import {
  GET as transactionsGET,
  POST as transactionsPOST,
} from "@/app/api/transactions/route";
import {
  PATCH as transactionIdPATCH,
  DELETE as transactionIdDELETE,
} from "@/app/api/transactions/[transactionId]/route";
import { GET as dashboardSummaryGET } from "@/app/api/dashboard/summary/route";

describe("REST API Route Handlers & Postman Collection Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserId.mockResolvedValue("user_1");
  });

  it("POST /api/auth/signup creates a user (201) and rejects invalid input (400)", async () => {
    mockSignupUser.mockResolvedValueOnce({
      id: "user_1",
      name: "Alex Mwangi",
      email: "alex@example.com",
    });

    const res = await signupPOST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alex Mwangi",
          email: "alex@example.com",
          password: "Password123!",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("alex@example.com");

    const badRes = await signupPOST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: "invalid", password: "123" }),
      })
    );
    expect(badRes.status).toBe(400);
  });

  it("PATCH /api/onboarding/personal-info and POST /api/onboarding/complete succeed for authenticated users", async () => {
    mockSavePersonalInfo.mockResolvedValueOnce({
      id: "user_1",
      name: "Alex Mwangi",
      baseCurrency: "KES",
      country: "Kenya",
    });

    const infoRes = await onboardingPersonalInfoPATCH(
      new Request("http://localhost:3000/api/onboarding/personal-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alex Mwangi",
          baseCurrency: "KES",
          country: "Kenya",
        }),
      })
    );
    expect(infoRes.status).toBe(200);

    mockCompleteOnboarding.mockResolvedValueOnce({
      id: "user_1",
      onboardedAt: new Date("2026-10-19T12:00:00Z"),
    });

    const completeRes = await onboardingCompletePOST(
      new Request("http://localhost:3000/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomeSources: [
            {
              name: "Main Salary",
              amount: "150000.00",
              currency: "KES",
              frequency: "MONTHLY",
            },
          ],
        }),
      })
    );
    expect(completeRes.status).toBe(200);
  });

  it("GET /api/accounts, POST /api/accounts, PATCH /api/accounts/[accountId], and DELETE /api/accounts/[accountId] work end-to-end", async () => {
    mockListAccountsWithBalances.mockResolvedValueOnce({
      accounts: [
        {
          id: "acc_1",
          name: "KCB Checking",
          type: "BANK",
          currency: "KES",
          balance: "50000.00",
        },
      ],
      totalsByCurrency: { KES: "50000.00" },
    });

    const listRes = await accountsGET();
    expect(listRes.status).toBe(200);

    mockCreateAccount.mockResolvedValueOnce({
      id: "acc_1",
      name: "KCB Checking",
      type: "BANK",
      currency: "KES",
      openingBalance: "50000.00",
      isArchived: false,
    });

    const createRes = await accountsPOST(
      new Request("http://localhost:3000/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "KCB Checking",
          type: "BANK",
          currency: "KES",
          openingBalance: "50000.00",
        }),
      })
    );
    expect(createRes.status).toBe(201);

    mockUpdateAccount.mockResolvedValueOnce({
      id: "acc_1",
      name: "KCB Updated",
      type: "BANK",
      currency: "KES",
      openingBalance: "50000.00",
      isArchived: false,
    });

    const patchRes = await accountIdPATCH(
      new Request("http://localhost:3000/api/accounts/acc_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "KCB Updated" }),
      }),
      { params: { accountId: "acc_1" } }
    );
    expect(patchRes.status).toBe(200);

    mockArchiveAccount.mockResolvedValueOnce({ id: "acc_1", isArchived: true });
    const delRes = await accountIdDELETE(
      new Request("http://localhost:3000/api/accounts/acc_1", { method: "DELETE" }),
      { params: { accountId: "acc_1" } }
    );
    expect(delRes.status).toBe(200);
  });

  it("GET /api/categories, POST /api/categories, PATCH /api/categories/[categoryId], and DELETE /api/categories/[categoryId] work end-to-end", async () => {
    mockListCategories.mockResolvedValueOnce([
      { id: "cat_1", name: "Food", isDefault: true, userId: null },
    ]);
    const listRes = await categoriesGET();
    expect(listRes.status).toBe(200);

    mockCreateCategory.mockResolvedValueOnce({
      id: "cat_custom",
      name: "Side Hustle",
      isDefault: false,
      userId: "user_1",
    });
    const postRes = await categoriesPOST(
      new Request("http://localhost:3000/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Side Hustle" }),
      })
    );
    expect(postRes.status).toBe(201);

    mockRenameCategory.mockResolvedValueOnce({
      id: "cat_custom",
      name: "Consulting",
      isDefault: false,
      userId: "user_1",
    });
    const patchRes = await categoryIdPATCH(
      new Request("http://localhost:3000/api/categories/cat_custom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Consulting" }),
      }),
      { params: { categoryId: "cat_custom" } }
    );
    expect(patchRes.status).toBe(200);

    mockDeleteCategory.mockResolvedValueOnce(undefined);
    const delRes = await categoryIdDELETE(
      new Request("http://localhost:3000/api/categories/cat_custom", {
        method: "DELETE",
      }),
      { params: { categoryId: "cat_custom" } }
    );
    expect(delRes.status).toBe(200);
  });

  it("GET /api/transactions, POST /api/transactions, PATCH /api/transactions/[transactionId], and DELETE /api/transactions/[transactionId] work end-to-end", async () => {
    mockListTransactions.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });
    const listRes = await transactionsGET(
      new Request("http://localhost:3000/api/transactions?limit=10")
    );
    expect(listRes.status).toBe(200);

    mockCreateTransaction.mockResolvedValueOnce({
      id: "tx_1",
      accountId: "acc_1",
      transferAccountId: null,
      type: "EXPENSE",
      amount: "1200.00",
      currency: "KES",
      description: "Groceries",
      date: new Date("2026-10-19T10:00:00Z"),
    });
    const postRes = await transactionsPOST(
      new Request("http://localhost:3000/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "acc_1",
          type: "EXPENSE",
          amount: "1200.00",
          currency: "KES",
          description: "Groceries",
          date: "2026-10-19T10:00:00.000Z",
        }),
      })
    );
    expect(postRes.status).toBe(201);

    mockUpdateTransaction.mockResolvedValueOnce({
      id: "tx_1",
      amount: "1300.00",
      description: "Updated Groceries",
    });
    const patchRes = await transactionIdPATCH(
      new Request("http://localhost:3000/api/transactions/tx_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: "1300.00",
          description: "Updated Groceries",
        }),
      }),
      { params: { transactionId: "tx_1" } }
    );
    expect(patchRes.status).toBe(200);

    mockSoftDeleteTransaction.mockResolvedValueOnce({ id: "tx_1" });
    const delRes = await transactionIdDELETE(
      new Request("http://localhost:3000/api/transactions/tx_1", {
        method: "DELETE",
      }),
      { params: { transactionId: "tx_1" } }
    );
    expect(delRes.status).toBe(200);
  });

  it("GET /api/dashboard/summary returns 200 for valid year/month and 401 when unauthenticated", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({
      period: { year: 2026, month: 10, start: "", end: "" },
      byCurrency: {},
      accounts: [],
      recentTransactions: [],
      emergencyFundProgress: null,
      budgetVsActual: null,
      upcomingObligations: [],
    });

    const okRes = await dashboardSummaryGET(
      new Request("http://localhost:3000/api/dashboard/summary?year=2026&month=10")
    );
    expect(okRes.status).toBe(200);

    mockRequireUserId.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const unauthRes = await dashboardSummaryGET(
      new Request("http://localhost:3000/api/dashboard/summary?year=2026&month=10")
    );
    expect(unauthRes.status).toBe(401);
  });

  it("validates postman/finance-os.postman_collection.json contains all 6 endpoint folders and pm.test scripts", () => {
    const collectionPath = path.resolve(
      process.cwd(),
      "postman/finance-os.postman_collection.json"
    );
    expect(fs.existsSync(collectionPath)).toBe(true);

    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));
    expect(collection.info.schema).toContain("v2.1.0");
    expect(collection.item).toHaveLength(6);

    const folderNames = collection.item.map((f: { name: string }) => f.name);
    expect(folderNames).toEqual([
      "1. Auth",
      "2. Onboarding",
      "3. Accounts & Balances",
      "4. Categories",
      "5. Transactions",
      "6. Dashboard Summary",
    ]);

    // Every request in every folder has a Postman test script attached
    for (const folder of collection.item) {
      expect(folder.item.length).toBeGreaterThan(0);
      for (const reqItem of folder.item) {
        const testEvent = reqItem.event?.find(
          (e: { listen: string }) => e.listen === "test"
        );
        expect(testEvent).toBeDefined();
        expect(testEvent.script.exec.join("\n")).toContain("pm.test(");
      }
    }
  });
});

