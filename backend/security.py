import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

# Секретний ключ для підпису токенів (у реальному проєкті його ховають, але поки залишимо так)
SECRET_KEY = "super_secret_dispatch_key"
ALGORITHM = "HS256"  # Алгоритм підпису токенів


# Вказуємо, що будемо використовувати алгоритм bcrypt (стандарт індустрії)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Функція, яка бере звичайний пароль і повертає зашифрований хеш
def get_password_hash(password: str):
    return pwd_context.hash(password)

# 1. Нова функція: перевіряє, чи збігається введений пароль із зашифрованим у базі
def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

# 2. Нова функція: створює JWT-токен (браслет), який діятиме 1 годину
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=360)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt