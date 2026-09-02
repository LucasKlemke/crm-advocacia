#!/usr/bin/env bash
# Sobe um túnel ngrok pra porta do Next dev (padrão 3000) em background, guardando o PID
# em .ngrok.pid pra ngrok-stop.sh conseguir derrubar depois. Uso: npm run ngrok:start [porta]
set -euo pipefail

PID_FILE=".ngrok.pid"
LOG_FILE=".ngrok.log"
PORT="${1:-3000}"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "ngrok já está rodando (PID $(cat "$PID_FILE"))."
  URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || true)
  [ -n "${URL:-}" ] && echo "URL pública: $URL"
  exit 0
fi

ngrok http "$PORT" --log=stdout > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Aguardando ngrok subir..."
for _ in $(seq 1 20); do
  URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || true)
  if [ -n "${URL:-}" ]; then
    echo "ngrok rodando (PID $(cat "$PID_FILE")): $URL"
    exit 0
  fi
  sleep 0.5
done

echo "ngrok iniciou mas não achei a URL pública a tempo — confira $LOG_FILE ou http://127.0.0.1:4040" >&2
exit 1
