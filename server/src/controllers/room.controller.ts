import type { Request, Response } from "express";

import prisma from "../prisma";
import { resolveRoomId } from "./student.controller";

export async function listRooms(req: Request, res: Response) {
  const rooms = await prisma.room.findMany({
    include: {
      students: {
        select: {
          id: true,
          roll_no: true,
          name: true,
          std_phone_no: true,
          branch: true,
          gender: true,
          state: true,
        },
      },
    },
    orderBy: [
      { floor: "asc" },
      { room_no: "asc" }
    ]
  });

  return res.json(rooms);
}

export async function exchangeRooms(req: Request, res: Response) {
  const { roomA, roomB } = req.body;
  if (!roomA || !roomB) return res.status(400).json({ error: "roomA and roomB are required" });

  const roomIdA = await resolveRoomId(String(roomA));
  const roomIdB = await resolveRoomId(String(roomB));

  if (roomIdA === roomIdB) return res.json({ success: true });

  await prisma.$transaction(async (tx) => {
    const studentsA = await tx.student.findMany({ where: { room_no: roomIdA }, select: { id: true } });
    const studentsB = await tx.student.findMany({ where: { room_no: roomIdB }, select: { id: true } });

    // Step 1: Temporarily un-assign A's students to avoid Unique violations if there are any
    if (studentsA.length > 0) {
      await tx.student.updateMany({ where: { room_no: roomIdA }, data: { room_no: null } });
    }
    // Step 2: Move B's students to A
    if (studentsB.length > 0) {
      await tx.student.updateMany({ where: { room_no: roomIdB }, data: { room_no: roomIdA } });
    }
    // Step 3: Move A's students to B
    if (studentsA.length > 0) {
      await tx.student.updateMany({ where: { id: { in: studentsA.map(s => s.id) } }, data: { room_no: roomIdB } });
    }
  });

  return res.json({ success: true });
}
