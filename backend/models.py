from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime



# 1. Таблиця користувачів (для авторизації та ролей)
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "client", "guard", "dispatcher", "admin"
    created_at = Column(DateTime, default=datetime.utcnow)

    # === ГЕОЛОКАЦІЯ ЕКІПАЖУ (тільки для ролі guard) ===
    latitude = Column(Float, nullable=True)   
    longitude = Column(Float, nullable=True)

    # === НОВІ ПОЛЯ ДЛЯ ТЕЛЕГРАМ-БОТА ===
    telegram_chat_id = Column(String, unique=True, index=True, nullable=True)
    telegram_sync_token = Column(String, unique=True, index=True, nullable=True)

    # Додаємо зв'язок: один користувач може мати багато об'єктів охорони
    security_objects = relationship("SecurityObject", back_populates="client")

    # НОВЕ: Зв'язок 1-до-1 з профілем клієнта
    profile = relationship("ClientProfile", uselist=False, back_populates="user")


# 2. Таблиця об'єктів під охороною (магазини, квартири клієнтів)
class SecurityObject(Base):
    __tablename__ = "security_objects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)      # Наприклад: "Магазин 'АТБ' на Шевченка"
    address = Column(String, nullable=False)   # Точна адреса
    latitude = Column(Float, nullable=True)   # Широта (наприклад, 47.6532)
    longitude = Column(Float, nullable=True)  # Довгота (наприклад, 34.0881)
    
    client_id = Column(Integer, ForeignKey("users.id")) # Хто власник об'єкта
    
    # Інструкція для екіпажу на випадок тривоги
    instructions = Column(String, nullable=True) 

    # === ПОЛЯ БІЛІНГУ ТА СТАТУСУ ===
    status = Column(String, default="ACTIVE")  # ACTIVE, SUSPENDED_DEBT, SUSPENDED_CLIENT, TERMINATED
    monthly_fee = Column(Float, default=0.0)   # Ставимо 500 за замовчуванням на один об'єкт, але можна змінювати для кожного об'єкта окремо
    paid_until = Column(Date, nullable=True)   # до якого числа оплачено

    # Додаємо зв'язок: один об'єкт охорони належить одному клієнту
    client = relationship("User", back_populates="security_objects")

# 3. Таблиця інцидентів (тривог)
class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    object_id = Column(Integer, ForeignKey("security_objects.id"))

    # НОВЕ: Фіксуємо, який саме диспетчер взяв тривогу в роботу
    dispatcher_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Може бути null, якщо ще не призначено
    guard_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # ID охоронця

    status = Column(String, default="PENDING")  # PENDING, DISPATCHED, ACKNOWLEDGED (Екіпаж натиснув «Прийняв, виїжджаю»), RESOLVED, FALSE_ALARM
    created_at = Column(DateTime, default=datetime.utcnow)

    # Додаємо зв'язок: один інцидент належить одному об'єкту охорони та диспетчеру, який його обробляє
    security_object = relationship("SecurityObject")
    # Вказуємо явно через рядки, яке поле відповідає за який зв'язок
    dispatcher = relationship("User", foreign_keys="Incident.dispatcher_id")
    guard = relationship("User", foreign_keys="Incident.guard_id")

# 4. Таблиця профілів клієнтів (додаткові дані про клієнта і зв'язок з класом User)
class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True, index=True)
    # unique=True гарантує, що у юзера може бути лише один профіль
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)  # Зв'язок 1-до-1 з користувачем

    full_name = Column(String, nullable=False)
    phone_main = Column(String, nullable=False)
    phone_alt = Column(String, nullable=True)  # Запасний телефон (опціонально)
    tax_id = Column(String, nullable=True)  # ІПН (опціонально)
    birthday = Column(Date, nullable=True)  # Дата народження (опціонально)
    referral_source = Column(String, nullable=True)  # Звідки дізналися про нас (опціонально)

    contract_status = Column(String, default="ACTIVE")  # Статус контракту: ACTIVE, SUSPENDED_BY_CLIENT, SUSPENDED_BY_ADMIN, TERMINATED

    # Додаємо зв'язок: один профіль клієнта належить одному користувачу
    user = relationship("User", back_populates="profile")


# ==========================================
# НОВІ СУТНОСТІ: АУДИТ ТА ФІНАНСИ
# ==========================================

# 5. Таблиця Аудиту (Журнал дій - "Хто, що і коли зробив")
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # ID диспетчера або адміна, який зробив дію
    action = Column(String, nullable=False)  # Назва дії (наприклад, "INCIDENT_DISPATCHED")
    entity_type = Column(String, nullable=False)  # Де відбулася зміна ("incident", "client_profile")
    entity_id = Column(Integer, nullable=False)  # ID об'єкта, який змінився (наприклад, ID інциденту)
    details = Column(String, nullable=True)  # JSON або текст з деталями зміни
    timestamp = Column(DateTime, default=datetime.utcnow)  # Коли відбулася дія

# 6. Таблиця Платежів
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"))  # ID клієнта, який здійснив платіж
    object_id = Column(Integer, ForeignKey("security_objects.id"))  # ID об'єкта охорони, за який здійснено платіж
    amount = Column(Float, nullable=False)  # Сума платежу
    description = Column(String, nullable=True)  # Опис платежу (наприклад, "Оплата за місяць охорони")
    payment_method = Column(String, nullable=False)  # Метод платежу (наприклад, "card", "bank_transfer")
    status = Column(String, default="PENDING")  # Статус платежу: PENDING, COMPLETED, FAILED
    created_at = Column(DateTime, default=datetime.utcnow)  # Коли створено запис про платіж
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # ID користувача, який обробив платіж

    client = relationship("User", foreign_keys=[client_id])  # Зв'язок з користувачем-клієнтом
    security_object = relationship("SecurityObject") # Зв'язок з об'єктом
    processed_by = relationship("User", foreign_keys=[processed_by_id]) # НОВИЙ ЗВ'ЯЗОК