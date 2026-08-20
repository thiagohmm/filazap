#!/usr/bin/env sh
set -e

echo "==> Gerando cliente Prisma"
npx prisma generate

echo "==> Aplicando migrations"
npx prisma migrate deploy

echo "==> Banco atualizado."
