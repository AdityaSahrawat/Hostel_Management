"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { useAuth } from "@/app/providers";
import { apiGet, apiPost } from "@/lib/api";

type StudentInRoom = {
  id: string;
  roll_no: string;
  name: string | null;
  std_phone_no: string | null;
  branch: string;
  gender: string;
  state: string;
};

type Room = {
  id: string;
  room_no: number;
  floor: number;
  students: StudentInRoom[];
};

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

export default function RoomsPage() {
  const { auth } = useAuth();

  // Rooms List State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // Filters and Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [floorA, setFloorA] = useState("1");
  const [floorB, setFloorB] = useState("2");
  const [groupsMode, setGroupsMode] = useState<"csv" | "json">("json");
  const [groupsText, setGroupsText] = useState("");
  const [groupsPreviewError, setGroupsPreviewError] = useState<string | null>(null);
  const [groupsPreviewCount, setGroupsPreviewCount] = useState(0);
  const [studentsPreviewCount, setStudentsPreviewCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignRoomsResult | null>(null);

  useEffect(() => {
    fetchRooms();
  }, [auth]);

  async function fetchRooms() {
    if (!auth) return;
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const data = await apiGet<Room[]>("/rooms", auth.token);
      setRooms(data);
    } catch (e) {
      setRoomsError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setIsLoadingRooms(false);
    }
  }

  // Live preview parser
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

  const capacityFeedback = useMemo(() => {
    if (!rooms.length || groupsPreviewCount === 0 || groupsPreviewError) return null;
    const fA = Number(floorA);
    const fB = Number(floorB);
    if (!Number.isFinite(fA) || !Number.isFinite(fB)) return null;

    let aVacant = 0;
    let bVacant = 0;

    for (const r of rooms) {
      if (r.students.length === 0) {
         if (r.floor === fA) aVacant++;
         else if (r.floor === fB) bVacant++;
      }
    }

    const totalVacant = fA === fB ? aVacant : aVacant + bVacant;

    if (totalVacant < groupsPreviewCount) {
       return { valid: false, message: `Insufficient capacity: You are assigning ${groupsPreviewCount} groups, but Floors ${fA} and ${fB} only have ${totalVacant} completely vacant rooms combined.` };
    }

    return { valid: true, message: `Capacity ok: ${totalVacant} vacant rooms available for ${groupsPreviewCount} groups.` };
  }, [rooms, floorA, floorB, groupsPreviewCount, groupsPreviewError]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = String(r.room_no).includes(q);
      const matchFloor = floorFilter === "ALL" || String(r.floor) === floorFilter;
      const matchBatch = batchFilter === "ALL" || r.students.some(s => s.roll_no.toLowerCase().startsWith(batchFilter.toLowerCase()));
      return matchSearch && matchFloor && matchBatch;
    });
  }, [rooms, searchQuery, floorFilter, batchFilter]);

  async function onGroupsFile(file: File) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) setGroupsMode("json");
    if (lower.endsWith(".csv")) setGroupsMode("csv");
    setGroupsText(text);
  }

  async function onSubmitAssign() {
    if (!auth) return;
    setSubmitting(true);
    setAssignError(null);
    setResult(null);

    try {
      const floorANum = Number(floorA);
      const floorBNum = Number(floorB);
      if (!Number.isFinite(floorANum) || floorANum < 0 || floorANum > 4) throw new Error("Floor A must be 0-4");
      if (!Number.isFinite(floorBNum) || floorBNum < 0 || floorBNum > 4) throw new Error("Floor B must be 0-4");

      const groups = parseGroups(groupsText, groupsMode);
      if (groups.length === 0) throw new Error("No roommate groups found");

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
      setGroupsText("");
      fetchRooms(); // refresh background rooms exactly after success
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to assign rooms";
      setAssignError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onExchangeRoom(roomNo: number) {
    if (!auth) return;
    const target = prompt(`Exchange the students in Room ${roomNo} with which Room Number? (e.g. 201)`);
    if (!target) return;
    try {
      await apiPost("/rooms/exchange", { roomA: roomNo, roomB: target.trim() }, auth.token);
      fetchRooms();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Exchange failed");
    }
  }

  async function onMoveStudent(studentId: string, currentRoomNo: number) {
    if (!auth) return;
    const target = prompt(`Move this student to which Room Number? (e.g. 305)`);
    if (!target || target === String(currentRoomNo)) return;
    try {
      await apiPost(`/students/${studentId}/move`, { room_no: target.trim() }, auth.token);
      fetchRooms();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function onRemoveStudent(studentId: string) {
    if (!auth) return;
    if (!confirm("Are you sure you want to completely remove this student from their room?")) return;
    try {
      await apiPost(`/students/${studentId}/remove-room`, undefined, auth.token);
      fetchRooms();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Remove failed");
    }
  }

  function exportAsJSON() {
    const data = filteredRooms.map((r) => ({
      room_no: r.room_no,
      floor: r.floor,
      students: r.students.map((s) => ({
        roll_no: s.roll_no,
        name: s.name,
      })),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rooms_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportAsCSV() {
    const lines = ["Room_No,Floor,Roll_No,Name"];
    for (const r of filteredRooms) {
      if (r.students.length === 0) {
        lines.push(`${r.room_no},${r.floor},,`);
      } else {
        for (const s of r.students) {
          const name = s.name ? `"${s.name.replace(/"/g, '""')}"` : "";
          lines.push(`${r.room_no},${r.floor},${s.roll_no},${name}`);
        }
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rooms_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Rooms Dashboard</h1>
          <p className="text-sm opacity-80 mt-1">Manage hostel rooms and their occupants.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              className="text-sm rounded-md px-3 py-2 border border-foreground/30 hover:bg-foreground/5 font-medium disabled:opacity-50"
              type="button"
              onClick={exportAsCSV}
              disabled={filteredRooms.length === 0}
            >
              Export CSV
            </button>
            <button
              className="text-sm rounded-md px-3 py-2 border border-foreground/30 hover:bg-foreground/5 font-medium disabled:opacity-50"
              type="button"
              onClick={exportAsJSON}
              disabled={filteredRooms.length === 0}
            >
              Export JSON
            </button>
          </div>
          <button
            className="text-sm rounded-md px-4 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90 font-medium"
            onClick={() => setIsAssignModalOpen(true)}
          >
            Assign Rooms
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 bg-foreground/5 p-4 rounded-xl">
        <label className="flex-1 max-w-sm flex items-center bg-background rounded-lg border border-foreground/15 px-3 py-2">
          <svg className="w-4 h-4 opacity-50 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="w-full bg-transparent outline-none text-sm"
            placeholder="Search room number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <select
          className="bg-background rounded-lg border border-foreground/15 px-3 py-2 text-sm outline-none"
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value)}
        >
          <option value="ALL">All Floors</option>
          <option value="0">Floor 0 (Ground)</option>
          <option value="1">Floor 1</option>
          <option value="2">Floor 2</option>
          <option value="3">Floor 3</option>
          <option value="4">Floor 4</option>
        </select>

        <select
          className="bg-background rounded-lg border border-foreground/15 px-3 py-2 text-sm outline-none"
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
        >
          <option value="ALL">All Batches</option>
          <option value="21">Batch '21</option>
          <option value="22">Batch '22</option>
          <option value="23">Batch '23</option>
          <option value="24">Batch '24</option>
          <option value="25">Batch '25</option>
        </select>
        
        <div className="text-sm opacity-70 ml-auto">
          {filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'}
        </div>
      </div>

      {roomsError && <div className="text-sm text-red-600">{roomsError}</div>}
      
      {/* Rooms Table */}
      <section className="bg-background border border-foreground/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-foreground/5 border-b border-foreground/10 text-xs font-semibold uppercase tracking-wider opacity-80">
              <tr>
                <th className="px-5 py-3">Room No</th>
                <th className="px-5 py-3">Floor</th>
                <th className="px-5 py-3">Occupancy</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRooms ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm opacity-70">Loading rooms...</td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm opacity-70">
                    No matching rooms found.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => {
                  const isActive = activeRoomId === room.id;
                  const isFull = room.students.length >= 4;
                  
                  return (
                    <Fragment key={room.id}>
                      <tr 
                        className={`cursor-pointer border-b border-foreground/5 hover:bg-foreground/5 transition-colors ${isActive ? 'bg-foreground/10' : ''}`}
                        onClick={() => setActiveRoomId(isActive ? null : room.id)}
                      >
                        <td className="px-5 py-4 font-mono font-medium">{room.room_no}</td>
                        <td className="px-5 py-4">{room.floor === 0 ? 'Ground' : `Floor ${room.floor}`}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isFull ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'}`}>
                            {room.students.length} / {room.room_no % 100 <= 20 && room.floor === 0 ? 4 : 5}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            className="text-xs rounded-md px-2 py-1 border border-foreground/20 hover:bg-foreground/10 mr-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onExchangeRoom(room.room_no);
                            }}
                          >
                            Exchange
                          </button>
                          <button
                            className="text-xs rounded-md px-2 py-1 border border-foreground/20 hover:bg-foreground/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRoomId(isActive ? null : room.id);
                            }}
                          >
                            {isActive ? "Hide Details" : "View Details"}
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Room Details Row */}
                      {isActive && (
                        <tr className="bg-foreground/5">
                          <td colSpan={4} className="p-0 border-b border-foreground/10">
                            <div className="px-5 py-4">
                              <h4 className="text-sm font-semibold mb-3">Roommates</h4>
                              {room.students.length === 0 ? (
                                <div className="text-sm opacity-70">This room is currently empty.</div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {room.students.map(s => (
                                    <div key={s.id} className="bg-background border border-foreground/10 rounded-lg p-3 flex flex-col justify-between space-y-3">
                                      <div className="space-y-1">
                                        <div className="font-mono text-xs font-semibold">{s.roll_no}</div>
                                        <div className="text-sm truncate">{s.name || "—"}</div>
                                        <div className="text-xs opacity-70 flex justify-between">
                                          <span>{s.branch}</span>
                                          <span>{s.std_phone_no || "No phone"}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 pt-2 border-t border-foreground/10">
                                        <button
                                          className="text-xs rounded border border-foreground/20 px-2 py-1 hover:bg-foreground/5 opacity-80"
                                          onClick={() => void onMoveStudent(s.id, room.room_no)}
                                        >
                                          Move
                                        </button>
                                        <button
                                          className="text-xs rounded border border-red-500/30 text-red-600 bg-red-500/5 px-2 py-1 hover:bg-red-500/10 opacity-80"
                                          onClick={() => void onRemoveStudent(s.id)}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Assignment Modal Overlay */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-background border border-foreground/10 w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between p-5 border-b border-foreground/10">
              <h2 className="text-lg font-semibold">Assign Rooms</h2>
              <button
                className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-foreground/10"
                onClick={() => setIsAssignModalOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              <p className="text-sm opacity-80">
                Upload roommate groups (4 or 5 students per group). We fill Floor A first until it runs out of rooms,
                then assign remaining groups on Floor B.
              </p>

              {assignError ? <div className="text-sm p-3 rounded-lg bg-red-500/10 text-red-600">{assignError}</div> : null}

              {result ? (
                <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-green-700 dark:text-green-400">Success</h3>
                      <div className="text-sm opacity-80 mt-1 text-green-800 dark:text-green-300">Successfully assigned {result.groups_assigned} rooms.</div>
                    </div>
                  </div>

                  <div className="overflow-auto border border-foreground/10 rounded-lg max-h-48">
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
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Floor A</label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                        value={floorA}
                        onChange={(e) => setFloorA(e.target.value)}
                        min={0}
                        max={4}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Floor B</label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                        value={floorB}
                        onChange={(e) => setFloorB(e.target.value)}
                        min={0}
                        max={4}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Roommate groups payload</div>
                      <select
                        className="text-sm rounded-md px-2 py-1 border border-foreground/15 bg-background outline-none"
                        value={groupsMode}
                        onChange={(e) => setGroupsMode(e.target.value === "json" ? "json" : "csv")}
                      >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                      </select>
                    </div>

                    <label className="inline-flex items-center justify-center text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground/5 hover:bg-foreground/10 cursor-pointer">
                      Upload File
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
                      className="w-full h-32 rounded-lg border border-foreground/15 bg-background/50 px-3 py-2 text-sm font-mono outline-none focus:border-foreground/30"
                      placeholder={
                        groupsMode === "json"
                          ? 'Example: [["ROLL1","ROLL2","ROLL3","ROLL4"]]'
                          : "CSV format"
                      }
                      value={groupsText}
                      onChange={(e) => setGroupsText(e.target.value)}
                    />

                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="opacity-70">
                        Valid: {groupsPreviewCount} groups, {studentsPreviewCount} students
                      </span>
                      {groupsPreviewError ? <span className="text-red-600 font-medium">{groupsPreviewError}</span> : null}
                    </div>

                    {capacityFeedback && (
                      <div className={`text-xs mt-2 p-3 rounded-lg border ${capacityFeedback.valid ? 'bg-green-500/10 text-green-700 border-green-500/30' : 'bg-red-500/10 text-red-600 border-red-500/30'}`}>
                        {capacityFeedback.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-foreground/10 bg-foreground/5 flex justify-end gap-3 rounded-b-2xl">
              <button
                className="px-4 py-2 text-sm font-medium opacity-80 hover:opacity-100"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setResult(null);
                  setAssignError(null);
                  setGroupsText("");
                }}
                disabled={submitting}
              >
                {result ? "Close" : "Cancel"}
              </button>
              
              {!result && (
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                  onClick={() => void onSubmitAssign()}
                  disabled={submitting || !!groupsPreviewError || !groupsText.trim() || (capacityFeedback ? !capacityFeedback.valid : false)}
                >
                  {submitting ? "Assigning..." : "Assign Rooms"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
