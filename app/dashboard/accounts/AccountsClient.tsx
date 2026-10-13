"use client";

import React, { useState, useTransition } from "react";
import { Header } from "@/components/Header";
import { AddAccountModal } from "@/components/AddAccountModal";
import { syncBalancesAction } from "@/app/dashboard/actions";
import {
  BankIcon,
  MobileTowerIcon,
  WalletIcon,
  LeafInvestIcon,
  CashJarIcon,
  PiggyBankIcon,
  ShieldIcon,
  RefreshIcon,
  PlusIcon,
  LightbulbIcon,
} from "@/components/ui/icons";
import type { Account, AccountType } from "@/lib/generated/prisma/client";

interface AccountsClientProps {
  user: {
    name: string;
    baseCurrency: string;
  };
  accounts: Account[];
}

export function AccountsClient({ user, accounts }: AccountsClientProps) {
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [selectedGroupType, setSelectedGroupType] = useState<AccountType>("BANK");
  const [isSyncing, startSync] = useTransition();
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const currencySymbol =
    user.baseCurrency === "KES"
      ? "KSh"
      : user.baseCurrency === "EUR"
      ? "€"
      : user.baseCurrency === "GBP"
      ? "£"
      : "$";

  // Fallback defaults to match mockups
  const defaultBankData = [
    {
      id: "bank-1",
      name: "Chase Premier Checking",
      badge: "Primary spending account",
      subtext: "Account: •••• 4821 • USD",
      status: "● Real-time Chase sync",
      balanceLabel: "Available balance",
      balance: "6,240.80",
      iconType: "bank",
    },
    {
      id: "bank-2",
      name: "Ally High-Yield Savings",
      badge: "4.25% APY",
      subtext: "Account: •••• 9014 • USD",
      status: "▲ +$24.10 interest this month",
      balanceLabel: "Available balance",
      balance: "7,150.00",
      iconType: "piggy",
    },
  ];

  const defaultMobileData = [
    {
      id: "mob-1",
      name: "M-Pesa / Mobile Wallet",
      subtext: "Phone: +1(555) ••• 89 • USD",
      status: "● Instant P2P active",
      balanceLabel: "Wallet balance",
      balance: "430.00",
      iconType: "mobile",
    },
    {
      id: "mob-2",
      name: "Apple Cash / PayPal",
      subtext: "Direct Device Pass • USD",
      status: "Ready for contactless tap",
      balanceLabel: "Available balance",
      balance: "180.20",
      iconType: "wallet",
    },
  ];

  const defaultMmfData = [
    {
      id: "mmf-1",
      name: "Vanguard Prime MMF",
      badge: "Liquid MMF",
      subtext: "VMMXX • Auto-invest on • USD",
      status: "5.16% 7-Day SEC Yield",
      balanceLabel: "Portfolio value",
      balance: "819.50",
    },
  ];

  const defaultCashData = [
    {
      id: "cash-1",
      name: "Everyday Wallet Cash",
      subtext: "Pocket & Bedside Jar • USD",
      status: "Last counted 2 days ago",
      balanceLabel: "Counted cash",
      balance: "120.00",
    },
  ];

  // Incorporate any extra accounts created by the user
  const customBankAccounts = accounts
    .filter(
      (a) =>
        (a.type === "BANK" || a.type === "SAVINGS") &&
        !defaultBankData.some((d) => d.name === a.name)
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      badge: a.type === "SAVINGS" ? "High-Yield Savings" : "Connected bank",
      subtext: `Account: •••• ${a.id.slice(-4)} • ${a.currency}`,
      status: "● Sync active",
      balanceLabel: "Available balance",
      balance: "0.00",
      iconType: a.type === "SAVINGS" ? "piggy" : "bank",
    }));

  const allBankData = [...defaultBankData, ...customBankAccounts];

  const customMobileData = accounts
    .filter(
      (a) =>
        a.type === "MOBILE_MONEY" &&
        !defaultMobileData.some((d) => d.name === a.name)
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtext: `Wallet • ${a.currency}`,
      status: "● Active",
      balanceLabel: "Wallet balance",
      balance: "0.00",
      iconType: "mobile",
    }));

  const allMobileData = [...defaultMobileData, ...customMobileData];

  const customMmfData = accounts
    .filter(
      (a) =>
        (a.type === "MMF" || a.type === "INVESTMENT") &&
        !defaultMmfData.some((d) => d.name === a.name)
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      badge: "Investment",
      subtext: `Fund • ${a.currency}`,
      status: "Auto-invest ready",
      balanceLabel: "Portfolio value",
      balance: "0.00",
    }));

  const allMmfData = [...defaultMmfData, ...customMmfData];

  const customCashData = accounts
    .filter(
      (a) =>
        a.type === "CASH" &&
        !defaultCashData.some((d) => d.name === a.name)
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtext: `Cash • ${a.currency}`,
      status: "Active",
      balanceLabel: "Counted cash",
      balance: "0.00",
    }));

  const allCashData = [...defaultCashData, ...customCashData];

  function handleOpenAddGroup(type: AccountType) {
    setSelectedGroupType(type);
    setIsAddAccountOpen(true);
  }

  function handleSync() {
    startSync(async () => {
      await syncBalancesAction();
      setSyncNotice("All accounts reconciled and updated successfully.");
      setTimeout(() => setSyncNotice(null), 3000);
    });
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      <Header
        userName={user.name || "Alex Morgan"}
        planName="Standard Plan"
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* Top Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#E8F5F1] text-[#0F5147] mb-2">
              <ShieldIcon className="w-3.5 h-3.5" />
              <span>Protected by 256-bit Bank Grade Sync</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Your Accounts & Wallets
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              All your money places in one warm, organized space.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Net Available badge */}
            <div className="inline-flex items-center gap-2 bg-white border border-[#E5EBE8] px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-800 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Net Available:</span>
              <span className="text-slate-900">{currencySymbol}14,820.50</span>
              <span className="text-slate-400 font-normal">across 6 accounts</span>
            </div>

            {/* Sync Balances */}
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className="inline-flex items-center gap-1.5 bg-[#E8F5F1] hover:bg-[#D5EFE7] text-[#0F5147] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Balances"}</span>
            </button>

            {/* Add new account */}
            <button
              type="button"
              onClick={() => handleOpenAddGroup("BANK")}
              className="inline-flex items-center gap-1.5 bg-[#0F5147] hover:bg-[#0C433A] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add new account</span>
            </button>
          </div>
        </div>

        {syncNotice && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-emerald-600 hover:text-emerald-900 font-semibold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: Bank Accounts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                <BankIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Bank Accounts</h2>
                <p className="text-[11px] text-slate-400">2 accounts connected</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Total: <span className="font-bold">{currencySymbol}13,390.80</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allBankData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                        {item.iconType === "bank" ? (
                          <BankIcon className="w-5 h-5" />
                        ) : (
                          <PiggyBankIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                          {item.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5F1] text-[#0F5147]">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.subtext}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-50 pt-3">
                  <span className="text-xs text-slate-500">{item.status}</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {item.balanceLabel}
                    </div>
                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                      {currencySymbol}
                      {item.balance}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleOpenAddGroup("BANK")}
            className="w-full py-2.5 rounded-2xl border border-dashed border-[#A5D8CD] bg-[#F4F9F7] hover:bg-[#EBF7F4] text-[#0F5147] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add account to this group</span>
          </button>
        </section>

        {/* Section 2: Mobile Money & Digital Wallets */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                <MobileTowerIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Mobile Money & Digital Wallets
                </h2>
                <p className="text-[11px] text-slate-400">2 wallets active</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Total: <span className="font-bold">{currencySymbol}610.20</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allMobileData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0F5147] flex items-center justify-center">
                        {item.iconType === "mobile" ? (
                          <MobileTowerIcon className="w-5 h-5" />
                        ) : (
                          <WalletIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{item.subtext}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-50 pt-3">
                  <span className="text-xs text-slate-500">{item.status}</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {item.balanceLabel}
                    </div>
                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                      {currencySymbol}
                      {item.balance}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleOpenAddGroup("MOBILE_MONEY")}
            className="w-full py-2.5 rounded-2xl border border-dashed border-[#A5D8CD] bg-[#F4F9F7] hover:bg-[#EBF7F4] text-[#0F5147] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add account to this group</span>
          </button>
        </section>

        {/* Section 3: Split Row (MMF & Cash) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MMF & Investments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                  <LeafInvestIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Money Market Funds (MMF) & Investments
                  </h2>
                  <p className="text-[11px] text-slate-400">1 fund growing</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">
                {currencySymbol}819.50
              </div>
            </div>

            {allMmfData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <LeafInvestIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5F1] text-[#0F5147]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.subtext}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-50 pt-3">
                  <span className="text-xs text-slate-500">{item.status}</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {item.balanceLabel}
                    </div>
                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                      {currencySymbol}
                      {item.balance}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => handleOpenAddGroup("MMF")}
              className="w-full py-2.5 rounded-2xl border border-dashed border-[#A5D8CD] bg-[#F4F9F7] hover:bg-[#EBF7F4] text-[#0F5147] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add account to this group</span>
            </button>
          </section>

          {/* Physical Cash */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CashJarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Physical Cash</h2>
                  <p className="text-[11px] text-slate-400">1 tangible purse</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">
                {currencySymbol}120.00
              </div>
            </div>

            {allCashData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <CashJarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{item.subtext}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-50 pt-3">
                  <span className="text-xs text-slate-500">{item.status}</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {item.balanceLabel}
                    </div>
                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                      {currencySymbol}
                      {item.balance}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => handleOpenAddGroup("CASH")}
              className="w-full py-2.5 rounded-2xl border border-dashed border-[#A5D8CD] bg-[#F4F9F7] hover:bg-[#EBF7F4] text-[#0F5147] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add account to this group</span>
            </button>
          </section>
        </div>

        {/* Bottom Status Card */}
        <div className="rounded-2xl bg-white border border-[#E5EBE8] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center shrink-0">
              <LightbulbIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Everything is up-to-date!
              </h4>
              <p className="text-xs text-slate-500">
                Your accounts were refreshed 7 minutes ago. Next scheduled reconciliation tonight at midnight.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="self-end sm:self-auto bg-[#E8F5F1] hover:bg-[#D5EFE7] text-[#0F5147] px-4 py-2 rounded-full text-xs font-semibold transition-colors"
          >
            Account Settings
          </button>
        </div>
      </main>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        defaultType={selectedGroupType}
        defaultCurrency={user.baseCurrency}
      />
    </div>
  );
}

