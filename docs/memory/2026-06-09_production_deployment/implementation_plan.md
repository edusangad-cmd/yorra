# Plan de Implementación - Despliegue en Internet (Mundial 2026)

Este documento detalla la estrategia paso a paso para desplegar la aplicación "Porra Deportiva" en internet para que cualquiera pueda usarla desde su móvil o PC de forma permanente.

## Plataforma Recomendada: Render o Railway

### ¿Por qué?
1. **Render:** Permite alojar el Frontend de forma 100% gratuita para siempre (como sitio estático). El Backend y la base de datos PostgreSQL se pueden hospedar en su plan básico a muy bajo coste.
2. **Railway:** Muy fácil de usar para proyectos compuestos por varios servicios (Base de datos, Backend y Frontend) en un mismo panel visual.

---

## Cambios Realizados y Preparativos de Código

1. **[MODIFY] [Dockerfile](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/Dockerfile):** Modificado para escuchar dinámicamente en el puerto asignado por el servidor en la nube (usando la variable de entorno `PORT`, cayendo en el puerto `8000` si se ejecuta en local).
2. **Base de Datos:** El programa creará automáticamente la estructura de la base de datos (tablas, columnas, relaciones) de forma idempotente en el servidor de producción la primera vez que se inicie.

---

## Pasos para el Despliegue (Paso a Paso)

### Paso 1: Base de Datos PostgreSQL
1. Crea un servicio de **PostgreSQL** en tu plataforma (Render o Railway).
2. Copia la URL de conexión que te facilite la plataforma (debe empezar por `postgresql://` o `postgresql+asyncpg://`).

### Paso 2: Desplegar el Backend (Servidor de datos)
1. Crea un nuevo servicio web apuntando a tu repositorio de GitHub.
2. Configura los siguientes parámetros en el panel del servicio:
   * **Root Directory / Subdirectorio:** `backend`
   * **Entorno / Runtime:** `Docker` (la plataforma detectará el `Dockerfile` automáticamente)
3. Configura las siguientes **Variables de Entorno (Environment Variables)**:
   * `DATABASE_URL`: La URL de la base de datos del Paso 1 (reemplaza `postgresql://` por `postgresql+asyncpg://` si la plataforma no lo incluye).
   * `TELEGRAM_BOT_TOKEN`: El token de tu bot de Telegram de vuestro `.env`.
   * `API_SPORTS_KEY`: La clave de la API de deportes de vuestro `.env`.
4. Una vez completado el despliegue, copia la dirección web pública generada para el backend (ej: `https://porra-backend.onrender.com`).

### Paso 3: Desplegar el Frontend (La interfaz web)
1. Crea un nuevo servicio (si usas Render, selecciona **Static Site**; si usas Railway, un servicio web estándar).
2. Apunta a tu repositorio de GitHub y configura:
   * **Root Directory / Subdirectorio:** `frontend`
   * **Build Command (Comando de construcción):** `npm run build`
   * **Publish Directory (Carpeta de publicación):** `dist`
3. Agrega la siguiente **Variable de Entorno**:
   * `VITE_API_URL`: La dirección web pública de tu backend obtenida en el Paso 2 (ej: `https://porra-backend.onrender.com`).
4. ¡Listo! La plataforma compilará la aplicación y te dará una dirección web (ej: `https://porra.onrender.com`) desde la cual cualquier participante podrá entrar a jugar.

---

## Verificación del Despliegue
- Entrar en la URL del frontend.
- Comprobar que carga la pantalla de inicio y nos permite registrarnos.
- Guardar una predicción y verificar en la base de datos que se almacena de forma correcta.
- Configurar el Webhook del bot de Telegram con la URL del backend real:
  `docker compose exec backend uv run python set_webhook.py <URL_DEL_BACKEND_REAL>`
