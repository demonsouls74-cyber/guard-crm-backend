import jwt
from datetime import datetime, timedelta
import bcrypt

SECRET_KEY = "super_secret_dispatch_key"
ALGORITHM = "HS256"

def get_password_hash(password: str) -> str:
    # Обрізаємо пароль до 72 байт, щоб уникнути помилки bcrypt, і генеруємо хеш
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=360)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)