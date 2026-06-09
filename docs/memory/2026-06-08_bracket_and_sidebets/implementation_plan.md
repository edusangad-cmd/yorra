# Plan de Implementación: Simulador de Cuadro, Predicciones Especiales y Simulador Aleatorio (Mundial 2026)

Queremos transformar nuestra porra de fútbol simple en un **simulador interactivo completo del Mundial 2026**. Los usuarios podrán ver los partidos agrupados por grupos/fases, rellenar predicciones de forma aleatoria, visualizar la tabla de posiciones dinámica de cada grupo, ver cómo avanzan sus equipos clasificados a las fases eliminatorias (octavos, semifinales, etc.) de forma automática y hacer apuestas especiales del torneo.

---

## Modificaciones Propuestas

### 1. Base de Datos y Modelos (Backend)

Modificaremos y ampliaremos los modelos de datos en `backend/app/models/models.py` e iniciaremos las nuevas columnas de forma idempotente en `backend/app/db/session.py`.

#### [MODIFY] [models.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/models/models.py)
* **Match**:
  - Añadir columna `group` (por ejemplo: `"A"`, `"B"`, `"R32"`, etc.) para agrupar partidos.
  - Añadir columna `stage` (por ejemplo: `"group"`, `"r32"`, `"r16"`, `"qf"`, `"sf"`, `"third"`, `"final"`) para identificar la fase.
* **TournamentPrediction [NUEVO]**:
  - Tabla nueva para apuestas especiales a nivel de torneo.
  - Columnas: `id` (PK), `user_id` (FK a User, único para relación 1-a-1), `champion` (str), `runner_up` (str), `top_scorer` (str), `surprise_team` (str), `last_updated` (datetime).
* **User**:
  - Añadir relación 1-a-1 hacia `TournamentPrediction`.

#### [MODIFY] [session.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/db/session.py)
* En `init_db()`, agregar sentencias SQL para crear las nuevas columnas si no existen:
  - `ALTER TABLE match ADD COLUMN IF NOT EXISTS "group" VARCHAR;`
  - `ALTER TABLE match ADD COLUMN IF NOT EXISTS stage VARCHAR;`

---

### 2. Sincronización de Partidos (Backend)

#### [MODIFY] [api_sports.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/api_sports.py)
* Extraer y mapear los campos `group` y `type` (stage) desde la respuesta de `worldcup26.ir` para incluirlos en el resultado que procesa `MatchService`.

#### [MODIFY] [match_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/match_service.py)
* Guardar las columnas `group` y `stage` en la base de datos al descargar los partidos de la API.

---

### 3. Rutas y APIs (Backend)

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
* **`GET /api/matches`**: Devolver los campos `group` y `stage` de cada partido en la respuesta JSON.
* **`GET /api/tournament-predictions` [NUEVO]**: Obtener las predicciones especiales del usuario autenticado.
* **`POST /api/tournament-predictions` [NUEVO]**: Guardar/actualizar las predicciones especiales.
* **`POST /api/debug/simulate-real-scores` [NUEVO]**: Endpoint de desarrollo para simular resultados reales aleatorios en partidos comenzados o terminados, recalculando automáticamente los puntos de los participantes para probar la clasificación del roast.

---

### 4. Interfaz de Usuario y Lógica en Frontend

Haremos que la interfaz cobre vida y responda al instante según lo que el usuario rellene:

#### [MODIFY] [api.ts](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/services/api.ts)
* Añadir clientes HTTP para las rutas de predicciones especiales (`/api/tournament-predictions`) y simulación de resultados.

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* **Agrupación de Partidos**:
  - Dividir la pestaña de Partidos en sub-pestañas: "Fase de Grupos" (organizados por los grupos A al L) y "Fases Eliminatorias" (organizados por Dieciseisavos, Octavos, Cuartos, Semifinal y Final).
* **Lógica del Cuadro y Progreso Dinámico**:
  - Implementar una función que calcule en tiempo real la clasificación de cada grupo basándose en los pronósticos guardados del usuario (puntos, diferencia de goles, goles marcados).
  - Resolver automáticamente los cruces de Dieciseisavos (Round of 32): los 1º y 2º de cada grupo y los 8 mejores 3º se asignan como equipos locales o visitantes según la estructura oficial de FIFA.
  - Resolver recursivamente las siguientes rondas (Octavos, Cuartos, etc.): si el usuario predice que el equipo local gana, ese equipo pasa automáticamente al siguiente partido en el panel visual.
* **Pestaña de Clasificación de Grupos [NUEVO]**:
  - Visualizar la tabla de cada grupo calculada dinámicamente con los pronósticos actuales para ver quién clasificaría en 1º, 2º y 3º puesto.
* **Pestaña de Apuestas Especiales [NUEVO]**:
  - Desplegables elegantes para elegir el Campeón, Subcampeón, Máximo Goleador (de una lista de estrellas mundiales) y el Equipo Revelación.
* **Herramientas de Simulación**:
  - Botón **"Simular mis Pronósticos"**: Rellena de forma aleatoria todos los goles de tus predicciones que aún estén vacíos.
  - Botón **"Simular Resultados Reales (Admin)"**: Envía una señal al backend para rellenar los resultados oficiales de los partidos de forma aleatoria, permitiendo probar cómo se calculan y otorgan los puntos en la porra general.

---

## Plan de Verificación

### Pruebas Automáticas
- Crear pruebas unitarias y de integración en `backend/tests/test_endpoints.py` para asegurar que las rutas de predicciones especiales y la actualización de partidos con grupos/etapas funcionan bajo estricto cumplimiento de tipos.

### Verificación Manual
- Abrir la web y probar la fluidez del simulador: al poner un pronóstico de 3-0 de España contra Alemania en fase de grupos, confirmar que España sube en la clasificación de su grupo y aparece en el partido correspondiente de la siguiente fase eliminatoria.
