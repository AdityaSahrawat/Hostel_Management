"use client";

import { useEffect, useState } from "react";

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

type StudentCreate = Omit<Student, "id">;

function parseBulkStudents(input: string, mode: "csv" | "json"): StudentCreate[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (mode === "json") {
    const parsed = JSON.parse(trimmed) as any;
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.students) ? parsed.students : null;
    if (!Array.isArray(arr)) throw new Error("JSON must be an array or { students: [...] }");

    return arr.map((s, i) => {
      const roll_no = String(s.roll_no ?? "").trim();
      const branch = String(s.branch ?? "").trim() as Branch;
      const state = String(s.state ?? "").trim();
      const gender = String(s.gender ?? "").trim() as Gender;
      const room_no = String(s.room_no ?? "").trim();

      if (!roll_no || !branch || !state || !gender || !room_no) {
        throw new Error(`Missing fields in row ${i + 1}`);
      }

      return { roll_no, branch, state, gender, room_no };
    });
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const maybeHeader = lines[0].toLowerCase();
  const startIndex = maybeHeader.includes("roll") && maybeHeader.includes("branch") ? 1 : 0;

  const rows = lines.slice(startIndex);
  return rows.map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 5) throw new Error(`CSV row ${idx + 1} must have 5 columns`);

    const [roll_no, branchRaw, state, genderRaw, room_no] = parts;
    const branch = branchRaw as Branch;
    const gender = genderRaw as Gender;

    if (!roll_no || !branch || !state || !gender || !room_no) {
      throw new Error(`Missing fields in CSV row ${idx + 1}`);
    }

    return { roll_no, branch, state, gender, room_no };
  });
}

export default function StudentsPage() {
  const { auth } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const [single, setSingle] = useState<StudentCreate>({
    roll_no: "",
    branch: "CSE",
    state: "",
    gender: "MALE",
    room_no: "",
  });

  const [bulkMode, setBulkMode] = useState<"csv" | "json">("csv");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreviewError, setBulkPreviewError] = useState<string | null>(null);
  const [bulkPreviewCount, setBulkPreviewCount] = useState(0);

  const selectedCount = selectedIds.size;

  useEffect(() => {
    try {
      const parsed = parseBulkStudents(bulkText, bulkMode);
      setBulkPreviewCount(parsed.length);
      setBulkPreviewError(null);
    } catch (e) {
      setBulkPreviewCount(0);
      setBulkPreviewError(e instanceof Error ? e.message : "Invalid input");
    }
  }, [bulkText, bulkMode]);

  async function load() {
    if (!auth) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<Student[]>("/students", auth.token);
      setStudents(data);
      setSelectedIds(new Set());
      setLastClickedIndex(null);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  function toggleOne(index: number, shiftKey: boolean) {
    const student = students[index];
    if (!student) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && lastClickedIndex !== null) {
        const a = Math.min(lastClickedIndex, index);
        const b = Math.max(lastClickedIndex, index);
        for (let i = a; i <= b; i++) {
          const id = students[i]?.id;
          if (id) next.add(id);
        }
      } else {
        if (next.has(student.id)) next.delete(student.id);
        else next.add(student.id);
      }

      return next;
    });

    setLastClickedIndex(index);
  }

  async function onCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;

    setError(null);
    try {
      await apiPost("/students", single, auth.token);
      setSingle({ roll_no: "", branch: "CSE", state: "", gender: "MALE", room_no: "" });
      await load();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to create";
      setError(message);
    }
  }

  async function onCreateBulk() {
    if (!auth) return;

    setError(null);
    try {
      const parsed = parseBulkStudents(bulkText, bulkMode);
      if (parsed.length === 0) throw new Error("No students found in input");

      await apiPost("/students/bulk", { students: parsed }, auth.token);
      setBulkText("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bulk add failed";
      setError(message);
    }
  }

  async function onDeleteSelected() {
    if (!auth) return;
    if (selectedIds.size === 0) return;

    const ok = window.confirm(`Delete ${selectedIds.size} students?`);
    if (!ok) return;

    setError(null);
    try {
      await apiPost("/students/bulk-delete", { ids: Array.from(selectedIds) }, auth.token);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bulk delete failed";
      setError(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm opacity-80 mt-1">Tip: shift-click to select a range for bulk delete.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
            onClick={() => load()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
            onClick={() => {
              setSelectedIds(new Set());
              setLastClickedIndex(null);
            }}
            disabled={selectedCount === 0}
          >
            Clear selection
          </button>
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30 disabled:opacity-60"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
          >
            Delete selected ({selectedCount})
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-foreground/10 rounded-xl p-5">
          <h2 className="font-semibold">Add a student</h2>
          <form className="mt-4 space-y-3" onSubmit={onCreateSingle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Roll no</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.roll_no}
                  onChange={(e) => setSingle((p) => ({ ...p, roll_no: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Room</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.room_no}
                  onChange={(e) => setSingle((p) => ({ ...p, room_no: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Branch</label>
                <select
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.branch}
                  onChange={(e) => setSingle((p) => ({ ...p, branch: e.target.value as Branch }))}
                >
                  <option value="CSE">CSE</option>
                  <option value="DSAI">DSAI</option>
                  <option value="ECE">ECE</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm">Gender</label>
                <select
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.gender}
                  onChange={(e) => setSingle((p) => ({ ...p, gender: e.target.value as Gender }))}
                >
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm">State</label>
              <input
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                value={single.state}
                onChange={(e) => setSingle((p) => ({ ...p, state: e.target.value }))}
              />
            </div>

            <button
              className="text-sm rounded-lg px-3 py-2 border border-foreground/15 hover:border-foreground/30"
              type="submit"
            >
              Add student
            </button>
          </form>
        </div>

        <div className="border border-foreground/10 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Bulk add</h2>
            <select
              className="text-sm rounded-lg border border-foreground/15 bg-background px-2 py-1 outline-none focus:border-foreground/30"
              value={bulkMode}
              onChange={(e) => setBulkMode(e.target.value as any)}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <p className="text-xs opacity-70 mt-2">
            CSV format: <span className="font-mono">roll_no,branch,state,gender,room_no</span> (header optional)
          </p>

          <textarea
            className="mt-3 w-full h-40 rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30 font-mono text-xs"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={bulkMode === "csv" ? "22CSE001,CSE,Delhi,MALE,R101\n22CSE002,CSE,UP,FEMALE,R101" : "[{\"roll_no\":\"22CSE001\",\"branch\":\"CSE\",\"state\":\"Delhi\",\"gender\":\"MALE\",\"room_no\":\"R101\"}]"}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs opacity-70">
              {bulkPreviewError ? (
                <span className="text-red-600 dark:text-red-400">{bulkPreviewError}</span>
              ) : (
                <span>{bulkPreviewCount} students parsed</span>
              )}
            </div>
            <button
              className="text-sm rounded-lg px-3 py-2 border border-foreground/15 hover:border-foreground/30 disabled:opacity-60"
              onClick={() => void onCreateBulk()}
              disabled={!bulkText.trim() || Boolean(bulkPreviewError)}
            >
              Add bulk
            </button>
          </div>
        </div>
      </section>

      <section className="border border-foreground/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-foreground/10 flex items-center justify-between">
          <div className="font-semibold">All students</div>
          <div className="text-sm opacity-70">{students.length} total</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-foreground/10">
              <tr>
                <th className="px-5 py-3 w-10">Sel</th>
                <th className="px-5 py-3">Roll</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">Gender</th>
                <th className="px-5 py-3">Room</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, index) => {
                const checked = selectedIds.has(s.id);
                return (
                  <tr
                    key={s.id}
                    className={
                      "border-b border-foreground/5 cursor-pointer hover:bg-foreground/5 " +
                      (checked ? "bg-foreground/5" : "")
                    }
                    onClick={(e) => toggleOne(index, e.shiftKey)}
                  >
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={checked} readOnly />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{s.roll_no}</td>
                    <td className="px-5 py-3">{s.branch}</td>
                    <td className="px-5 py-3">{s.state}</td>
                    <td className="px-5 py-3">{s.gender}</td>
                    <td className="px-5 py-3">{s.room_no}</td>
                  </tr>
                );
              })}

              {students.length === 0 && !isLoading ? (
                <tr>
                  <td className="px-5 py-6 text-sm opacity-70" colSpan={6}>
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs opacity-70">
        Optional: you can also delete a single student via <span className="font-mono">DELETE /students/:id</span>.
      </div>
    </div>
  );
}
