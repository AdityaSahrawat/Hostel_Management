"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiPost } from "@/lib/api";

type AssignRoomsResult = {
  groups_assigned: number;
  assignments: Array<{
    floor: number;
    room_no: string;
    students: string[];
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGroups(input: string, mode: "csv" | "json"): string[][] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (mode === "json") {
    const parsed = JSON.parse(trimmed) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.groups)
        ? parsed.groups
        : isRecord(parsed) && Array.isArray(parsed.roommates)
          ? parsed.roommates
          : null;

    if (!Array.isArray(arr)) throw new Error("JSON must be an array or { groups: [...] }");

    return arr.map((g, i) => {
      const students = Array.isArray(g)
        ? g
        : isRecord(g) && Array.isArray(g.students)
          ? g.students
          : isRecord(g) && Array.isArray(g.roll_nos)
            ? g.roll_nos
            : isRecord(g) && Array.isArray(g.rollNos)
              ? g.rollNos
              : null;

      if (!Array.isArray(students)) throw new Error(`Group ${i + 1} must be an array or { students: [...] }`);

      const normalized = students.map((r: unknown) => String(r ?? "").trim()).filter(Boolean);
      if (normalized.length !== 4 && normalized.length !== 5) {
        throw new Error(`Group ${i + 1} must have 4 or 5 students`);
      }

      const unique = new Set(normalized);
      if (unique.size !== normalized.length) {
        throw new Error(`Group ${i + 1} has duplicate roll numbers`);
      }

      return normalized;
    });
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const maybeHeader = lines[0].toLowerCase();
  const hasHeader = maybeHeader.includes("roll") || maybeHeader.includes("group") || maybeHeader.includes("grp");
  const rows = lines.slice(hasHeader ? 1 : 0);

  const parsedRows = rows.map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length === 0) throw new Error(`Empty row at ${idx + 1}`);
    return parts;
  });

  const looksLikeGroupMap = parsedRows.length > 0 && parsedRows.every((r) => r.length === 2);

  if (looksLikeGroupMap) {
    const byGroup = new Map<string, string[]>();
    for (const [groupId, rollNo] of parsedRows as [string, string][]) {
      const arr = byGroup.get(groupId) ?? [];
      arr.push(rollNo);
      byGroup.set(groupId, arr);
    }

    const groups = Array.from(byGroup.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, students]) => students);

    groups.forEach((g, i) => {
      if (g.length !== 4 && g.length !== 5) throw new Error(`Group ${i + 1} must have 4 or 5 students`);
      const unique = new Set(g);
      if (unique.size !== g.length) throw new Error(`Group ${i + 1} has duplicate roll numbers`);
    });

    return groups;
  }

  const groups = parsedRows.map((parts, idx) => {
    if (parts.length !== 4 && parts.length !== 5) {
      throw new Error(`CSV row ${idx + 1} must have 4 or 5 columns (or exactly 2 for group_id,roll_no format)`);
    }
    const unique = new Set(parts);
    if (unique.size !== parts.length) throw new Error(`Row ${idx + 1} has duplicate roll numbers`);
    return parts;
  });

  return groups;
}

export default function AssignRoomsPage() {
  const { auth } = useAuth();

  const [floorA, setFloorA] = useState("1");
  const [floorB, setFloorB] = useState("2");

  const [groupsMode, setGroupsMode] = useState<"csv" | "json">("csv");
  const [groupsText, setGroupsText] = useState("");
  const [groupsPreviewError, setGroupsPreviewError] = useState<string | null>(null);
  const [groupsPreviewCount, setGroupsPreviewCount] = useState(0);
  const [studentsPreviewCount, setStudentsPreviewCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignRoomsResult | null>(null);

  useEffect(() => {
    try {
      const parsed = parseGroups(groupsText, groupsMode);
      setGroupsPreviewCount(parsed.length);
      setStudentsPreviewCount(parsed.reduce((acc, g) => acc + g.length, 0));
      setGroupsPreviewError(null);
    } catch (e) {
      setGroupsPreviewCount(0);
      setStudentsPreviewCount(0);
      setGroupsPreviewError(e instanceof Error ? e.message : "Invalid groups input");
    }
  }, [groupsText, groupsMode]);

  const assignmentSummary = useMemo(() => {
    if (!result) return null;
    const byFloor = new Map<number, number>();
    for (const a of result.assignments) {
      byFloor.set(a.floor, (byFloor.get(a.floor) ?? 0) + 1);
    }
    return Array.from(byFloor.entries()).sort((a, b) => a[0] - b[0]);
  }, [result]);

  async function onGroupsFile(file: File) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) setGroupsMode("json");
    if (lower.endsWith(".csv")) setGroupsMode("csv");
    setGroupsText(text);
  }

  async function onSubmit() {
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const floorANum = Number(floorA);
      const floorBNum = Number(floorB);
      if (!Number.isInteger(floorANum) || floorANum < 0 || floorANum > 4) throw new Error("Floor A must be 0-4");
      if (!Number.isInteger(floorBNum) || floorBNum < 0 || floorBNum > 4) throw new Error("Floor B must be 0-4");

      const groups = parseGroups(groupsText, groupsMode);
      if (groups.length === 0) throw new Error("No roommate groups found");

      // Prevent duplicates across groups client-side too (backend also checks).
      const seen = new Set<string>();
      for (const g of groups) {
        for (const r of g) {
          if (seen.has(r)) throw new Error(`Duplicate roll number across groups: ${r}`);
          seen.add(r);
        }
      }

      const data = await apiPost<AssignRoomsResult>(
        "/students/assign-rooms",
        {
          groups,
          floorA: floorANum,
          floorB: floorBNum,
        },
        auth.token,
      );

      setResult(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to assign rooms";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Assign Rooms</h1>
        <p className="text-sm opacity-80 mt-1">
          Upload roommate groups (4 or 5 students per group). We fill Floor A first until it runs out of rooms,
          then assign remaining groups on Floor B. Room numbers are picked randomly within each floor.
        </p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <section className="border border-foreground/10 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Inputs</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm">Floor A (prefix)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={floorA}
              onChange={(e) => setFloorA(e.target.value)}
              min={0}
              max={4}
            />
            <div className="text-xs opacity-70">0 → 001-020, 1 → 101-148, 2 → 201-248, etc.</div>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Floor B (rest)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={floorB}
              onChange={(e) => setFloorB(e.target.value)}
              min={0}
              max={4}
            />
            <div className="text-xs opacity-70">
              After Floor A is full, remaining groups go here.
            </div>
          </div>
        </div>

        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Roommate groups file</div>
                <div className="text-xs opacity-70">CSV or JSON</div>
              </div>
              <select
                className="text-sm rounded-md px-2 py-1 border border-foreground/15 bg-background"
                value={groupsMode}
                onChange={(e) => setGroupsMode(e.target.value === "json" ? "json" : "csv")}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <label className="inline-flex items-center justify-center text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground/5 hover:bg-foreground/10 cursor-pointer">
              Choose file
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onGroupsFile(f);
                }}
              />
            </label>

            <textarea
              className="w-full h-40 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm font-mono outline-none focus:border-foreground/30"
              placeholder={
                groupsMode === "json"
                  ? 'Example: [["ROLL1","ROLL2","ROLL3","ROLL4"],["A","B","C","D","E"]]'
                  : "CSV formats: (1) group_id,roll_no per row OR (2) 4/5 roll_nos per row"
              }
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
            />

            <div className="text-xs opacity-70">
              Preview: {groupsPreviewCount} groups, {studentsPreviewCount} students
            </div>
            {groupsPreviewError ? <div className="text-xs text-red-600">{groupsPreviewError}</div> : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30 bg-foreground/5 disabled:opacity-60"
            onClick={() => void onSubmit()}
            disabled={submitting || !!groupsPreviewError}
          >
            {submitting ? "Assigning…" : "Assign rooms"}
          </button>
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
            type="button"
            onClick={() => {
              setGroupsText("");
              setError(null);
              setResult(null);
            }}
            disabled={submitting}
          >
            Clear
          </button>
        </div>
      </section>

      {result ? (
        <section className="border border-foreground/10 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Result</h2>
              <div className="text-sm opacity-80 mt-1">Assigned {result.groups_assigned} rooms.</div>
            </div>
            {assignmentSummary ? (
              <div className="text-xs opacity-70">
                {assignmentSummary.map(([floor, count]) => (
                  <div key={floor}>
                    Floor {floor}: {count} rooms
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-auto border border-foreground/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-foreground/5">
                <tr>
                  <th className="text-left p-2 border-b border-foreground/10">Floor</th>
                  <th className="text-left p-2 border-b border-foreground/10">Room</th>
                  <th className="text-left p-2 border-b border-foreground/10">Students</th>
                </tr>
              </thead>
              <tbody>
                {result.assignments.map((a, idx) => (
                  <tr key={idx} className="border-b border-foreground/10 last:border-b-0">
                    <td className="p-2">{a.floor}</td>
                    <td className="p-2 font-mono">{a.room_no}</td>
                    <td className="p-2 font-mono">{a.students.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
