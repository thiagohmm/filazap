#!/usr/bin/env sh
set -e

host="${DB_HOST:-localhost}"
port="${DB_PORT:-5432}"
user="${DB_USER:-filazap}"
db="${DB_NAME:-filazap}"
timeout="${WAIT_TIMEOUT:-60}"

echo "Aguardando PostgreSQL em ${host}:${port}/${db} ..."

i=0
until pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$timeout" ]; then
    echo "PostgreSQL não ficou pronto em ${timeout}s." >&2
    exit 1
  fi
  sleep 1
done

echo "PostgreSQL pronto."
