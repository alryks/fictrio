#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV="${LOCAL_ENV:-$ROOT_DIR/infra/.env.dev}"
LOCAL_COMPOSE="${LOCAL_COMPOSE:-$ROOT_DIR/infra/docker-compose.dev.yml}"
REMOTE_ENV="${REMOTE_ENV:-infra/.env.prod}"
REMOTE_COMPOSE="${REMOTE_COMPOSE:-infra/docker-compose.prod.yml}"
REMOTE_DUMP_DIR="${REMOTE_DUMP_DIR:-/tmp}"
LOCAL_DUMP_DIR="${LOCAL_DUMP_DIR:-$ROOT_DIR/.tmp/db-transfer}"

REMOTE_HOST=""
REMOTE_APP_DIR=""
YES=0
KEEP_DUMP=0
SKIP_STOP=0

usage() {
  cat <<'EOF'
Usage:
  scripts/transfer-db-to-server.sh --remote user@host --remote-dir /path/to/CourseWork/src --yes

Copies the local development PostgreSQL database into the PostgreSQL container
on the server. The remote database is dropped and recreated.

Required:
  --remote user@host       SSH target for the server
  --remote-dir path        Project src directory on the server
  --yes                    Confirm destructive restore

Options:
  --keep-dump              Keep local and remote dump files after restore
  --skip-stop              Do not stop remote api/web before restore
  --help                   Show this help

Environment overrides:
  LOCAL_ENV                default: infra/.env.dev
  LOCAL_COMPOSE            default: infra/docker-compose.dev.yml
  REMOTE_ENV               default: infra/.env.prod, relative to --remote-dir
  REMOTE_COMPOSE           default: infra/docker-compose.prod.yml, relative to --remote-dir
  LOCAL_DUMP_DIR           default: .tmp/db-transfer
  REMOTE_DUMP_DIR          default: /tmp

Example:
  scripts/transfer-db-to-server.sh \
    --remote root@fictrio.sklyar.app \
    --remote-dir /opt/fictrio \
    --yes
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      REMOTE_HOST="${2:-}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_APP_DIR="${2:-}"
      shift 2
      ;;
    --yes)
      YES=1
      shift
      ;;
    --keep-dump)
      KEEP_DUMP=1
      shift
      ;;
    --skip-stop)
      SKIP_STOP=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_APP_DIR" ]]; then
  echo "--remote and --remote-dir are required" >&2
  usage >&2
  exit 2
fi

if [[ "$YES" -ne 1 ]]; then
  cat >&2 <<EOF
Refusing to run without --yes.

This command replaces the PostgreSQL database on:
  $REMOTE_HOST:$REMOTE_APP_DIR
EOF
  exit 2
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command is missing: $1" >&2
    exit 1
  fi
}

load_env_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "Environment file not found: $file" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is missing: $name" >&2
    exit 1
  fi
}

remote_quote() {
  printf "%q" "$1"
}

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_name="fictrio-local-$timestamp.dump"
local_dump="$LOCAL_DUMP_DIR/$dump_name"
remote_dump="$REMOTE_DUMP_DIR/$dump_name"

require_command docker
require_command ssh
require_command scp

load_env_file "$LOCAL_ENV"
require_env POSTGRES_USER
require_env POSTGRES_DB

mkdir -p "$LOCAL_DUMP_DIR"

cleanup() {
  if [[ "$KEEP_DUMP" -eq 0 ]]; then
    rm -f "$local_dump"
    if [[ -n "$REMOTE_HOST" && -n "$remote_dump" ]]; then
      ssh "$REMOTE_HOST" "rm -f $(remote_quote "$remote_dump")" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT

echo "Creating local dump: $local_dump"
docker compose --env-file "$LOCAL_ENV" -f "$LOCAL_COMPOSE" exec -T postgres \
  pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  >"$local_dump"

echo "Copying dump to $REMOTE_HOST:$remote_dump"
scp "$local_dump" "$REMOTE_HOST:$remote_dump"

remote_app_dir_q="$(remote_quote "$REMOTE_APP_DIR")"
remote_env_q="$(remote_quote "$REMOTE_ENV")"
remote_compose_q="$(remote_quote "$REMOTE_COMPOSE")"
remote_dump_q="$(remote_quote "$remote_dump")"
skip_stop_q="$(remote_quote "$SKIP_STOP")"

echo "Restoring remote database..."
ssh "$REMOTE_HOST" "REMOTE_APP_DIR=$remote_app_dir_q REMOTE_ENV=$remote_env_q REMOTE_COMPOSE=$remote_compose_q REMOTE_DUMP=$remote_dump_q SKIP_STOP=$skip_stop_q bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

cd "$REMOTE_APP_DIR"

if [[ ! -f "$REMOTE_ENV" ]]; then
  echo "Remote environment file not found: $REMOTE_APP_DIR/$REMOTE_ENV" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$REMOTE_ENV"
set +a

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_DB:-}" ]]; then
  echo "POSTGRES_USER and POSTGRES_DB are required in $REMOTE_ENV" >&2
  exit 1
fi

if [[ ! -f "$REMOTE_DUMP" ]]; then
  echo "Remote dump file not found: $REMOTE_DUMP" >&2
  exit 1
fi

if [[ "$SKIP_STOP" != "1" ]]; then
  docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" stop api web >/dev/null
fi

docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" exec -T postgres \
  dropdb \
  --if-exists \
  --force \
  --username "$POSTGRES_USER" \
  "$POSTGRES_DB"

docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" exec -T postgres \
  createdb \
  --username "$POSTGRES_USER" \
  "$POSTGRES_DB"

docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" exec -T postgres \
  pg_restore \
  --no-owner \
  --no-acl \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  <"$REMOTE_DUMP"

if [[ "$SKIP_STOP" != "1" ]]; then
  docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" up -d api web >/dev/null
fi

docker compose --env-file "$REMOTE_ENV" -f "$REMOTE_COMPOSE" exec -T postgres \
  psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --tuples-only \
  --command "SELECT 'users=' || COUNT(*) FROM users;"
REMOTE_SCRIPT

echo "Database transfer completed."
