import type { NextFunction, Request, Response } from "express";

import { verifyAuthToken, type AuthTokenPayload } from "../utils/jwt";

export type AuthedRequest = Request & {
  user: AuthTokenPayload;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    const payload = verifyAuthToken(token);
    (req as AuthedRequest).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireWarden(req: Request, res: Response, next: NextFunction) {
  const authed = req as AuthedRequest;
  if (authed.user?.role !== "WARDEN") {
    return res.status(403).json({ error: "Warden only" });
  }
  return next();
}
