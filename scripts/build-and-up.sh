#!/usr/bin/env sh
#
# build-and-up.sh — builda as imagens e sobe o docker compose
#
# Uso:
#   ./scripts/build-and-up.sh            # build + up (prod)
#   ./scripts/build-and-up.sh --test     # build + up com compose de teste
#   ./scripts/build-and-up.sh --no-build # apenas up (reusa imagens atuais)
#   ./scripts/build-and-up.sh --watch    # up com --watch (rebuild automático)
#
set -eu

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.yml"
NO_BUILD=0
WATCH=0

for arg in "$@"; do
  case "$arg" in
    --test) COMPOSE_FILE="docker-compose.test.yml" ;;
    --no-build) NO_BUILD=1 ;;
    --watch) WATCH=1 ;;
    -h|--help)
      sed -n '3,10p' "$0"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      sed -n '3,10p' "$0"
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker não encontrado no PATH" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" version >/dev/null 2>&1 || {
  echo "Erro: 'docker compose' indisponível" >&2
  exit 1
}

# Verifica o .env (o serviço app usa env_file .env)
if [ -f docker-compose.yml ] && [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Aviso: .env não existe, copiando de .env.example"
    cp .env.example .env
  else
    echo "Erro: .env não existe (copie .env.example para .env)" >&2
    exit 1
  fi
fi

if [ "$NO_BUILD" -eq 1 ]; then
  echo "==> Pulando build (--no-build)"
else
  echo "==> Buildando imagens ($COMPOSE_FILE)..."
  docker compose -f "$COMPOSE_FILE" build
fi

if [ "$WATCH" -eq 1 ]; then
  echo "==> Subindo com --watch (Ctrl+C para parar)..."
  docker compose -f "$COMPOSE_FILE" up --watch
else
  echo "==> Subindo serviços ($COMPOSE_FILE)..."
  docker compose -f "$COMPOSE_FILE" up -d
  echo
  docker compose -f "$COMPOSE_FILE" ps
  echo
  echo "Pronto! App em: http://localhost:3000"
fi
