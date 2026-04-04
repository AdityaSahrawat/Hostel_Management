"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGet, apiPost } from "@/lib/api";

type Branch = "CSE" | "DSAI" | "ECE";
type Gender = "MALE" | "FEMALE" | "OTHER";

type Student = {
  id: string;
  roll_no: string;
  branch: Branch;
  state: string;
  gender: Gender;
  room_no: string;
};

type OutPass = {
  id: string;
  image_url: string;
  days: number;
  start_date: string;
  end_date: string;
  student_id: string;
};

export default function OutpassesPage() {
  const { auth } = useAuth();
  const [items, setItems] = useState<OutPass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    student_id: "",
    start_date: "",
    end_date: "",
    days: "",
  });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rollNoByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) map.set(s.id, s.roll_no);
    return map;
  }, [students]);

  async function loadOutpasses() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const outpasses = await apiGet<OutPass[]>("/outpasses", auth.token);
      setItems(outpasses);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    if (!auth) return;
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const studentsData = await apiGet<Student[]>("/students", auth.token);
      setStudents(studentsData);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load students";
      setStudentsError(message);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  useEffect(() => {
    void loadOutpasses();
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    try {
      const daysNum = Number(form.days);
      if (!form.student_id || !form.start_date || !form.end_date || !Number.isFinite(daysNum)) {
        throw new Error("student, start_date, end_date, days are required");
      }

      const payload: any = {
        student_id: form.student_id,
        start_date: form.start_date,
        end_date: form.end_date,
        days: daysNum,
      };

      if (imageDataUrl) payload.imageDataUrl = imageDataUrl;

      await apiPost("/outpasses", payload, auth.token);

      setForm({ student_id: "", start_date: "", end_date: "", days: "" });
      setImageDataUrl(null);
      await loadOutpasses();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onPickFile(file: File) {
    const reader = new FileReader();
    const result = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    setImageDataUrl(result);
  }

  function exportAsJSON() {
    const data = items.map((o) => ({
      roll_no: rollNoByStudentId.get(o.student_id) ?? o.student_id,
      start_date: new Date(o.start_date).toLocaleDateString(),
      end_date: new Date(o.end_date).toLocaleDateString(),
      days: o.days,
      image_url: o.image_url,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outpasses_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportAsCSV() {
    const lines = ["Roll_No,Start_Date,End_Date,Days,Image"];
    for (const o of items) {
      const roll = rollNoByStudentId.get(o.student_id) ?? o.student_id;
      const start = new Date(o.start_date).toLocaleDateString();
      const end = new Date(o.end_date).toLocaleDateString();
      const img = o.image_url ? `"${o.image_url.replace(/"/g, '""')}"` : "";
      lines.push(`${roll},${start},${end},${o.days},${img}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outpasses_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Outpasses</h1>
          <p className="text-sm opacity-80 mt-1">Create and view outpasses.</p>
        </div>
        <button
          className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30 bg-foreground/5"
          onClick={() => {
            void loadOutpasses();
            void loadStudents();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <section className="border border-foreground/10 rounded-xl p-5">
        <h2 className="font-semibold">Create outpass</h2>
        <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onCreate}>
          <div className="space-y-1">
            <label className="text-sm">Student</label>
            <select
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.student_id}
              onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}
              disabled={studentsLoading || !!studentsError}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_no} • Room {s.room_no} • {s.branch}
                </option>
              ))}
            </select>
            {studentsLoading ? <div className="text-xs opacity-70">Loading students…</div> : null}
            {studentsError ? <div className="text-xs text-red-600">{studentsError}</div> : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm">Days</label>
            <input
              type="number"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.days}
              onChange={(e) => setForm((p) => ({ ...p, days: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Start date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">End date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm">Image</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div className="space-y-2">
                <label className="inline-flex items-center justify-center text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground/5 hover:bg-foreground/10 cursor-pointer">
                  Choose image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPickFile(f);
                    }}
                  />
                </label>
                <div className="text-xs opacity-70">Upload only (no URL). Sent as base64 JSON to the server.</div>
                {imageDataUrl ? (
                  <button
                    type="button"
                    className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
                    onClick={() => setImageDataUrl(null)}
                  >
                    Remove image
                  </button>
                ) : null}
              </div>
              <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 min-h-28 flex items-center justify-center">
                {imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="Preview" className="max-h-40 w-auto rounded-md" />
                ) : (
                  <div className="text-sm opacity-70">No image selected</div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create outpass"}
            </button>
          </div>
        </form>
      </section>

      <section className="border border-foreground/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-foreground/10 flex items-center justify-between">
          <div className="font-semibold">All outpasses</div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 mr-2">
              <button
                className="text-xs rounded border border-foreground/30 px-2 py-1 hover:bg-foreground/5 disabled:opacity-50"
                type="button"
              onClick={exportAsCSV}
                disabled={items.length === 0}
              >
                CSV
              </button>
              <button
                className="text-xs rounded border border-foreground/30 px-2 py-1 hover:bg-foreground/5 disabled:opacity-50"
                type="button"
              onClick={exportAsJSON}
                disabled={items.length === 0}
              >
                JSON
              </button>
            </div>
            <div className="text-sm opacity-70">{items.length} total</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-foreground/10">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Image</th>
                <th className="px-5 py-3">Start</th>
                <th className="px-5 py-3">End</th>
                <th className="px-5 py-3">Days</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-foreground/5">
                  <td className="px-5 py-3 font-mono text-xs">{rollNoByStudentId.get(o.student_id) ?? o.student_id}</td>
                  <td className="px-5 py-3">
                    {o.image_url ? (
                      <a
                        className="text-xs underline underline-offset-2"
                        href={o.image_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-xs opacity-70">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{new Date(o.start_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{new Date(o.end_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{o.days}</td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-5 py-6 text-sm opacity-70" colSpan={5}>
                    No outpasses.
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
