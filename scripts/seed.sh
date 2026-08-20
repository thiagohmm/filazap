#!/usr/bin/env sh
set -e

echo "==> Aplicando migrations"
npx prisma migrate deploy

echo "==> Executando seed"
npx tsx prisma/seed.ts

echo "==> Seed concluído."
