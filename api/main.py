"""FastAPI backend wrapping the CFPB agent pipeline."""
import logging
import os
import sys
from pathlib import Path

# Add project root to path so src/ is importable
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.monitor_routes import monitor_router
from api.case_routes import case_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CFPB Agentic Complaint System API",
    description="Multi-agent AI system for CFPB consumer complaint analysis",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.netlify.app",
        "https://*.netlify.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(monitor_router, prefix="/api")
app.include_router(case_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize database and optionally start background monitoring on server start."""
    from src.data.database import init_db, get_system_state
    from src.data.database import save_activity

    try:
        init_db()
        logger.info("Database initialized")
    except Exception as exc:
        logger.error("Database init failed: %s", exc)

    # Auto-start monitoring if configured
    auto_start = os.getenv("AUTO_START_MONITORING", "false").lower() == "true"
    if auto_start:
        try:
            from src.data.database import get_system_state
            state = get_system_state()
            interval = int(state.get("poll_interval_minutes", os.getenv("CFPB_POLL_INTERVAL_MINUTES", "30")))
            from src.services.scheduler import start_monitoring
            start_monitoring(interval)
            logger.info("Auto-started monitoring with %d-minute interval", interval)
        except Exception as exc:
            logger.error("Auto-start monitoring failed: %s", exc)


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background scheduler gracefully."""
    try:
        from src.services.scheduler import stop_monitoring, get_status
        if get_status()["running"]:
            stop_monitoring()
    except Exception:
        pass
