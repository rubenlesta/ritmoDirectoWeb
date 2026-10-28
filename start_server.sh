#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "venv/bin/activate" ]; then
    echo "Virtual environment not found. Run ./setUp first." >&2
    exit 1
fi

source venv/bin/activate
export PYTHONPATH="$SCRIPT_DIR${PYTHONPATH:+:$PYTHONPATH}"

python scripts/stats_app.py > stats.log 2>&1 &
STATS_PID=$!

stop_stats() {
    if kill -0 "$STATS_PID" 2>/dev/null; then
        kill "$STATS_PID"
        wait "$STATS_PID" 2>/dev/null || true
    fi
}

trap stop_stats EXIT

echo "Starting RitmoDirecto with ports configured in .env (defaults: 5000 and 5001)."
echo "Press Ctrl+C to stop both apps."
python run.py
