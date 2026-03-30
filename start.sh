#!/bin/bash
# Start both backend and frontend for local development

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting FastAPI backend on :8000..."
source "$PROJECT_ROOT/venv/bin/activate"
cd "$PROJECT_ROOT"
uvicorn api.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "==> Starting Next.js frontend on :3000..."
cd "$PROJECT_ROOT/web"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for Ctrl+C and kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
