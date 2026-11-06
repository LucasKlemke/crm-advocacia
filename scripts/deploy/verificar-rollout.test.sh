#!/usr/bin/env bash
# Teste do verificar-rollout.sh com um `aws` falso no PATH (sem conta AWS; precisa de jq).
# Rodar manualmente a partir da raiz: bash scripts/deploy/verificar-rollout.test.sh
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$AQUI/verificar-rollout.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ESPERADA="arn:aws:ecs:us-east-1:123456789012:task-definition/crm-pac-api:8"
ANTIGA="arn:aws:ecs:us-east-1:123456789012:task-definition/crm-pac-api:7"

# `aws` falso: grava os argumentos e devolve o JSON de $AWS_FAKE_JSON (ou falha com AWS_FAKE_FALHA).
# Na N-ésima chamada, se existir "$AWS_FAKE_JSON.N", devolve esse arquivo (respostas em sequência).
mkdir -p "$TMP/bin"
cat > "$TMP/bin/aws" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" > "$AWS_FAKE_ARGS"
if [ -n "${AWS_FAKE_FALHA:-}" ]; then echo "erro simulado" >&2; exit 255; fi
n=$(( $(cat "$AWS_FAKE_JSON.cont" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$AWS_FAKE_JSON.cont"
if [ -f "$AWS_FAKE_JSON.$n" ]; then cat "$AWS_FAKE_JSON.$n"; else cat "$AWS_FAKE_JSON"; fi
STUB
chmod +x "$TMP/bin/aws"

servico() { # $1 = array de deployments (JSON)
  printf '{"services":[{"serviceName":"crm-pac-api","deployments":%s}],"failures":[]}' "$1"
}

deploy() { # $1 status, $2 taskDefinition, $3 rolloutState
  printf '{"status":"%s","taskDefinition":"%s","rolloutState":"%s","runningCount":1,"desiredCount":1}' "$1" "$2" "$3"
}

falhas=0
rodar() {
  rm -f "$TMP"/resp.json.*
  PATH="$TMP/bin:$PATH" AWS_FAKE_JSON="$TMP/resp.json" AWS_FAKE_ARGS="$TMP/args" \
    ROLLOUT_TENTATIVAS="${ROLLOUT_TENTATIVAS:-3}" ROLLOUT_INTERVALO_S=0 \
    bash "$SCRIPT" "$@" 2>&1
}

caso() { # $1 nome, $2 código esperado, $3 JSON de resposta do describe-services
  local nome="$1" esperado="$2" saida codigo
  printf '%s' "$3" > "$TMP/resp.json"
  saida="$(rodar crm-pac crm-pac-api "$ESPERADA")"
  codigo=$?
  if [ "$codigo" -eq "$esperado" ]; then
    echo "ok    - $nome (saída $codigo)"
  else
    echo "FALHA - $nome: esperava saída $esperado, veio $codigo"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
  fi
}

caso "rollout COMPLETED na revisão esperada" 0 \
  "$(servico "[$(deploy PRIMARY "$ESPERADA" COMPLETED)]")"
if grep -qs -- "ecs describe-services --cluster crm-pac --services crm-pac-api" "$TMP/args"; then
  echo "ok    - chama describe-services com cluster e serviço"
else
  echo "FALHA - argumentos do aws: $(cat "$TMP/args")"; falhas=$((falhas + 1))
fi

caso "circuit breaker fez rollback (PRIMARY na revisão antiga)" 1 \
  "$(servico "[$(deploy PRIMARY "$ANTIGA" COMPLETED),$(deploy ACTIVE "$ESPERADA" FAILED)]")"

caso "rollout continua IN_PROGRESS até esgotar as tentativas" 1 \
  "$(servico "[$(deploy PRIMARY "$ESPERADA" IN_PROGRESS),$(deploy ACTIVE "$ANTIGA" COMPLETED)]")"

# services-stable libera alguns segundos antes de o ECS marcar COMPLETED: o script espera.
sequencia_ok() {
  local inicio fim
  inicio="$(servico "[$(deploy PRIMARY "$ESPERADA" IN_PROGRESS),$(deploy ACTIVE "$ANTIGA" COMPLETED)]")"
  fim="$(servico "[$(deploy PRIMARY "$ESPERADA" COMPLETED)]")"
  rm -f "$TMP"/resp.json.*
  printf '%s' "$inicio" > "$TMP/resp.json.1"
  printf '%s' "$inicio" > "$TMP/resp.json.2"
  printf '%s' "$fim" > "$TMP/resp.json"
  if PATH="$TMP/bin:$PATH" AWS_FAKE_JSON="$TMP/resp.json" AWS_FAKE_ARGS="$TMP/args" \
    ROLLOUT_TENTATIVAS=5 ROLLOUT_INTERVALO_S=0 bash "$SCRIPT" crm-pac crm-pac-api "$ESPERADA" >/dev/null 2>&1; then
    echo "ok    - IN_PROGRESS que vira COMPLETED dentro do prazo passa"
  else
    echo "FALHA - IN_PROGRESS que vira COMPLETED deveria passar"; falhas=$((falhas + 1))
  fi
}
sequencia_ok

caso "rollout FAILED na revisão esperada" 1 \
  "$(servico "[$(deploy PRIMARY "$ESPERADA" FAILED)]")"

caso "serviço sem deployment PRIMARY" 1 "$(servico '[]')"

caso "serviço inexistente" 1 '{"services":[],"failures":[{"arn":"x","reason":"MISSING"}]}'

printf '%s' "$(servico "[$(deploy PRIMARY "$ESPERADA" COMPLETED)]")" > "$TMP/resp.json"
if PATH="$TMP/bin:$PATH" AWS_FAKE_FALHA=1 AWS_FAKE_JSON="$TMP/resp.json" AWS_FAKE_ARGS="$TMP/args" \
  bash "$SCRIPT" crm-pac crm-pac-api "$ESPERADA" >/dev/null 2>&1; then
  echo "FALHA - erro do aws cli deveria falhar"; falhas=$((falhas + 1))
else
  echo "ok    - erro do aws cli propaga falha"
fi

if bash "$SCRIPT" crm-pac >/dev/null 2>&1; then
  echo "FALHA - argumentos faltando deveria falhar"; falhas=$((falhas + 1))
else
  echo "ok    - argumentos faltando falha com mensagem de uso"
fi

if [ "$falhas" -gt 0 ]; then
  echo "$falhas caso(s) falharam"
  exit 1
fi
echo "todos os casos passaram"
