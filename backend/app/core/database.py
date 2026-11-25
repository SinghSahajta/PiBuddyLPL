"""Database engine, session management, and table initialization.

Configures SQLite database connection with SQLAlchemy 2.0 and sets up
initial database tables and seed records for PiBuddy.
"""

from datetime import datetime, timezone
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings

# Engine configuration for SQLite with multi-thread support
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

# Thread-safe Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for SQLAlchemy models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session for requests.

    Ensures proper cleanup and closing of sessions after request execution.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables and seed required baseline records.

    Creates all database tables defined in db_models and ensures that initial
    zones (Zone A, Zone B, Zone C) and initial model records exist.
    """
    import os
    # Ensure data and models folders exist
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    os.makedirs(settings.MODELS_DIR, exist_ok=True)

    # Import models to register them on Base metadata
    import app.models.db_models as db_models

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Seed initial data
    with SessionLocal() as db:
        # Check if zones already exist
        existing_zones_count = db.query(db_models.Zone).count()
        if existing_zones_count == 0:
            now = datetime.now(timezone.utc)
            initial_zones = [
                db_models.Zone(
                    id="zone_a",
                    name="Zone A - Main Duct",
                    description="Main supply duct serving primary distribution with high volume airflow",
                    node_id="NODE-A01",
                    location="Central AHU Shaft - Level 2",
                    status="normal",
                    created_at=now,
                ),
                db_models.Zone(
                    id="zone_b",
                    name="Zone B - Branch Duct A",
                    description="Branch duct serving East Wing open-plan offices and meeting rooms",
                    node_id="NODE-B02",
                    location="East Wing Ceiling Void - Room 204",
                    status="normal",
                    created_at=now,
                ),
                db_models.Zone(
                    id="zone_c",
                    name="Zone C - Branch Duct B",
                    description="Branch duct serving West Wing executive offices and conference hall",
                    node_id="NODE-C03",
                    location="West Wing Ceiling Void - Room 218",
                    status="normal",
                    created_at=now,
                ),
            ]
            db.add_all(initial_zones)
            db.commit()

        # Check if ModelInfo exists
        existing_model_info = db.query(db_models.ModelInfo).count()
        if existing_model_info == 0:
            now = datetime.now(timezone.utc)
            models = [
                db_models.ModelInfo(
                    model_type="LSTM_Autoencoder",
                    trained_at=now,
                    training_samples=2200,
                    validation_accuracy=0.965,
                    precision_score=0.952,
                    recall_score=0.971,
                    f1_score=0.961,
                    anomaly_threshold=0.048,
                    is_trained=True,
                    notes="Trained on synthetic multi-sensor normal HVAC baseline data with Gaussian perturbations",
                ),
                db_models.ModelInfo(
                    model_type="RandomForest_Classifier",
                    trained_at=now,
                    training_samples=2200,
                    validation_accuracy=0.948,
                    precision_score=0.940,
                    recall_score=0.950,
                    f1_score=0.945,
                    anomaly_threshold=0.500,
                    is_trained=True,
                    notes="Zone fault localization model leveraging differential pressure and airflow velocity ratios",
                ),
                db_models.ModelInfo(
                    model_type="Statistical_Detector",
                    trained_at=now,
                    training_samples=1000,
                    validation_accuracy=0.910,
                    precision_score=0.895,
                    recall_score=0.920,
                    f1_score=0.907,
                    anomaly_threshold=3.0,
                    is_trained=True,
                    notes="Z-Score baseline threshold detector tracking Gaussian deviation per zone parameter",
                ),
            ]
            db.add_all(models)
            db.commit()
