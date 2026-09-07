import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Отримуємо URL з хмари Render або беремо локальний
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+psycopg://admin:secretpassword@localhost:5432/dispatch_crm"
)

# ВИПРАВЛЕННЯ: Якщо Render передає стандартний postgres://, примусово замінюємо його на postgresql+psycopg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()