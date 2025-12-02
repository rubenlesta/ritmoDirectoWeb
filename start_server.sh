#!/bin/bash

# Kill existing processes on ports 5000 and 5001 if needed (optional, be careful)
# fuser -k 5000/tcp
# fuser -k 5001/tcp

echo "Starting RitmoDirecto..."

# Start Stats App in background
python3 stats_app.py > stats.log 2>&1 &
STATS_PID=$!
echo "Stats App started (PID: $STATS_PID) on port 5001"

# Start Main App
echo "Starting Main App on port 5000..."
python3 run.py

# When main app exits, kill stats app
kill $STATS_PID
