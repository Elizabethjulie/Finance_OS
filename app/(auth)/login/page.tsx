"use client";

import React, { useState } from "react";
import { useFormState } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, type LoginFormState } from "./actions";
import {
  FinanceOSLogo,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  AppleIcon,
  ShieldIcon,
} from "@/components/ui/icons";

const initialState: LoginFormState = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const justCreatedAccount = searchParams.get("message") === "account-created";

  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col justify-between p-4 sm:p-6 text-slate-800">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <FinanceOSLogo />
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span>Encrypted Workspace</span>
          <span className="text-slate-400">🔒</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white rounded-3xl border border-[#E5EBE8] p-7 sm:p-9 shadow-xs">
          {/* Top Banner Alert (if account created or password reset) */}
          {justCreatedAccount ? (
            <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200/80 p-3 flex items-center gap-2 text-xs text-amber-900">
              <span className="text-amber-600 font-bold">✓</span>
              <span>Your account was created — log in to continue.</span>
            </div>
          ) : (
            <div className="mb-6 rounded-xl bg-[#FEF9EE] border border-[#FDE68A] p-2.5 flex items-center gap-2 text-xs text-amber-900">
              <span className="text-amber-600 font-bold">✓</span>
              <span>We sent an access reset link to your email if requested.</span>
            </div>
          )}

          {/* Centered App Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0F5147] flex items-center justify-center text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <path d="M4 4h16v16H4z" strokeWidth="0" fill="transparent" />
                <path d="M7 6h10" />
                <path d="M7 11h7" />
                <path d="M7 16h5" />
                <circle cx="16" cy="15" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Good to see you again. Let&apos;s check in on your money.
            </p>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400">
                  <MailIcon className="w-4 h-4" />
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue="alex@example.com"
                  required
                  placeholder="alex@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-[#0F5147] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5147]/10 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <a href="#" className="text-xs font-semibold text-[#0F5147] hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400">
                  <LockIcon className="w-4 h-4" />
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-[#0F5147] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5147]/10 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded-md border-slate-300 text-[#0F5147] focus:ring-[#0F5147]"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 cursor-pointer select-none">
                Remember this device for 30 days
              </label>
            </div>

            {state.error && (
              <p
                role="alert"
                className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200"
              >
                {state.error}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white py-3 rounded-xl text-sm font-semibold shadow-xs transition-all hover:shadow-md cursor-pointer"
            >
              <span>Sign in to Finance OS</span>
              <span>→</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">or continue with</span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Google</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <AppleIcon className="w-4 h-4 text-slate-900" />
              <span>Apple</span>
            </button>
          </div>

          {/* Footer Text */}
          <p className="mt-7 text-center text-xs text-slate-500">
            Don&apos;t have an account yet?{" "}
            <Link href="/signup" className="font-semibold text-[#0F5147] hover:underline">
              Create your account
            </Link>
          </p>
        </div>

        {/* Security Assurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldIcon className="w-3.5 h-3.5 text-emerald-600" />
          <span>Safe, encrypted, and built for your peace of mind.</span>
        </div>
      </main>

      <div />
    </div>
  );
}