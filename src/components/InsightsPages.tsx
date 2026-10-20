import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  FileSpreadsheet,
  Link2,
  LoaderCircle,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { State, Task } from "../types";
import {
  api,
  csvCell,
  download,
  formatDate,
  number,
  offsetDate,
  today,
} from "../lib";
import "./insights.css";

type Props = {
  state: State;
  onRefresh: () => Promise<void>;
  notify: (message: string) => void;
};
type Source = "aprova" | "operand" | "csv";
const headers = [
  "title",
  "client",
  "date",
  "status",
  "format",
  "channel",
  "reach",
  "impressions",
  "likes",
  "comments",
  "saves",
];
const sourceNames: Record<Source, string> = {
  aprova: "Aprova Aí",
  operand: "Operand",
  csv: "Planilha CSV",
};
const interactions = (task: Task) =>
  task.metrics.likes + task.metrics.comments + task.metrics.saves;
const percentage = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function ReportsPage({ state, notify }: Props) {
  const [period, setPeriod] = useState("30");
  const [client, setClient] = useState("all");
  const selected = state.tasks.filter(
    (task) =>
      task.status === "published" &&
      (client === "all" || task.clientId === client) &&
      (period === "all" ||
        (task.date >= offsetDate(today(), -(Number(period) - 1)) &&
          task.date <= today())),
  );
  const reach = selected.reduce((sum, task) => sum + task.metrics.reach, 0);
  const impressions = selected.reduce(
    (sum, task) => sum + task.metrics.impressions,
    0,
  );
  const engagement = selected.reduce(
    (sum, task) => sum + interactions(task),
    0,
  );
  const rate = reach > 0 ? (engagement / reach) * 100 : 0;
  const formats = [
    ...new Set([
      "Post",
      "Reels",
      "Carrossel",
      "Story",
      ...selected.map((task) => task.format),
    ]),
  ];
  const groups = formats.map((format) => ({
    format,
    reach: selected
      .filter((task) => task.format === format)
      .reduce((sum, task) => sum + task.metrics.reach, 0),
    count: selected.filter((task) => task.format === format).length,
  }));
  const maxReach = Math.max(1, ...groups.map((group) => group.reach));
  const bestPosts = [...selected]
    .sort(
      (a, b) =>
        b.metrics.reach - a.metrics.reach || interactions(b) - interactions(a),
    )
    .slice(0, 5);
  function exportReport() {
    const rows = selected.map((task) => [
      task.title,
      state.clients.find((c) => c.id === task.clientId)?.name || "Sem cliente",
      task.date,
      task.status,
      task.format,
      task.channel,
      task.metrics.reach,
      task.metrics.impressions,
      task.metrics.likes,
      task.metrics.comments,
      task.metrics.saves,
    ]);
    download(
      `compasso-relatorio-${today()}.csv`,
      "\uFEFF" +
        [headers, ...rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
    );
    notify("Relatório CSV exportado.");
  }
  return (
    <div className="insight-page">
      <div className="page-heading insight-heading">
        <div>
          <h1>Relatórios</h1>
          <p className="subtitle">Transforme resultados em próximos passos.</p>
        </div>
        <div className="insight-actions">
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
          <button className="button primary" onClick={exportReport}>
            <Download size={16} /> Exportar relatório
          </button>
        </div>
      </div>
      <div className="insight-toolbar">
        <div className="insight-period" aria-label="Período do relatório">
          {[
            ["7", "7 dias"],
            ["30", "30 dias"],
            ["all", "Todo o período"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "active" : ""}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="insight-client-filter">
          <Users size={15} />
          <select
            aria-label="Filtrar relatórios por cliente"
            value={client}
            onChange={(event) => setClient(event.target.value)}
          >
            <option value="all">Todos os clientes</option>
            {state.clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="insight-data-note">
        <CircleHelp size={15} />
        <span>
          {state.meta.demo ? "Dados de demonstração. " : ""}Métricas informadas
          ou importadas, considerando somente publicações concluídas no período.
        </span>
      </div>
      <div className="insight-kpis">
        <Metric
          icon={<Check size={19} />}
          label="Publicações"
          value={number(selected.length)}
          detail="Conteúdos publicados"
        />
        <Metric
          icon={<Users size={19} />}
          label="Alcance informado"
          value={number(reach)}
          detail="Soma do alcance das postagens"
        />
        <Metric
          icon={<MessageCircle size={19} />}
          label="Engajamento"
          value={percentage(rate)}
          detail="Interações ÷ alcance × 100"
        />
        <Metric
          icon={<BarChart3 size={19} />}
          label="Impressões"
          value={number(impressions)}
          detail="Exibições dos conteúdos"
        />
      </div>
      <div className="insight-report-grid">
        <section className="panel insight-chart-panel">
          <div className="insight-panel-heading">
            <div>
              <h2>Um olhar para os formatos</h2>
              <p>Alcance acumulado por tipo de conteúdo</p>
            </div>
            <span className="insight-icon">
              <BarChart3 size={19} />
            </span>
          </div>
          <div
            className="insight-chart"
            role="img"
            aria-label={`Alcance por formato: ${groups.map((group) => `${group.format}: ${group.reach}`).join("; ")}`}
          >
            {groups.map((group, index) => (
              <div key={group.format} className="insight-bar-column">
                <strong>{number(group.reach)}</strong>
                <div className="insight-bar-track">
                  <div
                    className={`insight-bar insight-bar-${index % 4}`}
                    style={{
                      height: `${(group.reach / maxReach) * 100}%`,
                      minHeight: group.reach ? 5 : 0,
                    }}
                  />
                </div>
                <span>{group.format}</span>
              </div>
            ))}
          </div>
          <div className="insight-chart-foot">
            <span>
              <i /> Alcance informado
            </span>
            <span>{selected.length} publicações no período</span>
          </div>
        </section>
        <section className="panel insight-summary-panel">
          <div className="insight-panel-heading">
            <div>
              <h2>Os números conversam</h2>
              <p>O que a sua comunidade fez</p>
            </div>
            <Sparkles size={19} />
          </div>
          <div className="insight-interactions">
            <span>Total de interações</span>
            <strong>{number(engagement)}</strong>
          </div>
          <div className="insight-breakdown">
            {[
              [
                "Curtidas",
                selected.reduce((sum, task) => sum + task.metrics.likes, 0),
              ],
              [
                "Comentários",
                selected.reduce((sum, task) => sum + task.metrics.comments, 0),
              ],
              [
                "Salvamentos",
                selected.reduce((sum, task) => sum + task.metrics.saves, 0),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{number(Number(value))}</strong>
              </div>
            ))}
          </div>
          <p className="insight-summary-note">
            Observe os formatos que geram conversas e leve esses aprendizados
            para o próximo planejamento.
          </p>
        </section>
      </div>
      <section className="panel insight-post-panel">
        <div className="insight-panel-heading">
          <div>
            <h2>Conteúdos que se destacaram</h2>
            <p>As 5 publicações com maior alcance informado</p>
          </div>
          <span className="badge">{selected.length} publicações</span>
        </div>
        {bestPosts.length ? (
          <div className="insight-table-wrap">
            <table className="insight-table">
              <thead>
                <tr>
                  <th>Publicação</th>
                  <th>Formato</th>
                  <th>Alcance</th>
                  <th>Interações</th>
                  <th>Engajamento</th>
                </tr>
              </thead>
              <tbody>
                {bestPosts.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      <span>
                        {state.clients.find((c) => c.id === task.clientId)
                          ?.name || "Sem cliente"}{" "}
                        · {formatDate(task.date)}
                      </span>
                    </td>
                    <td>
                      <span className="insight-format">{task.format}</span>
                    </td>
                    <td>{number(task.metrics.reach)}</td>
                    <td>{number(interactions(task))}</td>
                    <td>
                      {percentage(
                        task.metrics.reach
                          ? (interactions(task) / task.metrics.reach) * 100
                          : 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state insight-empty">
            <BarChart3 size={28} />
            <h3>Os próximos resultados começam aqui</h3>
            <p>
              Marque uma demanda como publicada e informe as métricas para
              acompanhar o desempenho.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="panel insight-metric">
      <div className="insight-metric-top">
        <span>{label}</span>
        <span className="insight-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function IntegrationsPage({ state, onRefresh, notify }: Props) {
  const [source, setSource] = useState<Source | null>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileRead = useRef(0);
  function openSource(value: Source) {
    fileRead.current++;
    setSource(value);
    setCsv("");
    setFileName("");
    setError("");
    setResult(null);
  }
  async function chooseFile(file?: File) {
    if (!file) return;
    const readId = ++fileRead.current;
    setError("");
    setCsv("");
    setFileName("");
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Escolha um arquivo .csv no modelo indicado.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      if (readId !== fileRead.current) return;
      if (!text.trim()) {
        setError("O arquivo está vazio. Escolha uma planilha com dados.");
        return;
      }
      setCsv(text);
      setFileName(file.name);
    } catch {
      if (readId === fileRead.current)
        setError("Não foi possível ler esse arquivo. Tente novamente.");
    }
  }
  async function importCsv() {
    if (!source || !csv || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<{ created: number; skipped: number }>(
        "/import",
        "POST",
        { csv, source },
      );
      setResult(response);
      setCsv("");
      setFileName("");
      await onRefresh();
      notify(`${response.created} demandas importadas com sucesso.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível importar a planilha.",
      );
    } finally {
      setBusy(false);
    }
  }
  function template() {
    download(
      "compasso-modelo-importacao.csv",
      "\uFEFF" +
        [
          headers,
          [
            "Exemplo de conteúdo",
            "Nome do cliente",
            today(),
            "idea",
            "Post",
            "Instagram",
            0,
            0,
            0,
            0,
            0,
          ],
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
    );
  }
  async function backup() {
    setBackupBusy(true);
    try {
      const data = await api<unknown>("/backup");
      download(
        `compasso-backup-${today()}.json`,
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8",
      );
      notify("Backup JSON exportado.");
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Não foi possível exportar o backup.",
      );
    } finally {
      setBackupBusy(false);
    }
  }
  return (
    <div className="insight-page">
      <div className="page-heading insight-heading">
        <div>
          <h1>Integrações</h1>
          <p className="subtitle">
            Tudo no mesmo compasso, com o controle nas suas mãos.
          </p>
        </div>
        <button className="button secondary" onClick={template}>
          <ArrowDownToLine size={16} /> Baixar modelo CSV
        </button>
      </div>
      <section className="insight-integration-banner">
        <span className="insight-banner-icon">
          <Link2 size={25} />
        </span>
        <div>
          <h2>Conecte a sua rotina. Simplifique o seu olhar.</h2>
          <p>
            Reúna demandas e resultados em uma planilha padronizada e importe
            para o Compasso.
          </p>
        </div>
        <span className="insight-banner-decoration" aria-hidden="true">
          ↗
        </span>
      </section>
      <div className="insight-integration-cards">
        {(
          [
            {
              key: "aprova",
              letter: "a",
              name: "Aprova Aí",
              description:
                "Traga para o seu planejamento as demandas que você organiza no Aprova Aí.",
              color: "peach",
            },
            {
              key: "operand",
              letter: "o",
              name: "Operand",
              description:
                "Centralize demandas e resultados de projetos que você acompanha no Operand.",
              color: "purple",
            },
          ] as const
        ).map((item) => (
          <article className="panel insight-integration-card" key={item.key}>
            <div className="insight-integration-card-top">
              <span className={`insight-app-logo ${item.color}`}>
                {item.letter}
                <span>·</span>
              </span>
              <span className="insight-manual-badge">Importação manual</span>
            </div>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="insight-integration-caption">
              <FileSpreadsheet size={15} />
              <span>CSV adaptado ao modelo Compasso</span>
            </div>
            <button
              className="button secondary"
              onClick={() => openSource(item.key)}
            >
              Importar planilha <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
        <article className="panel insight-integration-card">
          <div className="insight-integration-card-top">
            <span className="insight-app-logo green">
              <FileSpreadsheet size={27} />
            </span>
            <span className="insight-manual-badge">Importação manual</span>
          </div>
          <h2>Sua planilha</h2>
          <p>
            Do seu jeito de trabalhar para uma visão organizada. Traga conteúdos
            e métricas em CSV.
          </p>
          <div className="insight-integration-caption">
            <FileSpreadsheet size={15} />
            <span>Modelo simples, sem contas externas</span>
          </div>
          <button
            className="button secondary"
            onClick={() => openSource("csv")}
          >
            Importar CSV <ArrowUpRight size={16} />
          </button>
        </article>
      </div>
      {source && (
        <section
          className="panel insight-import-panel"
          aria-label={`Importar ${sourceNames[source]}`}
        >
          <div className="insight-panel-heading">
            <div>
              <h2>Importar · {sourceNames[source]}</h2>
              <p>Revise o arquivo antes de adicionar as demandas.</p>
            </div>
            <button
              className="insight-close"
              aria-label="Fechar importação"
              disabled={busy}
              onClick={() => {
                fileRead.current++;
                setSource(null);
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="insight-import-content">
            <div className="insight-dropzone">
              <Upload size={25} />
              <strong>Escolha sua planilha CSV</strong>
              <span>
                UTF-8 · separador vírgula ou ponto e vírgula · até 2 MB
              </span>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                aria-label="Selecionar arquivo CSV"
                disabled={busy}
                onChange={(event) => {
                  void chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Selecionar arquivo
              </button>
            </div>
            <div className="insight-import-guidance">
              <h3>Prepare antes de importar</h3>
              <p>
                Use os campos do modelo: título, cliente, data, status, formato,
                canal e métricas. O CSV da plataforma de origem pode precisar de
                adaptação.
              </p>
              <p>
                Estados: <code>idea</code>, <code>progress</code>,{" "}
                <code>review</code>, <code>scheduled</code> ou{" "}
                <code>published</code>. Datas: <code>AAAA-MM-DD</code>.
              </p>
              <button className="insight-text-button" onClick={template}>
                Baixar modelo <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {csv && (
            <div className="insight-preview">
              <div>
                <strong>{fileName}</strong>
                <span>Prévia das primeiras 4 linhas</span>
              </div>
              <pre>{csv.split(/\r?\n/).slice(0, 4).join("\n")}</pre>
              <button
                className="button primary"
                onClick={() => void importCsv()}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="insight-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                {busy ? "Importando…" : "Confirmar importação"}
              </button>
            </div>
          )}
          {error && (
            <p className="insight-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="insight-success" role="status">
              <Check size={18} />
              <span>
                <strong>{result.created} demandas criadas.</strong>{" "}
                {result.skipped} linhas ignoradas. Confira as demandas e os
                resultados nos relatórios.
              </span>
            </div>
          )}
        </section>
      )}
      <div className="insight-integration-bottom">
        <section className="panel insight-how-panel">
          <div className="insight-panel-heading">
            <div>
              <h2>Três passos, uma rotina mais leve</h2>
              <p>Seus dados, do jeito que você precisa.</p>
            </div>
            <CircleHelp size={19} />
          </div>
          <ol>
            {[
              ["Prepare", "Baixe o modelo e adapte os dados da sua planilha."],
              [
                "Importe",
                "Escolha o arquivo, confira a prévia e confirme a importação.",
              ],
              [
                "Acompanhe",
                "Encontre as demandas na agenda e as métricas nos relatórios.",
              ],
            ].map(([title, description], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel insight-backup-panel">
          <span className="insight-icon">
            <Database size={22} />
          </span>
          <h2>Uma cópia para chamar de sua</h2>
          <p>
            Exporte clientes, demandas, checklists e anotações em um arquivo
            JSON para guardar uma cópia dos seus dados.
          </p>
          <span className="insight-backup-count">
            {state.tasks.length} demandas · {state.clients.length} clientes
          </span>
          <button
            className="button secondary"
            onClick={() => void backup()}
            disabled={backupBusy}
          >
            {backupBusy ? (
              <LoaderCircle className="insight-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {backupBusy ? "Exportando…" : "Exportar backup JSON"}
          </button>
        </section>
      </div>
      <div className="insight-safety-note">
        <ShieldCheck size={20} />
        <p>
          As integrações são manuais: não há sincronização automática,
          publicação em redes sociais ou armazenamento de credenciais externas.
          A disponibilidade de APIs e exportações nativas do Aprova Aí e do
          Operand ainda precisa ser confirmada na documentação oficial.
        </p>
      </div>
    </div>
  );
}
