import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLES = ["clients", "tasks", "checklist", "notes", "activities"];
const STATUSES = ["idea", "progress", "review", "scheduled", "published"];
const FORMATS = ["Carrossel", "Reels", "Post", "Story"];
const CHANNELS = ["Instagram", "LinkedIn", "TikTok", "Facebook"];
const COVERS = ["peach", "sage", "pink", "blue", "sand"];
const PRIORITIES = ["high", "medium", "low"];
const NOTE_COLORS = ["yellow", "pink", "green", "blue"];
const METRICS = ["reach", "impressions", "likes", "comments", "saves"];

export function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function failure(message, status = 400, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

function text(value, label, { required = false, max = 500 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw failure(`${label} é obrigatório.`);
    return "";
  }
  if (typeof value !== "string") throw failure(`${label} deve ser um texto.`);
  const result = value.trim();
  if (required && !result) throw failure(`${label} é obrigatório.`);
  if (result.length > max)
    throw failure(`${label} deve ter no máximo ${max} caracteres.`);
  return result;
}

function choose(value, values, label, fallback) {
  const result = value ?? fallback;
  if (!values.includes(result)) throw failure(`${label} inválido.`);
  return result;
}

function validDate(value) {
  const date = text(value, "Data", { required: true, max: 10 });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw failure("Data inválida. Use AAAA-MM-DD.");
  }
  return date;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function csvRows(csv) {
  if (typeof csv !== "string" || !csv.trim())
    throw failure("Envie o conteúdo CSV.");
  if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024)
    throw failure("O arquivo deve ter até 2 MB.");
  const input = csv.replace(/^\uFEFF/, "");
  let quoted = false;
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        index++;
        continue;
      }
      quoted = !quoted;
    }
    if (!quoted && (char === "\n" || char === "\r")) break;
    if (!quoted && Object.hasOwn(counts, char)) counts[char]++;
  }
  const delimiter = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a],
  )[0];
  const rows = [];
  let row = [],
    cell = "",
    inQuotes = false,
    afterQuote = false;
  const finishRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    if (rows.length > 1001)
      throw failure("Importe no máximo 1.000 demandas por vez.");
    row = [];
    cell = "";
    afterQuote = false;
  };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
        afterQuote = true;
      } else cell += char;
    } else if (char === '"') {
      if (cell.trim() !== "" || afterQuote)
        throw failure("CSV inválido: aspas fora de uma célula delimitada.");
      cell = "";
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      finishRow();
    } else {
      if (afterQuote && char.trim())
        throw failure("CSV inválido: conteúdo após o fechamento das aspas.");
      if (!afterQuote) cell += char;
    }
  }
  if (inQuotes)
    throw failure("CSV inválido: uma célula está com aspas abertas.");
  if (cell || row.length) finishRow();
  if (rows.length < 2)
    throw failure("O CSV precisa ter um cabeçalho e pelo menos uma demanda.");
  return rows;
}

const CSV_ALIASES = {
  title: ["title", "titulo", "demanda", "nome", "postagem", "publicacao"],
  client: ["client", "cliente", "conta"],
  date: [
    "date",
    "data",
    "data de publicacao",
    "data de postagem",
    "data agendada",
    "prazo",
    "deadline",
  ],
  time: ["time", "hora", "horario"],
  status: ["status", "situacao", "etapa"],
  format: ["format", "formato", "tipo"],
  channel: ["channel", "canal", "rede", "rede social", "plataforma"],
  description: ["description", "descricao", "legenda", "briefing"],
  assignee: ["assignee", "responsavel"],
  tags: ["tags", "etiquetas"],
  priority: ["priority", "prioridade"],
  reach: ["reach", "alcance"],
  impressions: ["impressions", "impressoes"],
  likes: ["likes", "curtidas"],
  comments: ["comments", "comentarios"],
  saves: ["saves", "salvamentos"],
};

function mappedValue(value, dictionary, label) {
  if (!value?.trim()) return undefined;
  const normalized = normalize(value).replace(/[_-]+/g, " ");
  const result = Object.entries(dictionary).find(([, aliases]) =>
    aliases.includes(normalized),
  );
  if (!result) throw failure(`${label} não reconhecido: ${value}.`);
  return result[0];
}

function importDate(value) {
  if (!value?.trim()) return day();
  const clean = value.trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return validDate(match ? `${match[3]}-${match[2]}-${match[1]}` : clean);
}

function importNumber(value, label) {
  if (!value?.trim()) return 0;
  const clean = value.trim().replace(/\s/g, "");
  let decimal = clean;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean))
    decimal = clean.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(clean)) decimal = clean.replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean))
    decimal = clean.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(decimal))
    throw failure(`${label} deve ser um número positivo.`);
  const number = Number(decimal);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER)
    throw failure(`${label} fora do limite.`);
  return number;
}

export function createApp({
  dataDir = process.env.DATA_DIR || path.join(ROOT, "data"),
  seed = true,
} = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "compasso.sqlite"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
  );
  const select = db.prepare(
    "SELECT data FROM entities WHERE kind = ? ORDER BY rowid",
  );
  const selectOne = db.prepare(
    "SELECT data FROM entities WHERE kind = ? AND id = ?",
  );
  const write = db.prepare(
    "INSERT INTO entities(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
  );
  const remove = db.prepare("DELETE FROM entities WHERE kind = ? AND id = ?");
  const all = (kind) => select.all(kind).map((row) => JSON.parse(row.data));
  const get = (kind, id) => {
    const row = selectOne.get(kind, id);
    return row ? JSON.parse(row.data) : null;
  };
  const put = (kind, entity) => {
    write.run(kind, entity.id, JSON.stringify(entity));
    return entity;
  };
  const activity = (message) => {
    put("activities", {
      id: randomUUID(),
      message,
      createdAt: new Date().toISOString(),
    });
    const rows = all("activities");
    for (const stale of rows.slice(0, Math.max(0, rows.length - 80)))
      remove.run("activities", stale.id);
  };

  function validate(kind, input, previous) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw failure("Envie um objeto JSON válido.");
    const value = { ...previous, ...input };
    const id = previous?.id ?? randomUUID();
    if (kind === "clients") {
      const name = text(value.name, "Nome do cliente", {
        required: true,
        max: 120,
      });
      const color = value.color ?? "#8b9d83";
      if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))
        throw failure("A cor deve usar o formato #RRGGBB.");
      const email = text(value.email, "E-mail", { max: 200 });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw failure("E-mail inválido.");
      if (
        all("clients").some(
          (client) =>
            client.id !== id && normalize(client.name) === normalize(name),
        )
      )
        throw failure("Já existe um cliente com esse nome.", 409);
      return {
        id,
        name,
        color,
        initials: text(
          value.initials ||
            name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase(),
          "Iniciais",
          { max: 4 },
        ),
        segment: text(value.segment, "Segmento", { max: 120 }),
        contact: text(value.contact, "Contato", { max: 200 }),
        email,
      };
    }
    if (kind === "tasks") {
      const clientId = text(value.clientId, "Cliente", { max: 100 });
      if (clientId && !get("clients", clientId))
        throw failure("Cliente não encontrado.");
      const time = text(value.time ?? "10:00", "Horário", { max: 5 });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        throw failure("Horário inválido. Use HH:MM.");
      const tags = value.tags ?? [];
      if (
        !Array.isArray(tags) ||
        tags.length > 15 ||
        tags.some((tag) => typeof tag !== "string" || tag.trim().length > 40)
      )
        throw failure("Use até 15 etiquetas, com até 40 caracteres cada.");
      if (
        input.metrics !== undefined &&
        (!input.metrics ||
          typeof input.metrics !== "object" ||
          Array.isArray(input.metrics))
      )
        throw failure("Métricas inválidas.");
      const metrics = Object.fromEntries(
        METRICS.map((key) => [
          key,
          Object.hasOwn(input.metrics ?? {}, key)
            ? input.metrics[key]
            : (previous?.metrics?.[key] ?? 0),
        ]),
      );
      for (const key of METRICS)
        if (
          typeof metrics[key] !== "number" ||
          !Number.isFinite(metrics[key]) ||
          metrics[key] < 0 ||
          metrics[key] > Number.MAX_SAFE_INTEGER
        )
          throw failure(`Métrica ${key} deve ser um número positivo.`);
      return {
        id,
        title: text(value.title, "Título", { required: true, max: 250 }),
        clientId,
        status: choose(value.status, STATUSES, "Status", "idea"),
        format: choose(value.format, FORMATS, "Formato", "Post"),
        channel: choose(value.channel, CHANNELS, "Canal", "Instagram"),
        date: validDate(value.date ?? day()),
        time,
        priority: choose(value.priority, PRIORITIES, "Prioridade", "medium"),
        assignee: text(value.assignee ?? "Você", "Responsável", { max: 100 }),
        description: text(value.description, "Descrição", { max: 12000 }),
        tags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))],
        metrics: Object.fromEntries(METRICS.map((key) => [key, metrics[key]])),
        cover: choose(value.cover, COVERS, "Capa", "sage"),
        createdAt: previous?.createdAt ?? new Date().toISOString(),
      };
    }
    if (kind === "checklist") {
      if (value.done !== undefined && typeof value.done !== "boolean")
        throw failure("O campo concluído deve ser verdadeiro ou falso.");
      return {
        id,
        title: text(value.title, "Título", { required: true, max: 250 }),
        done: value.done ?? false,
        date: validDate(value.date ?? day()),
      };
    }
    if (kind === "notes") {
      const clientId = text(value.clientId, "Cliente", { max: 100 });
      if (clientId && !get("clients", clientId))
        throw failure("Cliente não encontrado.");
      return {
        id,
        title: text(value.title, "Título", { required: true, max: 200 }),
        content: text(value.content, "Anotação", { max: 20000 }),
        color: choose(value.color, NOTE_COLORS, "Cor", "yellow"),
        clientId,
        updatedAt: new Date().toISOString(),
      };
    }
    throw failure("Recurso não encontrado.", 404);
  }

  const state = () => ({
    ...Object.fromEntries(TABLES.map((kind) => [kind, all(kind)])),
    meta: {
      demo:
        db.prepare("SELECT value FROM metadata WHERE key = ?").get("demo")
          ?.value === "true",
    },
  });
  if (
    seed &&
    !db.prepare("SELECT value FROM metadata WHERE key = ?").get("initialized")
  ) {
    db.exec("BEGIN");
    try {
      seedData(put);
      db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)").run(
        "demo",
        "true",
      );
      db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)").run(
        "initialized",
        "true",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }

  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    next();
  });
  // CSV files are limited separately by their actual UTF-8 bytes. The JSON
  // envelope needs room for escaped quotes, newlines and other characters.
  app.use("/api", express.json({ limit: "8mb" }));
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, app: "Compasso Social", storage: "sqlite" }),
  );
  app.get("/api/state", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(state());
  });
  app.get("/api/backup", (req, res) => {
    res.set(
      "Content-Disposition",
      `attachment; filename="compasso-backup-${day()}.json"`,
    );
    res.set("Cache-Control", "no-store");
    res.json({ version: 1, exportedAt: new Date().toISOString(), ...state() });
  });

  for (const kind of ["clients", "tasks", "checklist", "notes"]) {
    app.post(`/api/${kind}`, (req, res) => {
      const entity = validate(kind, req.body);
      put(kind, entity);
      activity(
        `${kind === "clients" ? "Cliente adicionado" : kind === "tasks" ? "Demanda criada" : kind === "checklist" ? "Item adicionado ao checklist" : "Anotação criada"}: ${entity.title ?? entity.name}`,
      );
      res.status(201).json(entity);
    });
    app.patch(`/api/${kind}/:id`, (req, res) => {
      const previous = get(kind, req.params.id);
      if (!previous) throw failure("Registro não encontrado.", 404);
      const entity = validate(kind, req.body, previous);
      put(kind, entity);
      activity(
        `${kind === "tasks" && entity.status === "published" && previous.status !== "published" ? "Postagem publicada" : kind === "checklist" && entity.done && !previous.done ? "Checklist concluído" : "Atualização salva"}: ${entity.title ?? entity.name}`,
      );
      res.json(entity);
    });
    app.delete(`/api/${kind}/:id`, (req, res) => {
      const previous = get(kind, req.params.id);
      if (!previous) throw failure("Registro não encontrado.", 404);
      if (
        kind === "clients" &&
        (all("tasks").some((task) => task.clientId === previous.id) ||
          all("notes").some((note) => note.clientId === previous.id))
      )
        throw failure(
          "Este cliente tem demandas ou anotações vinculadas. Reatribua ou exclua os registros primeiro.",
          409,
        );
      db.exec("BEGIN");
      try {
        remove.run(kind, previous.id);
        activity(`Registro removido: ${previous.title ?? previous.name}`);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      res.status(204).end();
    });
  }

  app.post("/api/import", (req, res) => {
    const source = choose(
      req.body?.source,
      ["aprova", "operand", "csv"],
      "Origem",
      "csv",
    );
    const rows = csvRows(req.body?.csv);
    const headers = rows[0].map((header) =>
      normalize(header).replace(/[_-]+/g, " "),
    );
    if (new Set(headers).size !== headers.length)
      throw failure("O CSV tem colunas duplicadas.");
    const mapping = Object.fromEntries(
      Object.entries(CSV_ALIASES).map(([key, aliases]) => [
        key,
        headers.findIndex((header) => aliases.includes(header)),
      ]),
    );
    if (mapping.title < 0)
      throw failure("O CSV precisa de uma coluna title, título ou demanda.");
    const errors = [],
      prepared = [];
    for (let index = 1; index < rows.length; index++) {
      try {
        const row = rows[index];
        if (row.length !== headers.length)
          throw failure(
            `Esperadas ${headers.length} colunas; recebidas ${row.length}.`,
          );
        const value = (key) => (mapping[key] < 0 ? "" : row[mapping[key]]);
        const clientName = text(value("client"), "Cliente", { max: 120 });
        const draft = {
          title: text(value("title"), "Título", { required: true, max: 250 }),
          clientId: "",
          date: importDate(value("date")),
          time: value("time").trim() || "10:00",
          status: mappedValue(
            value("status"),
            {
              idea: [
                "idea",
                "ideia",
                "ideias",
                "backlog",
                "a fazer",
                "planejado",
              ],
              progress: [
                "progress",
                "em andamento",
                "em producao",
                "producao",
                "andamento",
                "in progress",
              ],
              review: [
                "review",
                "em revisao",
                "revisao",
                "aprovacao",
                "em aprovacao",
                "aguardando aprovacao",
                "pending",
              ],
              scheduled: [
                "scheduled",
                "agendado",
                "agendada",
                "programado",
                "programada",
                "aprovado",
                "aprovada",
              ],
              published: [
                "published",
                "publicado",
                "publicada",
                "concluido",
                "concluida",
                "done",
              ],
            },
            "Status",
          ),
          format: mappedValue(
            value("format"),
            {
              Carrossel: ["carrossel", "carousel"],
              Reels: ["reels", "reel", "video"],
              Post: ["post", "imagem", "estatico", "feed"],
              Story: ["story", "stories"],
            },
            "Formato",
          ),
          channel: mappedValue(
            value("channel"),
            {
              Instagram: ["instagram", "ig"],
              LinkedIn: ["linkedin"],
              TikTok: ["tiktok", "tik tok"],
              Facebook: ["facebook", "fb"],
            },
            "Canal",
          ),
          priority: mappedValue(
            value("priority"),
            {
              high: ["high", "alta", "alto", "urgente"],
              medium: ["medium", "media", "medio", "normal"],
              low: ["low", "baixa", "baixo"],
            },
            "Prioridade",
          ),
          description: value("description"),
          assignee: value("assignee").trim() || "Você",
          tags: value("tags")
            .split(/[|;]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          metrics: Object.fromEntries(
            METRICS.map((key) => [key, importNumber(value(key), key)]),
          ),
        };
        const task = validate("tasks", draft);
        prepared.push({ clientName, task });
      } catch (error) {
        errors.push({ row: index + 1, message: error.message });
      }
    }
    if (errors.length)
      throw failure(
        "Nenhuma demanda foi importada. Corrija as linhas indicadas.",
        400,
        { errors },
      );
    const clients = all("clients");
    const fingerprint = (task, name) =>
      createHash("sha256")
        .update(
          JSON.stringify([
            normalize(task.title),
            normalize(name),
            task.date,
            task.channel,
            task.format,
          ]),
        )
        .digest("hex");
    const fingerprints = new Set(
      all("tasks").map((task) =>
        fingerprint(
          task,
          clients.find((client) => client.id === task.clientId)?.name ?? "",
        ),
      ),
    );
    let created = 0,
      skipped = 0;
    db.exec("BEGIN");
    try {
      for (const { clientName, task } of prepared) {
        const key = fingerprint(task, clientName);
        if (fingerprints.has(key)) {
          skipped++;
          continue;
        }
        if (clientName) {
          let client = clients.find(
            (existing) => normalize(existing.name) === normalize(clientName),
          );
          if (!client) {
            client = validate("clients", { name: clientName });
            put("clients", client);
            clients.push(client);
          }
          task.clientId = client.id;
        }
        put("tasks", task);
        fingerprints.add(key);
        created++;
      }
      if (created)
        activity(
          `${created} demanda${created === 1 ? "" : "s"} importada${created === 1 ? "" : "s"} de ${source === "aprova" ? "Aprova Aí (CSV)" : source === "operand" ? "Operand (CSV)" : "arquivo CSV"}`,
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.json({ created, skipped, errors: [] });
  });

  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Rota da API não encontrada." }),
  );
  app.use((error, req, res, next) => {
    const status =
      error.type === "entity.too.large"
        ? 413
        : error.type === "entity.parse.failed"
          ? 400
          : error.status || 500;
    const message =
      status === 413
        ? "O envio JSON deve ter até 8 MB; arquivos CSV devem ter até 2 MB."
        : error.type === "entity.parse.failed"
          ? "JSON inválido."
          : status >= 500
            ? "Não foi possível concluir a operação."
            : error.message;
    if (status >= 500) console.error(error);
    res
      .status(status)
      .json({
        error: message,
        ...(error.errors ? { errors: error.errors } : {}),
      });
  });
  return { app, db, close: () => db.close() };
}

function seedData(put) {
  const clients = [
    {
      id: "bloom",
      name: "Studio Bloom",
      initials: "SB",
      color: "#B6C5AA",
      segment: "Beleza & bem-estar",
      contact: "Marina Costa",
      email: "marina@example.com",
    },
    {
      id: "aurora",
      name: "Café Aurora",
      initials: "CA",
      color: "#D8B49B",
      segment: "Gastronomia",
      contact: "Lucas Pereira",
      email: "lucas@example.com",
    },
    {
      id: "maison",
      name: "Maison",
      initials: "M",
      color: "#D1B7C6",
      segment: "Moda & lifestyle",
      contact: "Clara Dias",
      email: "clara@example.com",
    },
    {
      id: "vertice",
      name: "Vértice",
      initials: "V",
      color: "#AABDD0",
      segment: "Arquitetura",
      contact: "Pedro Alves",
      email: "pedro@example.com",
    },
    {
      id: "verde",
      name: "Verde Vivo",
      initials: "VV",
      color: "#B8C5A3",
      segment: "Sustentabilidade",
      contact: "Ana Lima",
      email: "ana@example.com",
    },
  ];
  clients.forEach((client) => put("clients", client));
  const definitions = [
    [
      "O seu momento de florescer",
      "bloom",
      "published",
      "Carrossel",
      -7,
      "sage",
      ["branding", "autocuidado"],
    ],
    [
      "Café bom é café compartilhado",
      "aurora",
      "published",
      "Reels",
      -6,
      "peach",
      ["bastidores", "comunidade"],
    ],
    [
      "Essenciais para dias leves",
      "maison",
      "published",
      "Carrossel",
      -5,
      "pink",
      ["coleção", "lifestyle"],
    ],
    [
      "Espaços que contam histórias",
      "vertice",
      "published",
      "Post",
      -4,
      "blue",
      ["portfólio", "arquitetura"],
    ],
    [
      "Pequenas escolhas, grandes mudanças",
      "verde",
      "published",
      "Reels",
      -3,
      "sage",
      ["sustentabilidade", "educativo"],
    ],
    [
      "Um café, muitas possibilidades",
      "aurora",
      "published",
      "Carrossel",
      -2,
      "sand",
      ["produto", "cafeteria"],
    ],
    [
      "Ritual de cuidado da manhã",
      "bloom",
      "published",
      "Story",
      -1,
      "sage",
      ["dicas", "autocuidado"],
    ],
    [
      "5 cuidados para uma pele radiante",
      "bloom",
      "progress",
      "Carrossel",
      0,
      "sage",
      ["educativo", "skincare"],
    ],
    [
      "O café perfeito começa aqui",
      "aurora",
      "review",
      "Reels",
      0,
      "peach",
      ["bastidores", "produto"],
    ],
    [
      "Nova coleção: menos é mais",
      "maison",
      "scheduled",
      "Carrossel",
      0,
      "pink",
      ["lançamento", "coleção"],
    ],
    [
      "Por dentro do projeto Horizonte",
      "vertice",
      "progress",
      "Reels",
      1,
      "blue",
      ["portfólio", "bastidores"],
    ],
    [
      "3 formas de cultivar novos hábitos",
      "verde",
      "scheduled",
      "Carrossel",
      1,
      "sage",
      ["educativo", "sustentabilidade"],
    ],
    [
      "Pausa para respirar e florescer",
      "bloom",
      "review",
      "Post",
      2,
      "sand",
      ["bem-estar", "branding"],
    ],
    [
      "Sábado tem novidade no cardápio",
      "aurora",
      "scheduled",
      "Story",
      2,
      "peach",
      ["novidade", "gastronomia"],
    ],
    [
      "Uma peça, três combinações",
      "maison",
      "idea",
      "Reels",
      3,
      "pink",
      ["styling", "inspiração"],
    ],
    [
      "Materiais naturais, histórias reais",
      "vertice",
      "review",
      "Carrossel",
      3,
      "blue",
      ["materiais", "inspiração"],
    ],
    [
      "O futuro floresce nas nossas escolhas",
      "verde",
      "progress",
      "Post",
      4,
      "sage",
      ["campanha", "comunidade"],
    ],
    [
      "Conheça quem cuida de você",
      "bloom",
      "idea",
      "Reels",
      5,
      "sand",
      ["equipe", "bastidores"],
    ],
    [
      "Seu próximo café favorito",
      "aurora",
      "idea",
      "Post",
      6,
      "peach",
      ["produto", "cafeteria"],
    ],
    [
      "Detalhes que fazem a diferença",
      "maison",
      "scheduled",
      "Story",
      7,
      "pink",
      ["detalhes", "coleção"],
    ],
    [
      "Design com propósito",
      "vertice",
      "idea",
      "Post",
      8,
      "blue",
      ["branding", "arquitetura"],
    ],
  ];
  definitions.forEach(
    ([title, clientId, status, format, offset, cover, tags], index) => {
      const published = status === "published";
      put("tasks", {
        id: `task-${index + 1}`,
        title,
        clientId,
        status,
        format,
        channel:
          clientId === "vertice" && index % 2 === 1 ? "LinkedIn" : "Instagram",
        date: day(offset),
        time: ["09:00", "10:30", "14:00", "16:00", "18:30"][index % 5],
        priority:
          index === 7 || index === 8
            ? "high"
            : index % 4 === 0
              ? "low"
              : "medium",
        assignee: ["Você", "Beatriz", "Rafael"][index % 3],
        description: [
          "Criar uma narrativa visual acolhedora que conecte a marca às pessoas. Usar referências naturais e destacar os detalhes.",
          "Mostrar os bastidores com autenticidade. Encerrar com uma pergunta para incentivar a conversa.",
          "Conteúdo educativo com linguagem simples. Incluir uma chamada para salvar e compartilhar.",
        ][index % 3],
        tags,
        metrics: published
          ? {
              reach: 3200 + index * 870,
              impressions: 4800 + index * 1050,
              likes: 230 + index * 41,
              comments: 12 + index * 5,
              saves: 38 + index * 11,
            }
          : { reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0 },
        cover,
        createdAt: new Date(
          Date.now() - (10 - offset) * 86400000,
        ).toISOString(),
      });
    },
  );
  [
    "Conferir mensagens e comentários",
    "Revisar o calendário da semana",
    "Enviar conteúdos para aprovação",
    "Agendar os posts de amanhã",
    "Acompanhar métricas das publicações",
    "Organizar referências e novas ideias",
  ].forEach((title, index) =>
    put("checklist", {
      id: `check-${index + 1}`,
      title,
      done: index < 2,
      date: day(),
    }),
  );
  [
    [
      "Ideias que merecem florescer",
      "Série de conteúdos sobre pequenos rituais de autocuidado.\n\n→ Trazer histórias reais de clientes\n→ Explorar luz natural e tons suaves\n→ Pergunta: qual é o seu momento de pausa?",
      "yellow",
      "bloom",
    ],
    [
      "Alinhamento · Café Aurora",
      "A próxima campanha valoriza os produtores locais. Pedir fotos da fazenda e preparar um roteiro para os bastidores.\n\nTom de voz: próximo, leve e convidativo.",
      "pink",
      "aurora",
    ],
    [
      "Referências da semana",
      "Mais gente, menos pose.\n\nTestar carrosséis com fotos espontâneas e tipografia limpa. Conteúdos que ajudam de verdade merecem um lugar no calendário.",
      "green",
      "",
    ],
    [
      "Checklist de uma boa legenda",
      "Uma primeira frase que prende a atenção.\nUma ideia central bem desenvolvida.\nUma chamada para ação que faz sentido.\n\nRevisar sempre antes de enviar para aprovação.",
      "blue",
      "",
    ],
  ].forEach(([title, content, color, clientId], index) =>
    put("notes", {
      id: `note-${index + 1}`,
      title,
      content,
      color,
      clientId,
      updatedAt: new Date(Date.now() - index * 3600000).toISOString(),
    }),
  );
  [
    "Ritual de cuidado da manhã foi publicado para Studio Bloom",
    "Nova coleção: menos é mais foi agendado para Maison",
    "O café perfeito começa aqui foi enviado para aprovação",
    "Revisar o calendário da semana foi concluído",
    "Uma nova ideia foi adicionada para Verde Vivo",
  ].forEach((message, index) =>
    put("activities", {
      id: `activity-${index + 1}`,
      message,
      createdAt: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
    }),
  );
}
