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
  res.status(500).json({ error: "Internal Server Error" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
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
