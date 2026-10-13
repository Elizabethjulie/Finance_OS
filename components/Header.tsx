"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FinanceOSLogo, SearchIcon, BellIcon, PlusIcon } from "@/components/ui/icons";
import { logoutAction } from "@/app/dashboard/actions";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import type { Account } from "@/lib/generated/prisma/client";

interface HeaderProps {
  userName?: string;
  planName?: string;
  accounts?: Account[];
  defaultCurrency?: string;
}

export function Header({
  userName = "Alex Morgan",
  planName = "Standard Plan",
  accounts = [],
  defaultCurrency = "USD",
}: HeaderProps) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();

  const isOverview = pathname === "/dashboard";
  const isAccounts = pathname.startsWith("/dashboard/accounts") || pathname === "/accounts";
  const isBudgets = pathname.startsWith("/dashboard/budgets");
  const isInsights = pathname.startsWith("/dashboard/insights");

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AM";

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E5EBE8] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="transition-opacity hover:opacity-90">
              <FinanceOSLogo />
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="/dashboard"
                className={`transition-colors py-1 ${
                  isOverview
                    ? "text-[#0F5147] font-semibold border-b-2 border-[#0F5147]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Overview
              </Link>
              <Link
                href="/dashboard/accounts"
                className={`transition-colors py-1 ${
                  isAccounts
                    ? "text-[#0F5147] font-semibold border-b-2 border-[#0F5147]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Accounts
              </Link>
              <Link
                href="/dashboard/budgets"
                className={`transition-colors py-1 ${
                  isBudgets
                    ? "text-[#0F5147] font-semibold border-b-2 border-[#0F5147]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Budgets
              </Link>
              <Link
                href="/dashboard/insights"
                className={`transition-colors py-1 ${
                  isInsights
                    ? "text-[#0F5147] font-semibold border-b-2 border-[#0F5147]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Insights
              </Link>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              aria-label="Search"
            >
              <SearchIcon className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 relative transition-colors"
              aria-label="Notifications"
            >
              <BellIcon className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
            </button>

            {/* Add Transaction Pill Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-[#0F5147] hover:bg-[#0C433A] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Transaction</span>
            </button>

            {/* User Avatar & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-50 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0F5147] to-[#1E3A8A] text-white flex items-center justify-center font-semibold text-xs shadow-xs overflow-hidden">
                  {initials}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-semibold text-slate-900">{userName}</div>
                  <div className="text-[10px] text-slate-400">{planName}</div>
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 lg:hidden">
                    <p className="text-xs font-semibold text-slate-900">{userName}</p>
                    <p className="text-[10px] text-slate-400">{planName}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Overview
                  </Link>
                  <Link
                    href="/dashboard/accounts"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Accounts & Wallets
                  </Link>
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => startLogout(() => logoutAction())}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Transaction Modal */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        defaultCurrency={defaultCurrency}
      />
    </>
  );
}

