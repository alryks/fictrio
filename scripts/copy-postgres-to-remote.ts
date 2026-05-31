import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";

type CopyConfig = {
  sourceUrl: string;
  targetUrl: string;
  confirm: boolean;
  dryRun: boolean;
  schemaOnly: boolean;
  dataOnly: boolean;
};

type CommandResult = {
  exitCode: number;
  output: string;
};

type DumpCommand = {
  label: string;
  command: string;
  argsPrefix: string[];
};

const DEV_COMPOSE_ARGS = [
  "compose",
  "--env-file",
  "infra/.env.dev",
  "-f",
  "infra/docker-compose.dev.yml",
];

loadEnvFile("infra/.env.dev");
loadEnvFile(".env");

function parseArgs(): CopyConfig {
  const values = new Map<string, string | boolean>();

  for (const arg of process.argv.slice(2)) {
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (
      arg === "--confirm" ||
      arg === "--dry-run" ||
      arg === "--schema-only" ||
      arg === "--data-only"
    ) {
      values.set(arg.slice(2), true);
      continue;
    }

    const match = /^--([^=]+)=(.+)$/.exec(arg);

    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    values.set(match[1] ?? "", match[2] ?? "");
  }

  const sourceUrl =
    stringValue(values, "source-url") ??
    process.env.SOURCE_DATABASE_URL ??
    process.env.DATABASE_URL;
  const targetUrl =
    stringValue(values, "target-url") ?? process.env.TARGET_DATABASE_URL;
  const schemaOnly = booleanValue(values, "schema-only");
  const dataOnly = booleanValue(values, "data-only");

  if (!sourceUrl) {
    throw new Error(
      "Source database URL is required: pass --source-url=... or set DATABASE_URL in infra/.env.dev",
    );
  }

  if (!targetUrl) {
    throw new Error(
      "Target database URL is required: pass --target-url=... or TARGET_DATABASE_URL=...",
    );
  }

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target database URLs are identical");
  }

  if (schemaOnly && dataOnly) {
    throw new Error("--schema-only and --data-only cannot be used together");
  }

  return {
    sourceUrl,
    targetUrl,
    confirm: booleanValue(values, "confirm"),
    dryRun: booleanValue(values, "dry-run"),
    schemaOnly,
    dataOnly,
  };
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

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
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

function stringValue(
  values: ReadonlyMap<string, string | boolean>,
  key: string,
): string | undefined {
  const value = values.get(key);

  return typeof value === "string" ? value : undefined;
}

function booleanValue(
  values: ReadonlyMap<string, string | boolean>,
  key: string,
): boolean {
  return values.get(key) === true;
}

function printHelp(): void {
  console.log(`Usage:
  bun run db:copy:to-remote -- --target-url=postgresql://USER:PASSWORD@HOST:PORT/DB --confirm

Options:
  --target-url=URL      remote PostgreSQL connection string, or TARGET_DATABASE_URL
  --source-url=URL      local/source PostgreSQL connection string, defaults to infra/.env.dev DATABASE_URL
  --confirm             required for an actual destructive copy
  --dry-run             only check tools and connections
  --schema-only         copy only schema
  --data-only           copy only table data

The target database is cleaned with pg_dump --clean output before restore.
Do not point --target-url at a database that contains data you need to keep.

If local pg_dump is older than the source PostgreSQL server, the script
automatically falls back to:
  docker compose --env-file infra/.env.dev -f infra/docker-compose.dev.yml exec -T postgres pg_dump`);
}

function maskUrl(value: string): string {
  try {
    const url = new URL(value);

    if (url.password) {
      url.password = "***";
    }

    return url.toString();
  } catch {
    return value.replace(/(:)[^:@/]+(@)/, "$1***$2");
  }
}

async function runCapture(
  command: string,
  args: string[],
): Promise<CommandResult> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    output += chunk;
  });

  const [exitCode] = (await once(child, "close")) as [number];

  return { exitCode, output };
}

async function checkCommand(command: string): Promise<void> {
  const result = await runCapture(command, ["--version"]);

  if (result.exitCode !== 0) {
    throw new Error(`${command} is not available or failed: ${result.output}`);
  }

  console.log(`${command}: ${result.output.trim()}`);
}

async function checkConnection(label: string, url: string): Promise<void> {
  const result = await runCapture("psql", [
    url,
    "--no-password",
    "--tuples-only",
    "--quiet",
    "--command",
    "SELECT current_database();",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`${label} connection failed: ${result.output}`);
  }

  console.log(`${label}: connected to ${result.output.trim()}`);
}

async function getServerMajorVersion(url: string): Promise<number> {
  const result = await runCapture("psql", [
    url,
    "--no-password",
    "--tuples-only",
    "--quiet",
    "--command",
    "SHOW server_version_num;",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Cannot read server version: ${result.output}`);
  }

  const versionNumber = Number(result.output.trim());

  if (!Number.isInteger(versionNumber)) {
    throw new Error(`Unexpected PostgreSQL server version: ${result.output}`);
  }

  return Math.floor(versionNumber / 10_000);
}

async function getPgDumpMajorVersion(): Promise<number> {
  const result = await runCapture("pg_dump", ["--version"]);

  if (result.exitCode !== 0) {
    throw new Error(`pg_dump is not available or failed: ${result.output}`);
  }

  const version = /(\d+)(?:\.\d+)?/.exec(result.output);

  if (!version?.[1]) {
    throw new Error(`Cannot parse pg_dump version: ${result.output}`);
  }

  return Number(version[1]);
}

async function selectDumpCommand(sourceUrl: string): Promise<DumpCommand> {
  const sourceMajor = await getServerMajorVersion(sourceUrl);
  const localDumpMajor = await getPgDumpMajorVersion();

  if (localDumpMajor >= sourceMajor) {
    console.log(
      `pg_dump source compatibility: local ${localDumpMajor} >= server ${sourceMajor}`,
    );
    return {
      label: "local pg_dump",
      command: "pg_dump",
      argsPrefix: [],
    };
  }

  console.log(
    `pg_dump source compatibility: local ${localDumpMajor} < server ${sourceMajor}; trying dev Docker postgres service`,
  );

  const dockerDump = await runCapture("docker", [
    ...DEV_COMPOSE_ARGS,
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "--version",
  ]);

  if (dockerDump.exitCode !== 0) {
    throw new Error(
      `Local pg_dump is too old and Docker fallback failed:\n${dockerDump.output}`,
    );
  }

  console.log(`docker postgres pg_dump: ${dockerDump.output.trim()}`);

  return {
    label: "docker compose postgres pg_dump",
    command: "docker",
    argsPrefix: [...DEV_COMPOSE_ARGS, "exec", "-T", "postgres", "pg_dump"],
  };
}

async function copyDatabase(
  copyConfig: CopyConfig,
  dumpCommand: DumpCommand,
): Promise<void> {
  const dumpArgs = [
    copyConfig.sourceUrl,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
  ];

  if (copyConfig.schemaOnly) {
    dumpArgs.push("--schema-only");
  }

  if (copyConfig.dataOnly) {
    dumpArgs.push("--data-only");
  }

  const psqlArgs = [
    copyConfig.targetUrl,
    "--set",
    "ON_ERROR_STOP=1",
    "--no-password",
    "--quiet",
  ];

  const dump = spawn(
    dumpCommand.command,
    [...dumpCommand.argsPrefix, ...dumpArgs],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const restore = spawn("psql", psqlArgs, {
    stdio: ["pipe", "inherit", "pipe"],
  });
  let dumpError = "";
  let restoreError = "";

  dump.stderr.setEncoding("utf8");
  restore.stderr.setEncoding("utf8");
  dump.stderr.on("data", (chunk: string) => {
    dumpError += chunk;
  });
  restore.stderr.on("data", (chunk: string) => {
    restoreError += chunk;
  });

  dump.stdout.pipe(restore.stdin);

  const [[dumpCode], [restoreCode]] = (await Promise.all([
    once(dump, "close") as Promise<[number]>,
    once(restore, "close") as Promise<[number]>,
  ])) as [[number], [number]];

  if (dumpCode !== 0) {
    throw new Error(`pg_dump failed with code ${dumpCode}:\n${dumpError}`);
  }

  if (restoreCode !== 0) {
    throw new Error(
      `psql restore failed with code ${restoreCode}:\n${restoreError}`,
    );
  }
}

async function main(): Promise<void> {
  const copyConfig = parseArgs();

  console.log(`Source: ${maskUrl(copyConfig.sourceUrl)}`);
  console.log(`Target: ${maskUrl(copyConfig.targetUrl)}`);

  await checkCommand("pg_dump");
  await checkCommand("psql");
  await checkConnection("source", copyConfig.sourceUrl);
  await checkConnection("target", copyConfig.targetUrl);
  const dumpCommand = await selectDumpCommand(copyConfig.sourceUrl);

  if (copyConfig.dryRun) {
    console.log("Dry run complete. No data was copied.");
    return;
  }

  if (!copyConfig.confirm) {
    throw new Error(
      "Refusing to copy without --confirm. The target database will be overwritten.",
    );
  }

  console.log(
    `Copying database with ${dumpCommand.label}. Target objects will be dropped/recreated by pg_dump --clean output...`,
  );
  await copyDatabase(copyConfig, dumpCommand);
  console.log("Database copy complete.");
}

void main();
