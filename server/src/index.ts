import express, { type NextFunction, type Request, type Response } from "express";

import routes from "./routes";

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use(routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found", path: req.path });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Internal Server Error";

  const dbUrl = process.env.DATABASE_URL ?? "";
  const looksLikeSqlite = dbUrl.startsWith("file:");
  const looksLikeConnRefused = typeof err === "object" && err !== null && "code" in err && (err as any).code === "ECONNREFUSED";

  if (!isProd && (looksLikeSqlite || looksLikeConnRefused)) {
    return res.status(500).json({
      error: "Database connection failed",
      hint: looksLikeSqlite
        ? "Your DATABASE_URL is set to a sqlite file (file:...). This server uses Postgres. Update server/.env DATABASE_URL to a Postgres connection string."
        : "Connection refused. Check that your Postgres/Supabase is reachable and DATABASE_URL is correct.",
    });
  }

  return res.status(500).json({ error: isProd ? "Internal Server Error" : message });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3010;
if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
