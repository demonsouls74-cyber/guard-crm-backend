import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Отримуємо рядок підключення з системних змінних (Render підставить його сюди автоматично).
# Якщо змінної немає (локальний запуск), використовуємо стандартний рядок для локального Docker.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+psycopg://admin:secretpassword@localhost:5432/dispatch_crm"
)

# Створюємо "двигун" (engine)
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Фабрика сесій
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовий клас
Base = declarative_base()