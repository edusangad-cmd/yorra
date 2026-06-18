# Plan de Implementación - Gestión Dinámica de Puntuaciones en la Crónica

Este plan detalla la solución para evitar que la IA realice cálculos extraños o muestre puntuaciones incorrectas en las crónicas diarias de la porra.

## Descripción del Problema
Anteriormente, la clasificación general con las puntuaciones acumuladas de los participantes se incrustaba en el texto de la crónica y se guardaba directamente en la base de datos en la columna `content`. Esto causaba dos problemas principales:
1. **Pérdida de sincronización:** Si las puntuaciones de los usuarios se recalculaban posteriormente, las crónicas antiguas seguían mostrando la puntuación estática que tenían en el momento de su generación.
2. **Confusión en el contexto de la IA:** Cuando se generaba la crónica de hoy, se alimentaba como contexto la crónica de ayer (que contenía en su texto las puntuaciones antiguas de ayer). Esto confundía a la IA (Gemini), haciendo que sumara o dedujera puntuaciones de forma errónea basándose en ese texto antiguo en lugar de los datos reales del repositorio de base de datos.

## Cambios Realizados

Para solucionar esto de raíz y hacer caso a la indicación de Edu ("la puntuación debería estar en algún contador o repositorio concreto, simplemente haz que la consulte y ya está"):

1. **Guardar solo el comentario limpio en BD:** La crónica que se guarda en la base de datos (`DailySummary.content`) contiene únicamente el cuerpo del comentario humorístico generado por la IA, sin ningún título o puntuación general incrustada.
2. **Consultar y construir el título dinámicamente en el Servidor:** Cuando el cliente solicita las crónicas (GET `/api/daily-summaries`) o cuando se acaba de generar una nueva crónica (POST `/api/daily-summaries/generate`), el backend consulta la tabla `User` (el repositorio real de puntuaciones), ordena a los participantes de forma actualizada y prepende el título en tiempo de ejecución:
   `Crónica de la Porra - Edu (45 pts), Juan (32 pts)...`
3. **Limpieza de contexto y eliminación total de puntos acumulados en el Prompt:**
   - Eliminamos por completo la sección `CLASIFICACIÓN GENERAL ACUMULADA HASTA HOY` del prompt enviado a la IA. La IA ya no ve las puntuaciones totales de los participantes en su prompt.
   - Así, la IA no se confunde con el historial ni intenta calcular o mencionar clasificaciones en el texto de la crónica, delegándolo en su totalidad al servidor por código.
4. **Mejora de Instrucciones y Variedad de Estilo:**
   - Agregamos reglas estrictas en el prompt para obligar a la IA a escribir prosa natural y variada, evitando conectores repetitivos ("veremos qué hace el dado/la glora") y seleccionando solo 2 o 3 términos del glosario de forma aleatoria y contextualizada en cada jornada.
   - Prohibimos expresamente hacer menciones a las puntuaciones acumuladas generales o clasificaciones globales dentro del cuerpo del comentario.

---

### [Componente: Backend API & Servicios]

#### [MODIFY] [ai_summary_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/ai_summary_service.py)
- Añadir el método estático `get_overall_rankings_str(db: AsyncSession) -> str` para obtener las puntuaciones y formatear la clasificación directamente desde la base de datos.
- Modificar `generate_daily_summary` para que guarde en base de datos únicamente el `content` retornado por Gemini (el cual ya no tiene títulos ni puntuaciones acumuladas).
- Ajustar el prompt para quitar las puntuaciones acumuladas del contexto y estructurar las instrucciones de prosa natural, variedad de glosario y no inclusión de puntos.

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
- Modificar el endpoint GET `/api/daily-summaries` para que consulte `get_overall_rankings_str` y devuelva el contenido con el título dinámico prependido.
- Modificar el endpoint POST `/api/daily-summaries/generate` para que haga lo mismo al retornar la crónica recién generada.

#### [MODIFY] [test_endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/tests/test_endpoints.py)
- Actualizar el test `test_daily_summaries_prompt_content` para verificar que las puntuaciones generales están ausentes del prompt y que el título dinámico con los puntos de base de datos se concatena correctamente en el API response.

---

## Plan de Verificación

### Pruebas Automatizadas
- Ejecutar la suite de pruebas del backend usando pytest para asegurar que todos los flujos e integraciones siguen funcionando:
  `docker compose exec backend uv run pytest`

### Verificación Manual
- Consultar el endpoint del servidor y verificar que los cambios reflejan dinámicamente los datos actualizados de la base de datos.
