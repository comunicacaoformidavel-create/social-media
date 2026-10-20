import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

// Local, single-workspace application. This server has no user authentication;
// use access-controlled cloud previews or a private machine. Public deployment
// requires an authentication layer before this server is exposed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = createApp();
const dist = path.join(root, "dist");
if (existsSync(path.join(dist, "index.html"))) {
  runtime.app.use(express.static(dist));
  runtime.app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
const port = Number(process.env.PORT || 3001);
const server = runtime.app.listen(port, "0.0.0.0", () =>
  console.log(`Compasso Social disponível na porta ${port}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    runtime.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
