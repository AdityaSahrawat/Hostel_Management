import type { Request, Response } from "express";

import prisma from "../prisma";
import { signAuthToken } from "../utils/jwt";
import { verifyPassword } from "../utils/password";

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const staff = await prisma.staff.findUnique({ where: { username } });
  if (!staff) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await verifyPassword(password, staff.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signAuthToken({ staffId: staff.id, username: staff.username, role: staff.role });

  return res.status(200).json({
    token,
    user: { id: staff.id, username: staff.username, role: staff.role },
  });
}
