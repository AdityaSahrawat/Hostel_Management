"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGet } from "@/lib/api";

type MessConcession = {
  id: string;
  image_url: string;
  days: number;
  start_date: string;
  End_date: string;
  amount: number;
  student_id: string;
};

export default function MessConcessionsPage() {
  const { auth } = useAuth();
  const [items, setItems] = useState<MessConcession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MessConcession[]>("/messconcessions", auth.token);
      setItems(data);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Mess Concessions</h1>
          <p className="text-sm opacity-80 mt-1">Read-only list for now.</p>
        </div>
        <button
          className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <section className="border border-foreground/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-foreground/10 flex items-center justify-between">
          <div className="font-semibold">All items</div>
          <div className="text-sm opacity-70">{items.length} total</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-foreground/10">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Start</th>
                <th className="px-5 py-3">End</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{m.student_id}</td>
                  <td className="px-5 py-3">{new Date(m.start_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{new Date(m.End_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{m.days}</td>
                  <td className="px-5 py-3">{m.amount}</td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-5 py-6 text-sm opacity-70" colSpan={5}>
                    No mess concessions.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
