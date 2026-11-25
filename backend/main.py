"""Main FastAPI Application Entrypoint for PiBuddy HVAC System.

Initializes database, CORS middleware, routes, and launches asynchronous
background physical simulation loop.
"""

import asyncio
import logging
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, SessionLocal
import os
from app.core.dependencies import simulation_engine, anomaly_detector, reload_models
from app.api.routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pibuddy")

# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Intelligent HVAC Monitoring & Predictive Maintenance System API",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router under configured prefix (/api)
app.include_router(api_router, prefix=settings.API_PREFIX)

# Background simulation task handle
simulation_task: Optional[asyncio.Task] = None


async def simulation_loop() -> None:
    """Asynchronous background loop advancing physical HVAC simulation ticks."""
    logger.info("HVAC simulation background loop started.")
    try:
        while True:
            if simulation_engine.is_running:
                try:
                    with SessionLocal() as db:
                        simulation_engine.tick(db)
                except Exception as ex:
                    logger.error(f"Error during simulation tick execution: {ex}", exc_info=True)

            # Sleep interval adjusted by dynamic speed multiplier
            interval = max(
                0.2,
                settings.SIMULATION_INTERVAL / max(simulation_engine.speed_multiplier, 0.1),
            )
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Simulation background loop cancelled.")


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize database tables, baseline records, and launch simulation loop."""
    logger.info("Starting PiBuddy backend services...")
    # Initialize database tables and seed baseline zones
    init_db()

    # Pre-populate initial sensor readings if none exist
    with SessionLocal() as db:
        from app.models.db_models import SensorReading
        readings_count = db.query(SensorReading).count()
        if readings_count == 0:
            logger.info("Generating initial sensor readings snapshot...")
            simulation_engine.tick(db)

    # First boot (e.g. fresh deploy): no trained models on disk, so train them in the background
    if anomaly_detector is not None and not os.path.exists(os.path.join("models", "autoencoder.pt")):
        async def _first_train() -> None:
            from app.ml.train import run_training_pipeline
            try:
                await asyncio.to_thread(run_training_pipeline)
                reload_models()
                logger.info("Initial model training finished.")
            except Exception:
                logger.exception("Initial model training failed.")
        asyncio.create_task(_first_train())

    # Launch background simulation loop
    global simulation_task
    simulation_task = asyncio.create_task(simulation_loop())
    logger.info("PiBuddy backend startup complete. System ready.")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Halt background simulation and close active resources on server shutdown."""
    logger.info("Shutting down PiBuddy backend services...")
    simulation_engine.is_running = False
    global simulation_task
    if simulation_task and not simulation_task.done():
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            pass
    logger.info("PiBuddy shutdown finalized.")


@app.get("/", tags=["Health"])
def root():
    """System identification endpoint."""
    return {
        "system": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "api_prefix": settings.API_PREFIX,
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe for containerized and automated health checking."""
    return {
        "status": "healthy",
        "simulation_running": simulation_engine.is_running,
        "scenario": simulation_engine.scenario,
        "tick_count": simulation_engine.tick_count,
    }
