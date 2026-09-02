#!/usr/bin/env bash
# Derruba o túnel ngrok subido por ngrok-start.sh, usando o PID salvo em .ngrok.pid.
set -euo pipefail

PID_FILE=".ngrok.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "ngrok não está rodando (nenhum $PID_FILE encontrado)."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "ngrok parado (PID $PID)."
else
  echo "PID $PID não está mais ativo."
fi
rm -f "$PID_FILE"
