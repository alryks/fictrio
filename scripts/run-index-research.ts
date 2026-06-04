import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { PrismaClient } from "../apps/api/node_modules/@prisma/client";

type QueryKind = "search" | "filter";

type Config = {
  runs: number;
  warmups: number;
  sizes: number[];
  outputDir: string;
  imageDir: string;
  chartsOnly: boolean;
};

type Scenario = {
  key: string;
  label: string;
  queryKind: QueryKind;
  prepare: () => Promise<void>;
  query: (params: QueryParams) => Promise<ExplainMetrics>;
};

type QueryParams = {
  searchQuery: string;
  filterKind: string;
  filterYear: number;
};

type ExplainMetrics = {
  planningMs: number;
  executionMs: number;
  rows: number;
};

type Measurement = ExplainMetrics & {
  scenario: string;
  scenarioLabel: string;
  queryKind: QueryKind;
  tableRows: number;
  run: number;
  searchQuery: string;
  filterKind: string;
  filterYear: number;
};

type SummaryRow = {
  scenario: string;
  scenarioLabel: string;
  queryKind: QueryKind;
  tableRows: number;
  runs: number;
  avgExecutionMs: number;
  minExecutionMs: number;
  maxExecutionMs: number;
  avgPlanningMs: number;
  rows: number;
  searchQuery: string;
  filterKind: string;
  filterYear: number;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = resolve(ROOT_DIR, "..", "report");
const DEFAULT_OUTPUT_DIR = resolve(REPORT_DIR, "inc", "csv");
const DEFAULT_IMAGE_DIR = resolve(REPORT_DIR, "inc", "img");
const RESEARCH_TABLE = "research_works";

loadEnvFile(resolve(ROOT_DIR, "infra", ".env.dev"));
loadEnvFile(resolve(ROOT_DIR, ".env"));
ensureDatabaseUrl();

const prisma = new PrismaClient();
const config = parseArgs();

const scenarios: Scenario[] = [
  {
    key: "search_ilike",
    label: "LIKE",
    queryKind: "search",
    prepare: async () => {
      await dropResearchIndex("research_works_search_gin_idx");
    },
    query: (params) => explainSearchIlike(params.searchQuery),
  },
  {
    key: "search_full_text_without_gin",
    label: "FTS без GIN",
    queryKind: "search",
    prepare: async () => {
      await dropResearchIndex("research_works_search_gin_idx");
    },
    query: (params) => explainSearchFullText(params.searchQuery),
  },
  {
    key: "search_full_text_with_gin",
    label: "FTS с GIN",
    queryKind: "search",
    prepare: async () => {
      await createSearchIndex();
    },
    query: (params) => explainSearchFullText(params.searchQuery),
  },
  {
    key: "filter_without_btree",
    label: "Без B-tree",
    queryKind: "filter",
    prepare: async () => {
      await dropResearchIndex("research_works_kind_release_year_idx");
    },
    query: (params) => explainFilter(params.filterKind, params.filterYear),
  },
  {
    key: "filter_with_btree",
    label: "С B-tree",
    queryKind: "filter",
    prepare: async () => {
      await createFilterIndex();
    },
    query: (params) => explainFilter(params.filterKind, params.filterYear),
  },
];

async function main(): Promise<void> {
  await mkdir(config.outputDir, { recursive: true });
  await mkdir(config.imageDir, { recursive: true });

  if (config.chartsOnly) {
    const summary = readSummaryCsv(resolve(config.outputDir, "index_research_summary.csv"));
    await writeCharts(summary);
    return;
  }

  const totalWorks = await countWorks();
  const sizes = normalizeSizes(config.sizes, totalWorks);
  const measurements: Measurement[] = [];

  try {
    for (const tableRows of sizes) {
      console.log(`Preparing ${tableRows} rows`);
      await recreateResearchTable(tableRows);
      const params = await pickQueryParams();

      for (const scenario of scenarios) {
        console.log(`Running ${scenario.label}, rows=${tableRows}`);
        await scenario.prepare();
        await analyzeResearchTable();

        for (let i = 0; i < config.warmups; i += 1) {
          await scenario.query(params);
        }

        for (let run = 1; run <= config.runs; run += 1) {
          const metrics = await scenario.query(params);
          measurements.push({
            ...metrics,
            scenario: scenario.key,
            scenarioLabel: scenario.label,
            queryKind: scenario.queryKind,
            tableRows,
            run,
            ...params,
          });
        }
      }
    }
  } finally {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${RESEARCH_TABLE}"`);
    await prisma.$disconnect();
  }

  const summary = summarize(measurements);
  const rawCsvPath = resolve(config.outputDir, "index_research_raw.csv");
  const summaryCsvPath = resolve(config.outputDir, "index_research_summary.csv");

  await writeFile(rawCsvPath, toCsv(measurements), "utf8");
  await writeFile(summaryCsvPath, toCsv(summary), "utf8");

  await writeCharts(summary);

  console.log(`Raw measurements: ${rawCsvPath}`);
  console.log(`Summary: ${summaryCsvPath}`);
  console.log(`Search chart: ${resolve(config.imageDir, "research_search_time.pdf")}`);
  console.log(`Filter chart: ${resolve(config.imageDir, "research_filter_time.pdf")}`);
}

function parseArgs(): Config {
  const values = new Map<string, string>();

  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.+)$/.exec(arg);

    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    values.set(match[1] ?? "", match[2] ?? "");
  }

  return {
    runs: parsePositiveInteger(values.get("runs"), 10),
    warmups: parsePositiveInteger(values.get("warmups"), 3),
    sizes: parseSizes(values.get("sizes")),
    outputDir: resolve(ROOT_DIR, values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    imageDir: resolve(ROOT_DIR, values.get("image-dir") ?? DEFAULT_IMAGE_DIR),
    chartsOnly: values.get("charts-only") === "true",
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }

  return parsed;
}

function parseSizes(value: string | undefined): number[] {
  if (!value) {
    return Array.from({ length: 100 }, (_, i) => (i + 1) * 1000);
  }

  return value.split(",").map((item) => parsePositiveInteger(item.trim(), 0));
}

function normalizeSizes(sizes: number[], totalWorks: number): number[] {
  return Array.from(
    new Set(sizes.map((size) => Math.min(size, totalWorks)).filter((size) => size > 0)),
  ).sort((left, right) => left - right);
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = unquoteEnvValue(rawValue);
    }
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  const database = requiredEnv("POSTGRES_DB");
  const user = requiredEnv("POSTGRES_USER");
  const password = requiredEnv("POSTGRES_PASSWORD");
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const schema = process.env.POSTGRES_SCHEMA ?? "public";

  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${encodeURIComponent(database)}?schema=${encodeURIComponent(schema)}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function countWorks(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count
    FROM "works"
  `;
  return Number(rows[0]?.count ?? 0n);
}

async function recreateResearchTable(limit: number): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${RESEARCH_TABLE}"`);
  await prisma.$executeRawUnsafe(`
    CREATE UNLOGGED TABLE "${RESEARCH_TABLE}" AS
    SELECT "id", "kind", "title", "original_title", "description", "release_year"
    FROM "works"
    ORDER BY "id"
    LIMIT ${limit}
  `);
}

async function pickQueryParams(): Promise<QueryParams> {
  const searchQuery = await pickSearchQuery();
  const filterParams = await pickFilterParams();

  return {
    searchQuery,
    filterKind: filterParams.kind,
    filterYear: filterParams.year,
  };
}

async function pickSearchQuery(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ word: string }>>`
    SELECT lower((regexp_match("title", '[[:alpha:]]{5,}'))[1]) AS word
    FROM "research_works"
    WHERE "title" ~ '[[:alpha:]]{5,}'
    LIMIT 1
  `;

  return rows[0]?.word ?? "movie";
}

async function pickFilterParams(): Promise<{ kind: string; year: number }> {
  const rows = await prisma.$queryRaw<Array<{ kind: string; release_year: number }>>`
    SELECT "kind"::text AS kind, "release_year"
    FROM "research_works"
    WHERE "release_year" IS NOT NULL
    GROUP BY "kind", "release_year"
    ORDER BY count(*) DESC
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return { kind: "movie", year: 2020 };
  }

  return { kind: row.kind, year: row.release_year };
}

async function dropResearchIndex(name: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`);
}

async function createSearchIndex(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "research_works_search_gin_idx"
    ON "research_works"
    USING GIN (
      to_tsvector(
        'russian',
        coalesce("title", '') || ' ' ||
        coalesce("original_title", '') || ' ' ||
        coalesce("description", '')
      )
    )
  `);
}

async function createFilterIndex(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "research_works_kind_release_year_idx"
    ON "research_works"("kind", "release_year")
  `);
}

async function analyzeResearchTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${RESEARCH_TABLE}"`);
}

async function explainSearchIlike(query: string): Promise<ExplainMetrics> {
  const escaped = query.replace(/'/g, "''");
  const result = await prisma.$queryRawUnsafe<unknown[]>(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT count(*)
    FROM "research_works"
    WHERE lower("title") LIKE '%' || lower('${escaped}') || '%'
       OR lower(coalesce("original_title", '')) LIKE '%' || lower('${escaped}') || '%'
  `);

  return parseExplain(result);
}

async function explainSearchFullText(query: string): Promise<ExplainMetrics> {
  const escaped = query.replace(/'/g, "''");
  const result = await prisma.$queryRawUnsafe<unknown[]>(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT count(*)
    FROM "research_works"
    WHERE to_tsvector(
        'russian',
        coalesce("title", '') || ' ' ||
        coalesce("original_title", '') || ' ' ||
        coalesce("description", '')
    ) @@ plainto_tsquery('russian', '${escaped}')
  `);

  return parseExplain(result);
}

async function explainFilter(kind: string, year: number): Promise<ExplainMetrics> {
  const escapedKind = kind.replace(/'/g, "''");
  const result = await prisma.$queryRawUnsafe<unknown[]>(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT count(*)
    FROM "research_works"
    WHERE "kind" = '${escapedKind}'::work_kind
      AND "release_year" = ${year}
  `);

  return parseExplain(result);
}

function parseExplain(result: unknown[]): ExplainMetrics {
  const first = result[0] as { "QUERY PLAN"?: unknown } | undefined;
  const payload = first?.["QUERY PLAN"];
  const root = Array.isArray(payload) ? (payload[0] as Record<string, unknown>) : undefined;
  const plan = root?.Plan as Record<string, unknown> | undefined;

  if (!root || !plan) {
    throw new Error("Unexpected EXPLAIN JSON output");
  }

  return {
    planningMs: Number(root["Planning Time"] ?? 0),
    executionMs: Number(root["Execution Time"] ?? 0),
    rows: Number(plan["Actual Rows"] ?? 0),
  };
}

function summarize(measurements: Measurement[]): SummaryRow[] {
  const groups = new Map<string, Measurement[]>();

  for (const row of measurements) {
    const key = `${row.scenario}|${row.scenarioLabel}|${row.queryKind}|${row.tableRows}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const [scenario, scenarioLabel, queryKind, tableRows] = key.split("|");
      const executionValues = rows.map((row) => row.executionMs);
      const planningValues = rows.map((row) => row.planningMs);

      return {
        scenario: scenario ?? "",
        scenarioLabel: scenarioLabel ?? "",
        queryKind: (queryKind ?? "search") as QueryKind,
        tableRows: Number(tableRows),
        runs: rows.length,
        avgExecutionMs: average(executionValues),
        minExecutionMs: Math.min(...executionValues),
        maxExecutionMs: Math.max(...executionValues),
        avgPlanningMs: average(planningValues),
        rows: rows[0]?.rows ?? 0,
        searchQuery: rows[0]?.searchQuery ?? "",
        filterKind: rows[0]?.filterKind ?? "",
        filterYear: rows[0]?.filterYear ?? 0,
      };
    })
    .sort((left, right) =>
      left.queryKind.localeCompare(right.queryKind) ||
      left.scenario.localeCompare(right.scenario) ||
      left.tableRows - right.tableRows,
    );
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function escapeCsvValue(value: unknown): string {
  const stringValue =
    typeof value === "number" ? value.toFixed(4) : String(value ?? "");

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function readSummaryCsv(path: string): SummaryRow[] {
  if (!existsSync(path)) {
    throw new Error(`Summary CSV not found: ${path}`);
  }

  const [headerLine, ...lines] = readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/);
  const headers = headerLine?.split(",") ?? [];

  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );

    return {
      scenario: row.scenario ?? "",
      scenarioLabel: row.scenarioLabel ?? "",
      queryKind: (row.queryKind ?? "search") as QueryKind,
      tableRows: Number(row.tableRows),
      runs: Number(row.runs),
      avgExecutionMs: Number(row.avgExecutionMs),
      minExecutionMs: Number(row.minExecutionMs),
      maxExecutionMs: Number(row.maxExecutionMs),
      avgPlanningMs: Number(row.avgPlanningMs),
      rows: Number(row.rows),
      searchQuery: row.searchQuery ?? "",
      filterKind: row.filterKind ?? "",
      filterYear: Number(row.filterYear),
    };
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function writeCharts(summary: SummaryRow[]): Promise<void> {
  await writeLineChart(
    summary.filter((row) => row.queryKind === "search"),
    resolve(config.imageDir, "research_search_time.svg"),
    "Зависимость времени поиска от объема таблицы",
  );
  await writeLineChart(
    summary.filter((row) => row.queryKind === "filter"),
    resolve(config.imageDir, "research_filter_time.svg"),
    "Зависимость времени фильтрации от объема таблицы",
  );

  await convertSvgToPdf(resolve(config.imageDir, "research_search_time.svg"));
  await convertSvgToPdf(resolve(config.imageDir, "research_filter_time.svg"));
}

async function writeLineChart(
  rows: SummaryRow[],
  outputPath: string,
  title: string,
): Promise<void> {
  const width = 960;
  const height = 560;
  const scenarios = Array.from(new Set(rows.map((row) => row.scenario)));
  const chart = new ChartJSNodeCanvas({
    width,
    height,
    type: "svg",
    backgroundColour: "white",
  });

  const chartConfig = {
    type: "line",
    data: {
      datasets: scenarios.map((scenario, index) => {
        const scenarioRows = rows
          .filter((row) => row.scenario === scenario)
          .sort((left, right) => left.tableRows - right.tableRows);

        return {
          label: scenarioRows[0]?.scenarioLabel ?? scenario,
          data: scenarioRows.map((row) => ({
            x: row.tableRows,
            y: Number(row.avgExecutionMs.toFixed(4)),
          })),
        };
      }),
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: title,
        },
        legend: {
          position: "right",
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Количество строк в таблице",
          },
          min: 0,
          ticks: {
            callback: (value) => Number(value).toFixed(0),
          },
        },
        y: {
          title: {
            display: true,
            text: "Среднее время, мс",
          },
          beginAtZero: true,
        },
      },
    },
  } as const;

  const svg = chart.renderToBufferSync(chartConfig, "image/svg+xml");
  await writeFile(outputPath, svg);
}

async function convertSvgToPdf(svgPath: string): Promise<void> {
  const pdfPath = svgPath.replace(/\.svg$/, ".pdf");

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("rsvg-convert", ["-f", "pdf", "-o", pdfPath, svgPath], {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`rsvg-convert exited with code ${code}`));
      }
    });
  });
}

main().catch(async (error: unknown) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
