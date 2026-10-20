import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";

async function start(dataDir, options = {}) {
  const runtime = await createApp({ dataDir, ...options });
  const server = await new Promise((resolve) => {
    const listening = runtime.app.listen(0, "127.0.0.1", () =>
      resolve(listening),
    );
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    async request(path, { method = "GET", body } = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
      };
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections?.();
      });
      await runtime.close();
    },
  };
}

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "social-media-test-"));
  let running = await start(dataDir, options);
  t.after(async () => {
    await running.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    dataDir,
    request: (...args) => running.request(...args),
    async restart() {
      await running.close();
      running = await start(dataDir, options);
    },
  };
}

test("tasks and clients survive a server restart, and task deletion persists", async (t) => {
  const app = await fixture(t);
  const client = await app.request("/api/clients", {
    method: "POST",
    body: { name: "Café Aurora" },
  });
  assert.equal(client.status, 201);
  assert.ok(client.body.id);

  const created = await app.request("/api/tasks", {
    method: "POST",
    body: { title: "Roteiro do café especial", clientId: client.body.id },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.clientId, client.body.id);

  const updated = await app.request(`/api/tasks/${created.body.id}`, {
    method: "PATCH",
    body: { title: "Roteiro revisado do café especial" },
  });
  assert.equal(updated.status, 200);
  await app.restart();

  const state = await app.request("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.clients.length, 1);
  assert.equal(state.body.tasks.length, 1);
  assert.equal(state.body.tasks[0].title, "Roteiro revisado do café especial");
  assert.equal(state.body.tasks[0].clientId, client.body.id);

  assert.equal(
    (await app.request(`/api/tasks/${created.body.id}`, { method: "DELETE" }))
      .status,
    204,
  );
  await app.restart();
  assert.deepEqual((await app.request("/api/state")).body.tasks, []);
});

test("required fields and invalid references are rejected without changing state", async (t) => {
  const app = await fixture(t);
  for (const [path, body] of [
    ["/api/tasks", { title: "   " }],
    ["/api/clients", { name: "" }],
    ["/api/checklist", { title: "" }],
    ["/api/notes", { title: "" }],
    [
      "/api/tasks",
      { title: "Referência inválida", clientId: "missing-client" },
    ],
  ]) {
    const response = await app.request(path, { method: "POST", body });
    assert.equal(response.status, 400, `Expected validation for ${path}`);
    assert.equal(typeof response.body.error, "string");
  }
  const state = (await app.request("/api/state")).body;
  for (const key of ["tasks", "clients", "checklist", "notes"])
    assert.deepEqual(state[key], []);
});

test("daily checklist completion and edited note content persist", async (t) => {
  const app = await fixture(t);
  const checklist = await app.request("/api/checklist", {
    method: "POST",
    body: { title: "Revisar publicações de hoje", date: "2026-10-19" },
  });
  assert.equal(checklist.status, 201);
  assert.equal(checklist.body.done, false);
  const completed = await app.request(`/api/checklist/${checklist.body.id}`, {
    method: "PATCH",
    body: { done: true },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.done, true);

  const note = await app.request("/api/notes", {
    method: "POST",
    body: { title: "Ideias para novembro", content: "Campanha de verão" },
  });
  assert.equal(note.status, 201);
  const edited = await app.request(`/api/notes/${note.body.id}`, {
    method: "PATCH",
    body: { content: "Campanha de verão\nGravar bastidores com a equipe." },
  });
  assert.equal(edited.status, 200);
  await app.restart();
  const state = (await app.request("/api/state")).body;
  assert.equal(state.checklist[0].done, true);
  assert.equal(state.checklist[0].date, "2026-10-19");
  assert.equal(
    state.notes[0].content,
    "Campanha de verão\nGravar bastidores com a equipe.",
  );
});

test("clients linked to tasks cannot be deleted until the task is removed", async (t) => {
  const app = await fixture(t);
  const client = (
    await app.request("/api/clients", {
      method: "POST",
      body: { name: "Estúdio Maré" },
    })
  ).body;
  const task = (
    await app.request("/api/tasks", {
      method: "POST",
      body: { title: "Carrossel de lançamento", clientId: client.id },
    })
  ).body;

  const conflict = await app.request(`/api/clients/${client.id}`, {
    method: "DELETE",
  });
  assert.equal(conflict.status, 409);
  assert.equal((await app.request("/api/state")).body.clients.length, 1);
  await app.request(`/api/tasks/${task.id}`, { method: "DELETE" });
  assert.equal(
    (await app.request(`/api/clients/${client.id}`, { method: "DELETE" }))
      .status,
    204,
  );
});

test("clients linked to notes cannot be deleted until the note is removed", async (t) => {
  const app = await fixture(t);
  const client = (
    await app.request("/api/clients", {
      method: "POST",
      body: { name: "Cliente com briefing" },
    })
  ).body;
  const note = (
    await app.request("/api/notes", {
      method: "POST",
      body: {
        title: "Briefing da marca",
        content: "Manter histórico do cliente.",
        clientId: client.id,
      },
    })
  ).body;

  const conflict = await app.request(`/api/clients/${client.id}`, {
    method: "DELETE",
  });
  assert.equal(conflict.status, 409);
  const state = (await app.request("/api/state")).body;
  assert.equal(state.clients.length, 1);
  assert.equal(state.notes[0].clientId, client.id);
  assert.equal(
    (await app.request(`/api/notes/${note.id}`, { method: "DELETE" })).status,
    204,
  );
  assert.equal(
    (await app.request(`/api/clients/${client.id}`, { method: "DELETE" }))
      .status,
    204,
  );
});

test("invalid task format, date, status, and negative metrics never overwrite saved data", async (t) => {
  const app = await fixture(t);
  const invalidFields = [
    { format: "Formato inexistente" },
    { date: "2026-02-30" },
    { status: "status-inexistente" },
    { metrics: { reach: -1 } },
  ];
  for (const fields of invalidFields) {
    const response = await app.request("/api/tasks", {
      method: "POST",
      body: { title: "Não deve ser criada", ...fields },
    });
    assert.equal(response.status, 400);
  }
  assert.deepEqual((await app.request("/api/state")).body.tasks, []);

  const created = await app.request("/api/tasks", {
    method: "POST",
    body: { title: "Dados originais", metrics: { reach: 120 } },
  });
  assert.equal(created.status, 201);
  for (const fields of invalidFields) {
    const response = await app.request(`/api/tasks/${created.body.id}`, {
      method: "PATCH",
      body: { title: "Não deve ser alterada", ...fields },
    });
    assert.equal(response.status, 400);
    assert.deepEqual((await app.request("/api/state")).body.tasks, [
      created.body,
    ]);
  }
});

test("CSV imports reject all rows atomically when one metric is invalid", async (t) => {
  const app = await fixture(t);
  const response = await app.request("/api/import", {
    method: "POST",
    body: {
      source: "csv",
      csv: "title,client,date,channel,format,reach\nPost válido,Novo cliente,2026-10-19,Instagram,Reels,200\nPost inválido,Outro cliente,2026-10-20,Instagram,Reels,abc",
    },
  });
  assert.equal(response.status, 400);
  assert.ok(response.body.errors.length > 0);
  const state = (await app.request("/api/state")).body;
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.clients, []);
});

test("CSV imports parse quoted cells and skip duplicate posts on repeated import", async (t) => {
  const app = await fixture(t);
  const body = {
    source: "operand",
    csv: 'title,client,date,channel,format,reach,likes\n"Café, arte e \"\"histórias\"\"","Aurora, Café",2026-10-19,Instagram,Reels,1200,48',
  };
  const first = await app.request("/api/import", { method: "POST", body });
  assert.equal(first.status, 200);
  assert.equal(first.body.created, 1);
  assert.equal(first.body.skipped, 0);
  const second = await app.request("/api/import", { method: "POST", body });
  assert.equal(second.status, 200);
  assert.equal(second.body.created, 0);
  assert.equal(second.body.skipped, 1);

  const state = (await app.request("/api/state")).body;
  assert.equal(state.tasks.length, 1);
  assert.equal(state.clients.length, 1);
  assert.equal(state.tasks[0].title, 'Café, arte e "histórias"');
  assert.equal(state.clients[0].name, "Aurora, Café");
  await app.restart();
  assert.equal((await app.request("/api/state")).body.tasks.length, 1);
});

test("CSV byte limit allows JSON escaping overhead and rejects oversized UTF-8 without writes", async (t) => {
  const app = await fixture(t);
  const limit = 2 * 1024 * 1024;
  const valid = {
    source: "csv",
    csv: `title,padding\nImportação com aspas,"${'""'.repeat(550_000)}"`,
  };
  assert.ok(Buffer.byteLength(valid.csv, "utf8") < limit);
  assert.ok(Buffer.byteLength(JSON.stringify(valid), "utf8") > limit);
  const accepted = await app.request("/api/import", {
    method: "POST",
    body: valid,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.created, 1);
  const before = (await app.request("/api/state")).body;

  const oversized = `title,padding\nNão deve importar,${"é".repeat(1_050_000)}`;
  assert.ok(oversized.length < limit);
  assert.ok(Buffer.byteLength(oversized, "utf8") > limit);
  const rejected = await app.request("/api/import", {
    method: "POST",
    body: { source: "csv", csv: oversized },
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.error, /2 MB/);
  assert.deepEqual((await app.request("/api/state")).body, before);
});

test("new workspaces start empty without demo clients or activity", async (t) => {
  const app = await fixture(t);
  const state = (await app.request("/api/state")).body;
  for (const key of ["clients", "tasks", "checklist", "notes", "activities"])
    assert.deepEqual(state[key], []);
  assert.equal(state.meta.demo, false);
  await app.restart();
  assert.deepEqual((await app.request("/api/state")).body, state);
});

test("workspace reset requires confirmation, backs up all records, and never reseeds after restart", async (t) => {
  const app = await fixture(t, { seed: true });
  const before = (await app.request("/api/state")).body;
  assert.ok(
    before.clients.length > 0 &&
      before.tasks.length > 0 &&
      before.notes.length > 0,
  );
  assert.equal(before.meta.demo, true);
  for (const body of [{}, { confirmation: "limpar" }, { confirmation: true }]) {
    assert.equal(
      (await app.request("/api/workspace/reset", { method: "POST", body }))
        .status,
      400,
    );
  }
  assert.deepEqual((await app.request("/api/state")).body, before);
  assert.equal((await readdir(app.dataDir)).includes("backups"), false);
  const result = await app.request("/api/workspace/reset", {
    method: "POST",
    body: { confirmation: "LIMPAR" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.backupCreated, true);
  const [file] = await readdir(join(app.dataDir, "backups"));
  const backup = JSON.parse(
    await readFile(join(app.dataDir, "backups", file), "utf8"),
  );
  for (const key of [
    "clients",
    "tasks",
    "checklist",
    "notes",
    "activities",
    "meta",
  ])
    assert.deepEqual(backup[key], before[key]);
  const clean = (await app.request("/api/state")).body;
  for (const key of ["clients", "tasks", "checklist", "notes", "activities"])
    assert.deepEqual(clean[key], []);
  assert.equal(clean.meta.demo, false);
  await app.restart();
  assert.deepEqual((await app.request("/api/state")).body, clean);
  assert.equal(
    (
      await app.request("/api/clients", {
        method: "POST",
        body: { name: "Meu primeiro cliente real" },
      })
    ).status,
    201,
  );
  await app.restart();
  assert.equal((await app.request("/api/state")).body.clients.length, 1);
});

test("workspace reset preserves every record when its backup cannot be saved", async (t) => {
  const app = await fixture(t, { seed: true });
  const before = (await app.request("/api/state")).body;
  await writeFile(
    join(app.dataDir, "backups"),
    "This file deliberately prevents creating the backup directory.",
  );
  const result = await app.request("/api/workspace/reset", {
    method: "POST",
    body: { confirmation: "LIMPAR" },
  });
  assert.equal(result.status, 503);
  assert.match(result.body.error, /Nenhum dado foi removido/);
  assert.deepEqual((await app.request("/api/state")).body, before);
});
