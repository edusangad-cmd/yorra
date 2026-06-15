# Plan de Implementación: Resúmenes Diarios de IA en la Clasificación

Este plan describe la incorporación de un feed cronológico de resúmenes diarios generados por Inteligencia Actor en la pestaña de Clasificación General. La IA analizará los partidos finalizados de un día determinado, contrastará los resultados reales con las predicciones de los participantes y generará una crónica divertida, picante y competitiva sobre cómo se repartieron los puntos y quién triunfó o falló.

---

## User Review Required

> [!IMPORTANT]
> **Requisito de API Key de Gemini:**
> Necesitamos una clave de API de Gemini (`GEMINI_API_KEY`) para poder realizar las llamadas y generar los textos. Se agregará una variable al archivo `.env` local y deberá configurarse en el entorno de producción.
>
> **Llamada de Generación:**
> Para simplificar y no depender de un cron automático en el servidor, implementaremos un botón en la interfaz de administración (o en la barra de debug de resultados) que te permita activar la generación del resumen del día de forma manual con un solo clic.

---

## Proposed Changes

### Backend

#### [NEW] [ai_summary_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/ai_summary_service.py)
* Crear el servicio `AISummaryService` encargado de:
  * Consultar los partidos terminados en una fecha dada.
  * Consultar las predicciones y los puntos acumulados por cada usuario en esa fecha.
  * Formatear los datos como un prompt descriptivo en español.
  * Enviar la solicitud a la API de Gemini (usando el modelo `gemini-2.5-flash` vía `httpx` para no sobrecargar el proyecto con dependencias extra).
  * Guardar el texto generado en la base de datos asociado a la fecha correspondiente (evitando duplicados para el mismo día).

#### [MODIFY] [models.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/models/models.py)
* Añadir el modelo `DailySummary`:
  ```python
  class DailySummary(SQLModel, table=True):
      id: int | None = Field(default=None, primary_key=True)
      summary_date: str = Field(unique=True, index=True) # Formato YYYY-MM-DD
      content: str
      created_at: datetime = Field(default_factory=datetime.utcnow)
  ```

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
* Registrar el nuevo modelo en las importaciones.
* Crear los siguientes endpoints:
  * `GET /api/daily-summaries` -> Obtiene la lista de resúmenes diarios ordenados cronológicamente por fecha (descendente).
  * `POST /api/daily-summaries/generate` -> Genera y guarda el resumen de una fecha dada (con permisos sencillos o botón de debug).
* Modificar el simulador de partidos (`/api/debug/simulate-real-scores`) para que, de forma opcional o automática en modo simulación, ofrezca la posibilidad de gatillar la generación del resumen de IA para facilitar tus pruebas.

---

### Frontend

#### [MODIFY] [api.ts](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/services/api.ts)
* Agregar la interfaz `DailySummary`:
  ```typescript
  export interface DailySummary {
    id: number;
    summary_date: string;
    content: string;
    created_at: string;
  }
  ```
* Añadir llamadas a los nuevos endpoints:
  * `getDailySummaries(): Promise<DailySummary[]>`
  * `generateDailySummary(date: string): Promise<DailySummary>`

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* Modificar la pestaña de **Clasificación (leaderboard)**.
* Agregar un componente visual premium que muestre el feed/historial de resúmenes generados por la IA:
  * Diseño limpio estilo chat, timeline o acordeón.
  * Formateo de texto agradable.
  * Añadir un botón flotante o de control de depuración en la barra de administrador para poder generar el resumen del día actual en un clic (`Generar Resumen de IA`).

---

## Verification Plan

### Automated Tests
* Escribir un test de integración en `backend/tests/` para verificar que:
  * El endpoint `GET /api/daily-summaries` devuelve la lista de resúmenes guardados.
  * La inserción de un resumen guarda correctamente los datos en la base de datos SQLite/Postgres.

### Manual Verification
1. Levantar el stack local con `docker compose up -d --build`.
2. Acceder a la app, predecir marcadores con diferentes usuarios.
3. Usar el simulador de partidos o rellenar resultados para otorgar puntos.
4. Generar el resumen del día pulsando el botón manual de generación.
5. Confirmar que el feed se actualiza con una crónica fluida e ingeniosa que describe las diferencias en las puntuaciones obtenidas por cada usuario.
