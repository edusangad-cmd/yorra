import sys
import asyncio
from app.db.session import async_session_maker
from app.models.models import User
from sqlalchemy import select

async def create_user(telegram_id: str, username: str, full_name: str) -> None:
    async with async_session_maker() as session:
        # Check if user already exists by telegram_id
        result = await session.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalars().first()
        if user:
            print(f"Error: Ya existe un usuario con Telegram ID '{telegram_id}' (nombre: {user.full_name}, usuario: @{user.username}).")
            sys.exit(1)

        # Check if username already exists
        if username:
            result = await session.execute(select(User).where(User.username == username))
            user = result.scalars().first()
            if user:
                print(f"Error: Ya existe un usuario con el nombre de usuario '{username}' (nombre: {user.full_name}, ID: {user.telegram_id}).")
                sys.exit(1)

        new_user = User(
            telegram_id=telegram_id,
            username=username if username else None,
            full_name=full_name,
            points=0
        )
        session.add(new_user)
        await session.commit()
        print(f"✅ ¡Usuario creado con éxito!")
        print(f"  - Nombre: {full_name}")
        print(f"  - Usuario: @{username}" if username else "  - Usuario: (Sin usuario)")
        print(f"  - Telegram ID (usado para iniciar sesión): {telegram_id}")

def main() -> None:
    if len(sys.argv) >= 4:
        telegram_id = sys.argv[1].strip()
        username = sys.argv[2].strip().replace("@", "")
        full_name = sys.argv[3].strip()
    else:
        print("--- Generador de Usuarios para la Porra ---")
        telegram_id = input("ID de Telegram (o número de 5 dígitos para pruebas, ej. 54321): ").strip()
        if not telegram_id:
            print("El ID de Telegram es obligatorio.")
            return
        username = input("Nombre de usuario de Telegram (sin @, ej. edusangad): ").strip().replace("@", "")
        full_name = input("Nombre completo (ej. Edu Sánchez): ").strip()
        if not full_name:
            full_name = username or f"Usuario {telegram_id}"

    asyncio.run(create_user(telegram_id, username, full_name))

if __name__ == "__main__":
    main()
