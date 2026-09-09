from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import text  # <-- ТУТ ЗМІНА: імпортуємо text з sqlalchemy, а не з sqlalchemy.orm
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models, schemas, security
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta
from fastapi import Body
import asyncio

# Створюємо всі таблиці наново за нашими актуальними моделями
models.Base.metadata.create_all(bind=engine)
# -----------------------------------------

app = FastAPI()

# Додаємо CORS middleware, щоб React (порт 5173) міг робити запити до FastAPI (порт 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Дозволяємо запити з будь-якого походження (на локалці це буде "http://localhost:5173")
    allow_credentials=True,
    allow_methods=["*"],  # Дозволяємо всі методи (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # Дозволяємо всі заголовки
)

# ==========================================
# МЕНЕДЖЕР WEBSOCKET З'ЄДНАНЬ
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Якщо з'єднання відвалилося несподівано
                pass

manager = ConnectionManager()

@app.websocket("/ws/incidents")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Чекаємо повідомлення від клієнта (наприклад, пінг для підтримки з'єднання)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

        

# Створюємо схему безпеки, яка шукатиме токен у заголовках запиту
token_auth_scheme = HTTPBearer()

# Функція, яка розшифровує токен і перевіряє його дійсність
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(token_auth_scheme)):
    token = credentials.credentials
    try:
        # Намагаємося розшифрувати токен нашим секретним ключем
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        return payload  # Якщо все ок, пропускаємо далі і повертаємо дані з токена (email та роль)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Термін дії токена минув")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Недійсний токен")


# Клас-контролер, який перевіряє, чи є в користувача потрібна роль
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, token_data: dict = Depends(verify_token)):
        # дістаємо роль користувача з розшифрованого токена
        user_role = token_data.get("role")

        # Якщо ролі користувача немає або вона не входить у список дозволених — відмовляємо в доступі
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail="Недостатньо прав для виконання цієї дії. Потрібен вищий рівень доступу.")
        return token_data  # Якщо все ок, пропускаємо далі і повертаємо дані з токена (email та роль)


# Створюємо конкретні "фільтри" для наших маршрутів
allow_admin = RoleChecker(["admin"])
allow_admin_or_dispatcher = RoleChecker(["admin", "dispatcher"])
allow_incident_participants = RoleChecker(["admin", "dispatcher", "guard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    try:
        # Намагаємося підключитися до бази
        with engine.connect() as connection:
            return {"message": "Ура! Підключення успішне, таблиці готові до роботи!"}
    except Exception as e:
        # Якщо сталася помилка, показуємо її
        return {"message": "Помилка підключення", "error": str(e)}


# ==========================================
# ЕНДПОІНТИ ДЛЯ КЛІЄНТІВ (КОРИСТУВАЧІВ)
# ==========================================


# Наш новий закритий ендпоінт для створення користувачів
@app.post("/users/")
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), token_data: dict = Depends(allow_admin)): 
    # 1. Перевіряємо, чи немає вже когось із таким email
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Користувач із таким email вже існує")

    # Хешуємо пароль перед збереженням
    hashed_pw = security.get_password_hash(user.password)  

    # 2. Створюємо нового користувача
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_pw, # хешований пароль
        role=user.role # роль користувача
    )

    db.add(new_user) # Додаємо нового користувача до сесії бази даних
    db.commit() # Фіксуємо зміни в базі даних
    db.refresh(new_user) # Оновлюємо об'єкт new_user, щоб отримати його id після збереження 


    return {"message": "Користувач успішно створений", "user_id": new_user.id}


# Ендпоінт для отримання списку всіх користувачів
# Замінили verify_token на allow_admin
@app.get("/users/", response_model=list[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), token_data: dict = Depends(allow_admin)):
    
    # Звертаємося до бази і просимо віддати всі записи з таблиці User
    users = db.query(models.User).all()

    result = []
    for user in users:
        result.append({
            "id": user.id,
            "email": user.email,
            "full_name": user.profile.full_name if user.profile else None,  # Додаємо повне ім'я з профілю
            "role": user.role,
            "latitude": user.latitude,
            "longitude": user.longitude
        })

    return result

# Ендпоінт для отримання повних даних профілю конкретного користувача за його ID 
@app.get("/users/{user_id}/", response_model=schemas.UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(allow_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.profile.full_name if user.profile else None,  # Додаємо повне ім'я з профілю
        "role": user.role,
        "latitude": user.latitude,
        "longitude": user.longitude
    }

# Ендпоінт для редагування повних даних профілю конкретного користувача (тільки для адмінів)
@app.put("/users/{user_id}/", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), token_data: dict = Depends(allow_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    # Оновлюємо поля користувача, якщо вони передані в запиті (якщо порожні — залишаємо старі значення)
    if user_update.email is not None:
        user.email = user_update.email
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.latitude is not None:
        user.latitude = user_update.latitude
    if user_update.longitude is not None:
        user.longitude = user_update.longitude

    db.commit()  # Фіксуємо зміни в базі даних
    db.refresh(user)  # Оновлюємо об'єкт user

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.profile.full_name if user.profile else None,  # Додаємо повне ім'я з профілю
        "role": user.role,
        "latitude": user.latitude,
        "longitude": user.longitude
    }

@app.put("/client-profiles/{profile_id}/", response_model=schemas.ClientProfileResponse)
def update_client_profile(
    profile_id: int,
    profile_update: schemas.ClientProfileUpdate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher)  # Або allow_admin, якщо диспетчеру не можна
):
    # 1. Знаходимо профіль у базі
    profile = db.query(models.ClientProfile).filter(models.ClientProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль клієнта не знайдено")

    # 2. Оновлюємо поля
    if profile_update.full_name is not None:
        profile.full_name = profile_update.full_name
    if profile_update.phone_main is not None:
        profile.phone_main = profile_update.phone_main
    if profile_update.phone_alt is not None:
        profile.phone_alt = profile_update.phone_alt
    if profile_update.tax_id is not None:
        profile.tax_id = profile_update.tax_id
    if profile_update.birthday is not None:
        profile.birthday = profile_update.birthday
    if profile_update.contract_status is not None:
        profile.contract_status = profile_update.contract_status

    db.commit()
    db.refresh(profile)

    return profile

# ==========================================
# Ендпоінт для логіну та отримання токена
# ==========================================

@app.post("/login/")
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    # 1. Шукаємо юзера в базі за email
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    
    # 2. Якщо юзера немає АБО пароль не підійшов — відмовляємо в доступі
    if not user or not security.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неправильний email або пароль")
    
    # 3. Якщо все ок — видаємо токен (кладемо туди email та роль)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# ==========================================
# ЕНДПОІНТИ ДЛЯ ОБ'ЄКТІВ ОХОРОНИ
# ==========================================

# Створення нового об'єкта (тільки для адмінів та диспетчерів)
@app.post("/objects/", response_model=schemas.SecurityObjectResponse)
def create_security_object(
    obj: schemas.SecurityObjectCreate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher) #контролює, чи є користувач адміном або диспетчером
):
    # 1. Перевіряємо, чи існує користувач із таким client_id
    client = db.query(models.User).filter(models.User.id == obj.client_id).first()
    if not client:
        raise HTTPException(status_code=400, detail="Користувача з таким client_id не існує")

    # 2. Створюємо новий об'єкт охорони
    new_object = models.SecurityObject(
        name=obj.name,
        address=obj.address,
        client_id=obj.client_id,
        latitude=obj.latitude,    # Зберігаємо широту
        longitude=obj.longitude,  # Зберігаємо довготу
        instructions=obj.instructions,
        status=obj.status,             
        monthly_fee=obj.monthly_fee  
    )

    db.add(new_object)  # Додаємо новий об'єкт до сесії бази даних
    db.commit()         # Фіксуємо зміни в базі даних
    db.refresh(new_object)  # Оновлюємо об'єкт new_object, щоб отримати його id після збереження

    return new_object  # Повертаємо створений об'єкт у відповіді


# Отримання списку всіх об'єктів
@app.get("/objects/", response_model=list[schemas.SecurityObjectResponse])
def get_security_objects(
        db: Session = Depends(get_db),
        token_data: dict = Depends(allow_incident_participants) #контролює, чи є користувач адміном, диспетчером або охоронцем
        ):
    # Звертаємося до бази і просимо віддати всі записи з таблиці SecurityObject
    objects = db.query(models.SecurityObject).all()
    result = []
    for obj in objects:
        client_email = obj.client.email if obj.client else f"ID #{obj.client_id}"
        result.append({
            "id": obj.id,
            "name": obj.name,
            "address": obj.address,
            "latitude": obj.latitude,     # <-- ДОДАЛИ ШИРОТУ
            "longitude": obj.longitude,   # <-- ДОДАЛИ ДОВГОТУ
            "client_id": obj.client_id,
            "client_email": client_email,
            "instructions": obj.instructions,
            "status": obj.status,
            "monthly_fee": obj.monthly_fee,
            "paid_until": obj.paid_until
        })
    return result

# Редагування об'єкта охорони (тільки для адмінів)
# Редагування об'єкта охорони (тільки для адмінів)
@app.put("/objects/{object_id}/", response_model=schemas.SecurityObjectResponse)
def update_security_object(
    object_id: int,
    obj_update: schemas.SecurityObjectUpdate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin)  # Тільки адмін може редагувати об'єкт
):
    # 1. Знаходимо об'єкт у базі
    obj = db.query(models.SecurityObject).filter(models.SecurityObject.id == object_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Об'єкт охорони не знайдено")

    # === ЛОГІКА ПЕРЕРАХУНКУ ДНІВ ПРИ ЗМІНІ ТАРИФУ (PRORATION) ===
    # Якщо тариф передано, він відрізняється від старого, і новий тариф більше нуля
    if obj_update.monthly_fee is not None and obj_update.monthly_fee != obj.monthly_fee and obj_update.monthly_fee > 0:
        old_fee = obj.monthly_fee
        new_fee = obj_update.monthly_fee
        today = date.today()

        # Робимо перерахунок тільки якщо об'єкт має оплачені дні в майбутньому і старий тариф теж був > 0
        if obj.paid_until and obj.paid_until > today and old_fee > 0:
            remaining_days = (obj.paid_until - today).days
            
            # Скільки "грошей" залишилося на балансі за старим тарифом
            leftover_money = (remaining_days / 30.0) * old_fee
            
            # На скільки днів вистачить цих грошей за новим тарифом
            new_remaining_days = int((leftover_money / new_fee) * 30)
            
            # Встановлюємо нову дату (сьогодні + нові дні)
            obj.paid_until = today + timedelta(days=new_remaining_days)
    # ==========================================================

    # 2. Оновлюємо інші поля
    if obj_update.name is not None:
        obj.name = obj_update.name
    if obj_update.address is not None:
        obj.address = obj_update.address
    if obj_update.latitude is not None:
        obj.latitude = obj_update.latitude
    if obj_update.longitude is not None:
        obj.longitude = obj_update.longitude
    if obj_update.instructions is not None:
        obj.instructions = obj_update.instructions
    if obj_update.status is not None:
        obj.status = obj_update.status
    if obj_update.monthly_fee is not None:
        obj.monthly_fee = obj_update.monthly_fee
        
    # Якщо адмін вручну передав нову дату в формі, вона пріоритетна і перепише наш автоматичний перерахунок
    if obj_update.paid_until is not None:
        obj.paid_until = obj_update.paid_until

    db.commit()  # Фіксуємо зміни в базі даних
    db.refresh(obj)  # Оновлюємо об'єкт obj

    return obj  # Повертаємо оновлений об'єкт у відповіді  # Повертаємо оновлений об'єкт у відповіді   


# Ендпоінт для реєстрації оплати за об'єкт охорони (тільки для адмінів та бухгалтерів)

@app.post("/objects/{object_id}/pay/", response_model=schemas.SecurityObjectResponse)
def process_payment(
    object_id: int, 
    payment: schemas.PaymentCreate, 
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin)
):

    # --- ДІСТАЄМО ЮЗЕРА, ЯКИЙ РОБИТЬ ЗАПИТ ---
    current_user_email = token_data.get("sub")
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()
    
    obj = db.query(models.SecurityObject).filter(models.SecurityObject.id == object_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Об'єкт не знайдено")
    
    if obj.monthly_fee <= 0:
        raise HTTPException(status_code=400, detail="Для цього об'єкта не встановлена абонплата")

    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Сума оплати має бути більшою за нуль")

    # 1. Визначаємо базову дату (якщо оплачено наперед — беремо paid_until, якщо борг — беремо сьогодні)
    today = date.today()
    if obj.paid_until and obj.paid_until > today:
        base_date = obj.paid_until
    else:
        base_date = today

    # 2. Рахуємо кількість днів (беремо середнє 30 днів у місяці)
    days_to_add = int((payment.amount / obj.monthly_fee) * 30)

    # 3. Обчислюємо нову дату
    new_paid_until = base_date + timedelta(days=days_to_add)
    obj.paid_until = new_paid_until

    # 4. Якщо був борг, автоматично вмикаємо охорону
    if obj.status == "SUSPENDED_DEBT":
        obj.status = "ACTIVE"

    # 5. === СТВОРЮЄМО ЗАПИС ПРО ПЛАТІЖ ===
    new_payment = models.Payment(
        object_id=obj.id,
        processed_by_id=current_user.id if current_user else None, # Записуємо касира
        client_id=obj.client_id,
        amount=payment.amount,
        description=f"Ручне поповнення балансу",
        payment_method="cash",
        status="COMPLETED"
    )
    db.add(new_payment)
    # ===================================
    
    db.commit()
    db.refresh(obj)
    
    return obj

# Ендпоінт для отримання історії оплат за конкретний об'єкт охорони (тільки для адмінів та диспетчерів)
@app.get("/objects/{object_id}/payments/", response_model=list[schemas.PaymentResponse])
def get_object_payments(
    object_id: int, 
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher)
):
    # Знаходимо всі платежі для об'єкта, найновіші зверху
    payments = db.query(models.Payment)\
        .filter(models.Payment.object_id == object_id)\
        .order_by(models.Payment.created_at.desc())\
        .all()
    return payments

# ==========================================
# ЕНДПОІНТИ ДЛЯ ІНЦИДЕНТІВ
# ==========================================

# 1. Створення тривоги (Імітація спрацювання сигналізації)
# Наразі дозволимо створювати тривогу будь-якому авторизованому юзеру 
# (у майбутньому це робитиме IoT-хаб або клієнт зі свого додатку)

@app.post("/incidents/", response_model=schemas.IncidentResponse)
async def create_incident(
    incident: schemas.IncidentCreate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token) # Токен обов'язковий
):

    # 1. Знаходимо об'єкт охорони в базі
    security_object = db.query(models.SecurityObject).filter(models.SecurityObject.id == incident.object_id).first()
    if not security_object:
        raise HTTPException(status_code=404, detail="Об'єкт охорони не знайдено")

    # 2. Дістаємо email користувача з токена і знаходимо його в базі, щоб дізнатися його ID
    current_user_email = token_data.get("sub")
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    # 3. ПЕРЕВІРКА ВЛАСНОСТІ (Захист від IDOR)
    # Якщо це клієнт, він має право активувати тривогу ТІЛЬКИ на своєму об'єкті
    if current_user.role == "client" and security_object.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Помилка безпеки: Ви не можете викликати тривогу на чужому об'єкті!")

    # 4. Якщо перевірка пройдена (або це адмін), створюємо інцидент
    new_incident = models.Incident(
        object_id=incident.object_id,
        status="PENDING"
    )

    db.add(new_incident)  # Додаємо новий інцидент до сесії бази даних
    db.commit()           # Фіксуємо зміни в базі даних
    db.refresh(new_incident)  # Оновлюємо об'єкт new_incident   


    # Сповіщаємо всіх через WebSocket про нову тривогу
    await manager.broadcast({
        "type": "NEW_INCIDENT",
        "incident_id": new_incident.id,
        "object_id": new_incident.object_id,
        "status": new_incident.status
    })

    return new_incident  # Повертаємо створений інцидент у відповіді



# 2. Отримання списку всіх інцидентів (розумна фільтрація за роллю)
@app.get("/incidents/", response_model=list[schemas.IncidentResponse])
def get_incidents(
    db: Session = Depends(get_db),
    # ЗМІНА 1: Дозволяємо доступ і адмінам, і диспетчерам, і екіпажам
    token_data: dict = Depends(allow_incident_participants)  
):
    # Дізнаємося, хто саме робить запит
    user_role = token_data.get("role")
    user_email = token_data.get("sub")

    # ЗМІНА 2: Фільтруємо базу залежно від ролі
    if user_role == "guard":
        # Знаходимо ID поточного охоронця
        current_guard = db.query(models.User).filter(models.User.email == user_email).first()
        # Охоронець отримує ТІЛЬКИ ті інциденти, де він призначений екіпажем
        incidents = db.query(models.Incident).filter(models.Incident.guard_id == current_guard.id).all()
    else:
        # Адмін та диспетчер бачать абсолютно всі інциденти
        incidents = db.query(models.Incident).all()

    result = []
    for inc in incidents:
        # Безпечно витягуємо дані через зв'язки SQLAlchemy
        obj_name = inc.security_object.name if inc.security_object else f"Об'єкт #{inc.object_id}"
        obj_address = inc.security_object.address if inc.security_object else None
        obj_instructions = inc.security_object.instructions if inc.security_object else None

        # Витягуємо дані власника та його профілю через зв'язки
        client_name = None
        client_phone = None
        if inc.security_object and inc.security_object.client:
            client_user = inc.security_object.client
            if client_user.profile:
                client_name = client_user.profile.full_name
                client_phone = client_user.profile.phone_main

        disp_email = inc.dispatcher.email if inc.dispatcher else None
        guard_email = inc.guard.email if inc.guard else None

        result.append({
            "id": inc.id,
            "object_id": inc.object_id,
            "object_name": obj_name,
            "dispatcher_id": inc.dispatcher_id,
            "dispatcher_email": disp_email,
            "guard_id": inc.guard_id,
            "guard_email": guard_email,
            "status": inc.status,
            "created_at": inc.created_at,
            "object_address": obj_address,
            "object_latitude": inc.security_object.latitude if inc.security_object else None,   # ДОДАНО
            "object_longitude": inc.security_object.longitude if inc.security_object else None, # ДОДАНО
            "object_instructions": obj_instructions,
            "client_name": client_name,
            "client_phone": client_phone
        })
    return result

# Оновлення статусу тривоги (ТІЛЬКИ ДЛЯ АДМІНІВ, ДИСПЕТЧЕРІВ ТА ЕКІПАЖУ в залежності від статусу)
@app.put("/incidents/{incident_id}/", response_model=schemas.IncidentResponse)
async def update_incident_status(
    incident_id: int,
    incident_update: schemas.IncidentUpdate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_incident_participants)  # Тільки адмін або диспетчер або охоронець (рівень доступу визначаємо далі)
):
    # 1. Знаходимо інцидент у базі
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Інцидент не знайдено")

    # 2. Визначаємо, ХТО саме робить цей запит (дістаємо юзера по email з токена)
    current_user_email = token_data.get("sub")
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()
    user_role = current_user.role
    target_status = incident_update.status


    # 3. МАТРИЦЯ ПРАВ НА ЗМІНУ СТАТУСІВ (Бізнес-логіка)

    # ПРАВИЛО 1: DISPATCHED можуть ставити тільки Адмін або Диспетчер
    if target_status == "DISPATCHED":
        if user_role not in ["admin", "dispatcher"]:
            raise HTTPException(status_code=403, detail="Тільки диспетчер або адмін може відправити екіпаж.")
        if incident.dispatcher_id is None:
            incident.dispatcher_id = current_user.id  # Призначаємо диспетчера, який взяв тривогу в роботу

        # Призначаємо охоронця на об'єкт (обов'язково за роллю guard!)
        if incident_update.guard_id:
            # ===  ПЕРЕВІРКА ВІД БАГІВ ===
            assigned_guard = db.query(models.User).filter(models.User.id == incident_update.guard_id).first()
            if not assigned_guard or assigned_guard.role != "guard":
                raise HTTPException(
                    status_code=400, 
                    detail="Недійсний guard_id: такого користувача не існує або він не є охоронцем."
                )
            # =================================
            incident.guard_id = incident_update.guard_id
        else:
            raise HTTPException(status_code=400, detail="Для статусу DISPATCHED необхідно вказати guard_id.")
        
        

    # ПРАВИЛО 2: ACKNOWLEDGED може ставити тільки Охоронець (екіпаж прийняв виклик)
    elif target_status == "ACKNOWLEDGED":
        if user_role != "guard":
            raise HTTPException(status_code=403, detail="Тільки охоронець може підтвердити прийняття виклику.")
        # Перевіряємо, чи цей охоронець призначений на цей інцидент
        if incident.dispatcher_id is None or incident.guard_id is None:
            raise HTTPException(status_code=400, detail="Цей інцидент ще не призначено диспетчером.")
        if incident.guard_id != current_user.id:
            raise HTTPException(status_code=403, detail="Доступ заборонено (спроба прийняти чужий виклик).")

    # ПРАВИЛО 3: RESOLVED або FALSE_ALARM знову ставить тільки Адмін або Диспетчер після підтвердження екіпажем і клієнтом
    elif target_status in ["RESOLVED", "FALSE_ALARM"]:
        if user_role not in ["admin", "dispatcher"]:
            raise HTTPException(status_code=403, detail="Тільки диспетчер або адмін може закрити інцидент.")
        # Перевіряємо, чи екіпаж підтвердив прийняття виклику
        if incident.status != "ACKNOWLEDGED":
            raise HTTPException(status_code=400, detail="Інцидент ще не підтверджено екіпажем.")    
    else:
        raise HTTPException(status_code=400, detail="Невідомий або заборонений статус.")

    
    # 4. Оновлюємо статус інциденту
    incident.status = target_status
    
    # 5. === АУДИТОРСЬКИЙ СЛІД (Невидимий запис у журнал) ===
    
    # Створюємо розумне текстове повідомлення залежно від статусу
    if target_status == "DISPATCHED":
            detailed_msg = f"Диспетчер {current_user.email} відправив Екіпаж #{incident.guard_id} на Інцидент #{incident.id} (Об'єкт #{incident.object_id})"
    elif target_status == "ACKNOWLEDGED":
            detailed_msg = f"Охоронець {current_user.email} підтвердив прийняття Інциденту #{incident.id} (Об'єкт #{incident.object_id})"
    else:  # RESOLVED або FALSE_ALARM
            detailed_msg = f"Диспетчер {current_user.email} закрив Інцидент #{incident.id} (Об'єкт #{incident.object_id}) зі статусом {target_status}"  

    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"STATUS_CHANGED_TO_{target_status}",
        entity_type="incident",
        entity_id=incident.id,
        details=detailed_msg
    )
   
    # 6. Додаємо запис аудиту до сесії бази даних
    db.add(audit_log) # Додаємо запис аудиту в сесію


    db.commit()  # Фіксуємо зміни в базі даних
    db.refresh(incident)  # Оновлюємо об'єкт incident

# Сповіщаємо всіх через WebSocket про зміну статусу (наприклад, екіпаж прийняв виклик)
    await manager.broadcast({
        "type": "UPDATE_INCIDENT",
        "incident_id": incident.id,
        "status": incident.status,
        "guard_id": incident.guard_id
    })

    return incident  # Повертаємо оновлений інцидент у відповіді


# ==========================================
# ЕНДПОІНТИ ДЛЯ ПРОФІЛІВ КЛІЄНТІВ
# ==========================================

# Створення профілю клієнта (тільки для адмінів та диспетчерів)
@app.post("/client-profiles/", response_model=schemas.ClientProfileResponse)
def create_client_profile(
    profile: schemas.ClientProfileCreate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher)  # Тільки адмін або диспетчер
):
    # 1. Перевіряємо, чи існує користувач із таким user_id
    user = db.query(models.User).filter(models.User.id == profile.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача з таким user_id не існує")

    # 2. Перевіряємо, чи вже є профіль для цього користувача (1-до-1)
    existing_profile = db.query(models.ClientProfile).filter(models.ClientProfile.user_id == profile.user_id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Профіль для цього користувача вже існує")

    # 3. Створюємо новий профіль клієнта
    new_profile = models.ClientProfile(
        user_id=profile.user_id,
        full_name=profile.full_name,
        phone_main=profile.phone_main,
        phone_alt=profile.phone_alt,
        tax_id=profile.tax_id,
        birthday=profile.birthday,
        referral_source=profile.referral_source,
        contract_status=profile.contract_status
    )

    db.add(new_profile)  # Додаємо новий профіль до сесії бази даних
    db.commit()          # Фіксуємо зміни в базі даних
    db.refresh(new_profile)  # Оновлюємо об'єкт new_profile

    return new_profile  # Повертаємо створений профіль у відповіді

# отримуємо всі профілі клієнтів (тільки для адмінів та диспетчерів)

@app.get("/client-profiles/")
def get_all_client_profiles(db: Session = Depends(get_db)):
    # Знаходимо всіх юзерів з роллю client і підтягуємо їхні профілі
    clients = db.query(models.User).filter(models.User.role == "client").all()
    result = []
    for user in clients:
        profile = user.profile
        result.append({
            "id": profile.id if profile else None,
            "user_id": user.id,
            "email": user.email,
            "full_name": profile.full_name if profile else "Профіль не заповнено",
            "phone_main": profile.phone_main if profile else "—",
            "contract_status": profile.contract_status if profile else "NO_PROFILE"
        })
    return result

# Отримання профілю клієнта за його user_id (тільки для адмінів та диспетчерів)
@app.get("/client-profiles/{user_id}/", response_model=schemas.ClientProfileResponse)
def get_client_profile(
    user_id: int,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher)  # Тільки адмін або диспетчер
):
    # Знаходимо профіль у базі за user_id
    profile = db.query(models.ClientProfile).filter(models.ClientProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль клієнта не знайдено")
    
    return profile  # Повертаємо знайдений профіль у відповіді



# ==========================================
# ЕНДПОІНТИ ДЛЯ ЖУРНАЛУ АУДИТУ
# ==========================================

@app.get("/audit-logs/", response_model=list[schemas.AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin)  # Тільки адмін може переглядати журнал аудиту
):

    # Підтягуємо логи разом із користувачами, щоб не робити зайвих запитів
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()

    result = []
    for log in logs:
        # Знаходимо юзера, який зробив дію
        user = db.query(models.User).filter(models.User.id == log.user_id).first()
        user_email = user.email if user else f"ID #{log.user_id}"

        # Якщо старий лог має сухий текст — зробимо його автоматично читабельним
        details = log.details
        if not details or "змінив статус на" in details:
            details = f"Користувач {user_email} оновив сутність #{log.entity_id}"

        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user_email,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": details,
            "timestamp": log.timestamp
        })
        
    return result


# Ендпоінт для оновлення координат охоронця (тільки для ролі guard)
@app.put("/guards/location/")
def update_guard_location(
    lat: float,
    lon: float,
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_incident_participants)  # Тільки адмін або диспетчер або охоронець
):
    # Перевіряємо, чи користувач є охоронцем
    current_user_email = token_data.get("sub")
    user = db.query(models.User).filter(models.User.email == current_user_email).first()
    if not user or user.role != "guard":
        raise HTTPException(status_code=403, detail="Доступ заборонено: лише охоронець може оновлювати свої координати.")

    # Оновлюємо координати охоронця
    user.latitude = lat
    user.longitude = lon
    db.commit()  # Фіксуємо зміни в базі даних

    return {"message": "Координати успішно оновлено", "latitude": lat, "longitude": lon}




# ==========================================
# ЕНДПОІНТИ ДЛЯ ПЛАТЕЖІВ
# ==========================================

# Ендпоінт для отримання історії всіх платежів (тільки для адмінів та диспетчерів)
@app.get("/payments/", response_model=list[schemas.PaymentFullResponse])
def get_all_payments_history(
    db: Session = Depends(get_db),
    token_data: dict = Depends(allow_admin_or_dispatcher)
):
    # Отримуємо всі платежі, відсортовані від найновішого до найстарішого
    payments = db.query(models.Payment).order_by(models.Payment.created_at.desc()).all()
    
    result = []
    for p in payments:
        # Збираємо дані об'єкта
        obj_name = p.security_object.name if p.security_object else "Видалений об'єкт"
        
        # Збираємо дані клієнта з його профілю
        client_name = "Невідомо"
        client_phone = "—"
        if p.client and p.client.profile:
            client_name = p.client.profile.full_name
            client_phone = p.client.profile.phone_main
            
        # Хто прийняв платіж
        processed_by_email = p.processed_by.email if p.processed_by else "Система"

        result.append({
            "id": p.id,
            "amount": p.amount,
            "description": p.description,
            "created_at": p.created_at,
            "object_name": obj_name,
            "client_name": client_name,
            "client_phone": client_phone,
            "processed_by_email": processed_by_email
        })
        
    return result


# ==========================================
# ОСОБИСТИЙ КАБІНЕТ КЛІЄНТА (CLIENT DASHBOARD)
# ==========================================
allow_clients = RoleChecker(["client"])

@app.get("/my/profile/", response_model=schemas.ClientProfileResponse)
def get_my_profile(db: Session = Depends(get_db), token_data: dict = Depends(allow_clients)):
    user = db.query(models.User).filter(models.User.email == token_data.get("sub")).first()
    if not user.profile:
        raise HTTPException(status_code=404, detail="Профіль ще не заповнено адміністратором")
    return user.profile

@app.get("/my/objects/", response_model=list[schemas.SecurityObjectResponse])
def get_my_objects(db: Session = Depends(get_db), token_data: dict = Depends(allow_clients)):
    user = db.query(models.User).filter(models.User.email == token_data.get("sub")).first()
    objects = db.query(models.SecurityObject).filter(models.SecurityObject.client_id == user.id).all()
    
    result = []
    for obj in objects:
        result.append({
            "id": obj.id,
            "name": obj.name,
            "address": obj.address,
            "latitude": obj.latitude,
            "longitude": obj.longitude,
            "client_id": obj.client_id,
            "client_email": user.email,
            "instructions": obj.instructions,
            "status": obj.status,
            "monthly_fee": obj.monthly_fee,
            "paid_until": obj.paid_until
        })
    return result

@app.get("/my/payments/", response_model=list[schemas.PaymentResponse])
def get_my_payments(db: Session = Depends(get_db), token_data: dict = Depends(allow_clients)):
    user = db.query(models.User).filter(models.User.email == token_data.get("sub")).first()
    payments = db.query(models.Payment).filter(models.Payment.client_id == user.id).order_by(models.Payment.created_at.desc()).all()
    return payments