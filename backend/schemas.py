from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date

# Ця схема описує, які дані ми очікуємо отримати від адміністратора
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str  # "client", "guard", "dispatcher"


# Схема для того, ЩО ми повертаємо при запиті (без пароля!)
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    latitude: Optional[float] = None   
    longitude: Optional[float] = None  

    class Config:
        from_attributes = True  # Дозволяє Pydantic працювати з ORM-моделями SQLAlchemy


# Схема для логіну (те, що користувач вводить у форму)
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Схема для редагування користувача (тільки для адмінів)
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None  # "client", "guard", "dispatcher"
    latitude: Optional[float] = None   
    longitude: Optional[float] = None

# Схема для оновлення профілю клієнта
class ClientProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_main: Optional[str] = None
    phone_alt: Optional[str] = None
    tax_id: Optional[str] = None
    birthday: Optional[date] = None
    contract_status: Optional[str] = None

# ==========================================
# СХЕМИ ДЛЯ ОБ'ЄКТІВ ОХОРОНИ
# ==========================================

# Схема для створення об'єкта (те, що ми отримуємо від диспетчера)
class SecurityObjectCreate(BaseModel):
    name: str
    address: str
    latitude: Optional[float] = None   #  Широта
    longitude: Optional[float] = None  #  Довгота
    client_id: int  # ID користувача, який є власником об'єкта
    instructions: Optional[str] = None  # Інструкції для екіпажу на випадок тривоги (необов'язкове поле)
    status: Optional[str] = "ACTIVE"
    monthly_fee: Optional[float] = 500.0
    paid_until: Optional[date] = None
    
# Схема для відповіді (те, що ми повертаємо на фронтенд)
class SecurityObjectResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: Optional[float] = None   #  Широта
    longitude: Optional[float] = None  #  Довгота
    client_id: int
    client_email: Optional[str] = None  #  Пошта власника об'єкта
    instructions: Optional[str] = None
    status: str
    monthly_fee: float
    paid_until: Optional[date] = None

    class Config:
        from_attributes = True  # Дозволяє Pydantic працювати з ORM-моделями SQLAlchemy

# Схема для оновлення об'єкта охорони
class SecurityObjectUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    instructions: Optional[str] = None
    status: Optional[str] = None
    monthly_fee: Optional[float] = None
    paid_until: Optional[date] = None  # ВАЖЛИВО!




# ==========================================
# СХЕМИ ДЛЯ ПЛАТЕЖІВ
# ==========================================

class PaymentCreate(BaseModel):
    amount: float

class PaymentResponse(BaseModel):
    id: int
    object_id: int
    client_id: int
    amount: float
    description: Optional[str] = None
    payment_method: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentFullResponse(BaseModel):
    id: int
    amount: float
    description: Optional[str] = None
    created_at: datetime
    object_name: str
    client_name: str
    client_phone: str
    processed_by_email: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# СХЕМИ ДЛЯ ІНЦИДЕНТІВ (ТРИВОГ)
# ==========================================

# Коли надходить тривога, нам достатньо знати лише ID об'єкта
class IncidentCreate(BaseModel):
    object_id: int  # ID об'єкта охорони, на якому спрацювала тривога

# Коли ми повертаємо інформацію про тривогу, нам потрібно більше деталей (що побачить диспетчер на фронтенді)
class IncidentResponse(BaseModel):
    id: int
    object_id: int
    object_name: Optional[str] = None        # Назва об'єкта (наприклад, "Магазин АТБ")
    object_address: Optional[str] = None     # Адреса об'єкта (наприклад, "вул. Шевченка, 12")
    object_instructions: Optional[str] = None  # Інструкції для екіпажу на випадок тривоги
    client_name: Optional[str] = None          # Ім'я власника об'єкта (клієнта)
    client_phone: Optional[str] = None                 # Телефон власника об'єкта (клієнта)
    status: str  # PENDING, ACKNOWLEDGED, RESOLVED, FALSE_ALARM
    created_at: datetime
    dispatcher_id: Optional[int] = None  #  Хто взяв у роботу
    dispatcher_email: Optional[str] = None   # Пошта диспетчера
    guard_id: Optional[int] = None  #  Хто виїхав на об'єкт
    guard_email: Optional[str] = None        # Пошта екіпажу/охоронця
    
    class Config:
        from_attributes = True  # Дозволяє Pydantic працювати з ORM-моделями SQLAlchemy

# Схема для оновлення інциденту (передаємо тільки новий статус)
class IncidentUpdate(BaseModel):
    status: str
    guard_id: Optional[int] = None  # Диспетчер зможе передати ID охоронця

# ==========================================
# СХЕМИ ДЛЯ ПРОФІЛЮ КЛІЄНТА
# ==========================================

# Схема для створення профілю (заповнює адмін)
class ClientProfileCreate(BaseModel):
    user_id: int  # ID користувача, для якого створюється профіль
    full_name: str
    phone_main: str
    phone_alt: Optional[str] = None  # Запасний телефон (опціонально)
    tax_id: Optional[str] = None  # ІПН (опціонально)
    birthday: Optional[date] = None  # Дата народження (опціонально)
    referral_source: Optional[str] = None  # Звідки дізналися про нас (опціонально)
    contract_status: Optional[str] = None  # Статус контракту (опціонально)

# Схема для відповіді (те, що ми повертаємо на фронтенд)
class ClientProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    phone_main: str
    phone_alt: Optional[str] = None
    tax_id: Optional[str] = None
    birthday: Optional[date] = None
    referral_source: Optional[str] = None
    contract_status: Optional[str] = None

    class Config:
        from_attributes = True  # Дозволяє Pydantic працювати з ORM-моделями SQLAlchemy 



# ==========================================
# СХЕМИ ДЛЯ ЖУРНАЛУ АУДИТУ
# ==========================================
class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: int
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True