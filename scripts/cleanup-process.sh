#!/bin/bash
# ThaiFlood UAT Process Cleanup Script (Port 3050)
TARGET_PORT=3050

echo "🔍 Checking for lingering processes on port ${TARGET_PORT}..."

# Find PID using lsof
PIDS=$(lsof -ti :${TARGET_PORT} 2>/dev/null)

if [ -n "$PIDS" ]; then
    echo "⚠️ Found lingering process(es) on port ${TARGET_PORT}: ${PIDS}"
    echo "🛑 Terminating lingering processes..."
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ Port ${TARGET_PORT} is now cleared."
else
    echo "✅ Port ${TARGET_PORT} is clean. No zombie processes detected."
fi
