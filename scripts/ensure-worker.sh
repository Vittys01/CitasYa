#!/bin/bash

# Script para asegurar que el worker de auto-completado de citas está corriendo en Heroku

echo "Verificando estado del worker en Heroku..."

# Verificar si el worker está corriendo
WORKER_STATUS=$(heroku ps --json --app dates-saas 2>/dev/null | jq -r '.[] | select(.process == "worker.1") | .state' 2>/dev/null)

if [ "$WORKER_STATUS" = "up" ]; then
    echo "✅ El worker ya está corriendo (state: $WORKER_STATUS)"
else
    echo "❌ El worker no está corriendo (state: ${WORKER_STATUS:-'not found'})"
    echo ""
    echo "Escalando el worker para que inicie..."
    heroku ps:scale worker=1 --app dates-saas
    echo ""
    echo "✅ Worker iniciado"
fi

echo ""
echo "Estado actual de todos los procesos:"
heroku ps --app dates-saas