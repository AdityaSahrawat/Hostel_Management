import type { Request, Response } from "express";

import prisma from "../prisma";
import { hashPassword } from "../utils/password";

export async function createStaff(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const existing = await prisma.staff.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: "username already exists" });
  }

  const staff = await prisma.staff.create({
    data: {
      username,
      password: await hashPassword(password),
      role: "STAFF",
    },
    select: { id: true, username: true, role: true },
  });

  return res.status(201).json(staff);
}

export async function createWarden(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const existing = await prisma.staff.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: "username already exists" });
  }

  const warden = await prisma.staff.create({
    data: {
      username,
      password: await hashPassword(password),
      role: "WARDEN",
    },
    select: { id: true, username: true, role: true },
  });

  return res.status(201).json(warden);
}
