#!/usr/bin/env sh
set -e

# Simula eventos oficiais do WhatsApp Cloud API para o endpoint local,
# usando o whatsapp-mock para assinar corretamente (X-Hub-Signature-256).
# Fases 2-3: recebimento idempotente, fila justa, retorno e mudança de status.

mock_url="${MOCK_URL:-http://localhost:4000}"
app_url="${APP_URL:-http://localhost:3000}"
app_secret="${APP_SECRET:-local-app-secret}"
phone_number_id="${PHONE_NUMBER_ID:-123456789}"
waba_id="${WABA_ID:-1010101010}"
from="${FROM_PHONE:-5511999990001}"

forward() {
  name="$1"
  payload_file="$2"
  echo "==> Cenário: ${name}"
  curl -s -X POST "${mock_url}/graph/webhook/forward" \
    -H "Content-Type: application/json" \
    -d "{\"appUrl\":\"${app_url}\",\"appSecret\":\"${app_secret}\",\"payload\":$(cat "${payload_file}")}"
  echo
  echo
}

tmpdir=$(mktemp -d)
trap 'rm -rf "${tmpdir}"' EXIT

metadata="\"metadata\":{\"display_phone_number\":\"5511999990000\",\"phone_number_id\":\"${phone_number_id}\"}"

# 1. Nova mensagem de telefone desconhecido (cria contato e ticket WAITING)
cat > "${tmpdir}/01-new-message.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "contacts": [{"profile": {"name": "Maria"}, "wa_id": "${from}"}],
        "messages": [{
          "from": "${from}",
          "id": "wamid.INBOUND.0001",
          "timestamp": "1700000001",
          "type": "text",
          "text": {"body": "Olá, preciso de ajuda"}
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF

# 2. Várias mensagens do mesmo cliente (não altera a posição da fila)
cat > "${tmpdir}/02-more-messages.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "contacts": [{"profile": {"name": "Maria"}, "wa_id": "${from}"}],
        "messages": [
          {"from": "${from}", "id": "wamid.INBOUND.0002", "timestamp": "1700000010", "type": "text", "text": {"body": "É urgente!"}},
          {"from": "${from}", "id": "wamid.INBOUND.0003", "timestamp": "1700000015", "type": "text", "text": {"body": "Está me ouvindo?"}}
        ]
      },
      "field": "messages"
    }]
  }]
}
EOF

# 3. Evento repetido (testa idempotência pelo id da mensagem)
cat > "${tmpdir}/03-duplicate.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "contacts": [{"profile": {"name": "Maria"}, "wa_id": "${from}"}],
        "messages": [{
          "from": "${from}",
          "id": "wamid.INBOUND.0002",
          "timestamp": "1700000010",
          "type": "text",
          "text": {"body": "É urgente!"}
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF

# 4. Atualizações de entregue, lido e falha
cat > "${tmpdir}/04-statuses.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "statuses": [
          {"id": "wamid.INBOUND.0001", "status": "delivered", "timestamp": "1700000020"},
          {"id": "wamid.INBOUND.0001", "status": "read", "timestamp": "1700000025"}
        ]
      },
      "field": "messages"
    }]
  }]
}
EOF

# 5. Cliente retornando depois de um ticket finalizado (Fase 3: cria ticket RETURNING)
cat > "${tmpdir}/05-returning.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "contacts": [{"profile": {"name": "Maria"}, "wa_id": "${from}"}],
        "messages": [{
          "from": "${from}",
          "id": "wamid.INBOUND.0004",
          "timestamp": "1700000030",
          "type": "text",
          "text": {"body": "Voltei, ainda preciso de ajuda"}
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF

# 6. Cliente responde enquanto aguardava atendente (Fase 3: volta para IN_PROGRESS)
cat > "${tmpdir}/06-customer-reply.json" <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${waba_id}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        ${metadata},
        "contacts": [{"profile": {"name": "Maria"}, "wa_id": "${from}"}],
        "messages": [{
          "from": "${from}",
          "id": "wamid.INBOUND.0005",
          "timestamp": "1700000040",
          "type": "text",
          "text": {"body": "Aqui estou de novo"}
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF

forward "01 - nova mensagem de telefone desconhecido" "${tmpdir}/01-new-message.json"
forward "02 - várias mensagens do mesmo cliente" "${tmpdir}/02-more-messages.json"
forward "03 - evento repetido (idempotência)" "${tmpdir}/03-duplicate.json"
forward "04 - status entregue/lido" "${tmpdir}/04-statuses.json"
forward "05 - cliente retornando (Fase 3)" "${tmpdir}/05-returning.json"
forward "06 - cliente responde (volta para em atendimento)" "${tmpdir}/06-customer-reply.json"

echo "==> Simulação concluída."
