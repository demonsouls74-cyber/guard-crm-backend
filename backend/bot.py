import asyncio
import logging
import os
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command
from aiogram.fsm.storage.memory import MemoryStorage
from backend.database import SessionLocal
from backend import models

# Завантажуємо секретні змінні з файлу .env (якщо він є)
load_dotenv()

# Дістаємо токен із середовища
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("Помилка: TELEGRAM_BOT_TOKEN не знайдено у змінних середовища!")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())


# Обробник команди /start (працює при переході за посиланням з CRM)
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    args = message.text.split()
    
    # Якщо користувач просто відкрив бота без токена
    if len(args) < 2:
        await message.answer(
            "Привіт! Це офіційний бот системи безпеки.\n"
            "Щоб зв'язати свій акаунт, перейдіть у свій профіль на сайті CRM та натисніть «Підключити Telegram»."
        )
        return

    sync_token = args[1]
    telegram_chat_id = str(message.from_user.id)

    db = SessionLocal()
    try:
        # Шукаємо користувача за токеном синхронізації
        user = db.query(models.User).filter(models.User.telegram_sync_token == sync_token).first()
        
        if not user:
            await message.answer("❌ Недійсний або застарілий токен підключення. Згенеруйте нове посилання в CRM.")
            return

        # Прив'язуємо chat_id і стираємо використаний токен
        user.telegram_chat_id = telegram_chat_id
        user.telegram_sync_token = None
        db.commit()

        await message.answer(
            f"✅ Акаунт успішно підключено!\n"
            f"Ваша роль у системі: <b>{user.role.upper()}</b>.\n"
            f"Тепер ви отримуватимете оперативні сповіщення сюди."
        , parse_mode="HTML")

    except Exception as e:
        logging.error(f"Помилка при прив'язці Telegram: {e}")
        await message.answer("⚠️ Сталася помилка на сервері. Спробуйте пізніше.")
    finally:
        db.close()




# Обробка натискання кнопки "ПРИЙНЯТИ ВИКЛИК"
@dp.callback_query(F.data.startswith("ack_"))
async def process_acknowledge(callback: types.CallbackQuery):
    # Дістаємо ID інциденту з callback_data (наприклад, з "ack_5" отримаємо 5)
    incident_id = int(callback.data.split("_")[1])
    telegram_chat_id = str(callback.from_user.id)
    
    db = SessionLocal()
    try:
        # 1. Перевіряємо, хто натиснув кнопку
        user = db.query(models.User).filter(models.User.telegram_chat_id == telegram_chat_id).first()
        if not user or user.role != "guard":
            await callback.answer("Відмовлено в доступі. Ви не є охоронцем.", show_alert=True)
            return
            
        # 2. Знаходимо інцидент
        incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
        if not incident:
            await callback.answer("Інцидент не знайдено або видалено.", show_alert=True)
            return
            
        # 3. Перевіряємо, чи цей інцидент призначений саме цьому екіпажу
        if incident.guard_id != user.id:
            await callback.answer("Цей виклик призначено іншому екіпажу!", show_alert=True)
            return

        # 4. Перевіряємо статус (може він вже прийнятий)
        if incident.status == "ACKNOWLEDGED":
            await callback.answer("Ви вже прийняли цей виклик раніше.", show_alert=False)
            return
        elif incident.status != "DISPATCHED":
            await callback.answer("Цей виклик вже закрито диспетчером.", show_alert=True)
            return
            
        # 5. Оновлюємо статус у базі!
        incident.status = "ACKNOWLEDGED"
        
        # Невидимо логуємо дію в аудит
        audit_log = models.AuditLog(
            user_id=user.id,
            action="STATUS_CHANGED_TO_ACKNOWLEDGED",
            entity_type="incident",
            entity_id=incident.id,
            details=f"Охоронець {user.email} підтвердив виклик через Telegram"
        )
        db.add(audit_log)
        db.commit()
        
        # 6. Змінюємо повідомлення в телеграмі (прибираємо кнопку і пишемо, що виклик прийнято)
        new_text = callback.message.html_text + "\n\n✅ <b>ВИКЛИК УСПІШНО ПРИЙНЯТО ВАМИ!</b>"
        await callback.message.edit_text(text=new_text, parse_mode="HTML")
        await callback.answer("Виклик прийнято! Прямуйте на об'єкт.")
        
    except Exception as e:
        logging.error(f"Помилка при обробці callback: {e}")
        await callback.answer("Сталася помилка на сервері.")
    finally:
        db.close()


async def main():
    logging.info("Бот запущено і готовий приймати повідомлення...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
