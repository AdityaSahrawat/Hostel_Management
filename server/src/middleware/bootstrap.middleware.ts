import type { NextFunction, Request, Response } from "express";

export function requireBootstrapSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "BOOTSTRAP_SECRET not configured" });
  }

  const provided = req.header("x-bootstrap-secret");
  if (!provided || provided !== expected) {
    return res.status(403).json({ error: "Invalid bootstrap secret" });
  }

  return next();
}
