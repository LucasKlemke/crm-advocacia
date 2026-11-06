#!/usr/bin/env bash
# Confere se o rollout do serviço ECS terminou NA revisão esperada da task definition.
#
#   scripts/deploy/verificar-rollout.sh <cluster> <service> <task-definition-arn-esperada>
#
# `aws ecs wait services-stable` também passa quando o circuit breaker faz rollback (o serviço fica
# estável na revisão ANTIGA), então o deploy-aws.yml chama este script depois do wait: falha se o
# deployment PRIMARY não usa a revisão esperada ou se o rolloutState dele não chega a COMPLETED
# (IN_PROGRESS é reconsultado: ROLLOUT_TENTATIVAS, padrão 30, a cada ROLLOUT_INTERVALO_S, padrão 10 s).
# Precisa de `aws` (credencial já configurada) e `jq`. Teste: scripts/deploy/verificar-rollout.test.sh
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "uso: $0 <cluster> <service> <task-definition-arn-esperada>" >&2
  exit 2
fi

cluster="$1"
servico="$2"
esperada="$3"

# `services-stable` pode liberar alguns segundos antes de o ECS marcar o rollout COMPLETED:
# enquanto o PRIMARY estiver IN_PROGRESS na revisão esperada, consulta de novo.
tentativas="${ROLLOUT_TENTATIVAS:-30}"
intervalo="${ROLLOUT_INTERVALO_S:-10}"

for ((tentativa = 1; tentativa <= tentativas; tentativa++)); do
  resposta="$(aws ecs describe-services --cluster "$cluster" --services "$servico" --output json)"

  primario="$(jq -c '[.services[0].deployments[]? | select(.status == "PRIMARY")][0] // empty' <<<"$resposta")"
  if [ -z "$primario" ]; then
    echo "::error::Serviço $servico (cluster $cluster) sem deployment PRIMARY."
    jq -c '.failures' <<<"$resposta" >&2 || true
    exit 1
  fi

  revisao="$(jq -r '.taskDefinition' <<<"$primario")"
  estado="$(jq -r '.rolloutState // "DESCONHECIDO"' <<<"$primario")"

  echo "Deployment PRIMARY: $revisao (rolloutState=$estado, tentativa $tentativa/$tentativas)"
  echo "Revisão esperada:   $esperada"

  if [ "$revisao" != "$esperada" ]; then
    echo "::error::O deployment PRIMARY usa $revisao, não $esperada (rollback do circuit breaker?)."
    exit 1
  fi

  if [ "$estado" = "COMPLETED" ]; then
    break
  fi
  if [ "$estado" != "IN_PROGRESS" ] || [ "$tentativa" -eq "$tentativas" ]; then
    echo "::error::rolloutState do deployment PRIMARY é $estado, não COMPLETED."
    exit 1
  fi
  sleep "$intervalo"
done

echo "Rollout concluído na revisão esperada."
