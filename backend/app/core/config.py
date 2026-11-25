"""Application configuration using Pydantic Settings.

Defines environment variables, simulation intervals, database connections,
and baseline threshold configurations for the PiBuddy HVAC system.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """PiBuddy core configuration settings."""

    # Application Information
    APP_NAME: str = "PiBuddy"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./pibuddy.db"

    # Simulation Configuration
    SIMULATION_INTERVAL: float = 3.0  # seconds between ticks
    MAX_HISTORICAL_READINGS_PER_ZONE: int = 1000

    # Paths
    DATA_DIR: str = "data"
    MODELS_DIR: str = "models"

    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # Sensor Threshold Defaults
    PM25_WARNING: float = 35.0
    PM25_CRITICAL: float = 65.0

    CO2_WARNING: float = 800.0
    CO2_CRITICAL: float = 1200.0

    VELOCITY_WARNING_LOW: float = 0.8
    VELOCITY_CRITICAL_LOW: float = 0.4

    PRESSURE_WARNING: float = 50.0
    PRESSURE_CRITICAL: float = 80.0

    POWER_WARNING: float = 1500.0
    POWER_CRITICAL: float = 2000.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
