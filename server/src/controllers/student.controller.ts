import type { Request, Response } from "express";

import prisma from "../prisma";

type CreateStudentBody = {
  roll_no?: string;
  branch?: "CSE" | "DSAI" | "ECE";
  state?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  room_no?: string; // references Room.id in your schema
};

export async function createStudent(req: Request, res: Response) {
  const body = req.body as CreateStudentBody;

  if (!body.roll_no || !body.branch || !body.state || !body.gender || !body.room_no) {
    return res.status(400).json({ error: "roll_no, branch, state, gender, room_no are required" });
  }

  const student = await prisma.student.create({
    data: {
      roll_no: body.roll_no,
      branch: body.branch,
      state: body.state,
      gender: body.gender,
      room_no: body.room_no,
    },
  });

  return res.status(201).json(student);
}

export async function bulkCreateStudents(req: Request, res: Response) {
  const { students } = req.body as { students?: CreateStudentBody[] };

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students[] is required" });
  }

  const invalidIndex = students.findIndex(
    (s) => !s.roll_no || !s.branch || !s.state || !s.gender || !s.room_no,
  );
  if (invalidIndex !== -1) {
    return res.status(400).json({ error: `students[${invalidIndex}] is missing required fields` });
  }

  const result = await prisma.student.createMany({
    data: students.map((s) => ({
      roll_no: s.roll_no!,
      branch: s.branch!,
      state: s.state!,
      gender: s.gender!,
      room_no: s.room_no!,
    })),
    skipDuplicates: true,
  });

  return res.status(201).json({ count: result.count });
}

export async function listStudents(_req: Request, res: Response) {
  const students = await prisma.student.findMany({
    orderBy: { roll_no: "asc" },
  });
  return res.status(200).json(students);
}

export async function deleteStudent(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  await prisma.student.delete({ where: { id } });
  return res.status(204).send();
}

export async function bulkDeleteStudents(req: Request, res: Response) {
  const { ids } = req.body as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids[] is required" });
  }

  const result = await prisma.student.deleteMany({
    where: { id: { in: ids } },
  });

  return res.status(200).json({ count: result.count });
}
