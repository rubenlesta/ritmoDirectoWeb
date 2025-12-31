#!/bin/bash

# Activar entorno virtual
source venv/bin/activate

# Añadir directorio actual al PYTHONPATH para que los scripts encuentren el paquete 'app'
export PYTHONPATH=$PYTHONPATH:.

echo "Starting RitmoDirecto..."

# Start Stats App in background (desde carpeta scripts)
# Redirigimos logs si se desea
# python3 scripts/stats_app.py > stats.log 2>&1 &
# O simplemente:
python3 scripts/stats_app.py > stats.log 2>&1 &
STATS_PID=$!
echo "Stats App started (PID: $STATS_PID)"

# Start Main App (desde root)
echo "Starting Main App..."
python3 run.py

# Al salir (Ctrl+C), matar el proceso de stats
echo "Stopping Stats App..."
kill $STATS_PID
