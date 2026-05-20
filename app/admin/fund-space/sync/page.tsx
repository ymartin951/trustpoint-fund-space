"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SyncResult = {
  success: boolean;
  message?: string;
  activated_count?: number;
  checked_count?: number;
  results?: Array<{
    fund_space_id: string;
    name: string | null;
    member_count: number;
    member_limit: number;
    activated: boolean;
    message: string;
    activation_result?: unknown;
  }>;
};

export default function AdminFundSpaceSyncPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSync = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setResult(null);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        throw new Error("Your session has expired. Please login again.");
      }

      const response = await fetch("/api/admin/fund-space/sync-full-groups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = (await response.json()) as SyncResult;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not sync full Fund Space groups.");
      }

      setResult(data);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Something went wrong while syncing groups."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft size={16} />
        Back to Admin Dashboard
      </Link>

      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-sm md:p-8">
        <p className="mb-3 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
          Fund Space Repair
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          Sync full Fund Space groups
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 md:text-base">
          Use this page to activate Fund Space groups that are already full but
          still stuck in FORMING status.
        </p>

        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Syncing..." : "Sync Full Groups"}
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <p>{errorMessage}</p>
        </div>
      )}

      {result && (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Sync completed
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {result.message || "Full groups checked successfully."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Checked Groups</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {result.checked_count || 0}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Activated Groups</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {result.activated_count || 0}
              </p>
            </div>
          </div>

          {result.results && result.results.length > 0 && (
            <div className="mt-6 space-y-3">
              {result.results.map((item) => (
                <div
                  key={item.fund_space_id}
                  className={`rounded-2xl border p-4 text-sm ${
                    item.activated
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-gray-100 bg-gray-50 text-gray-700"
                  }`}
                >
                  <p className="font-bold">{item.name || "Unnamed Fund Space"}</p>
                  <p className="mt-1">
                    Members: {item.member_count}/{item.member_limit}
                  </p>
                  <p className="mt-1">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}