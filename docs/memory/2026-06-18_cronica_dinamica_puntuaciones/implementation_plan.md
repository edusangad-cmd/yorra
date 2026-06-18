# Plan de Implementación - Gestión Dinámica de Puntuaciones en la Crónica

Este plan detalla la solución para evitar que la IA realice cálculos extraños o muestre puntuaciones incorrectas en las crónicas diarias de la porra.

## Descripción del Problema
Anteriormente, la clasificación general con las puntuaciones acumuladas de los participantes se incrustaba en el texto de la crónica y se guardaba directamente en la base de datos en la columna `content`. Esto causaba dos problemas principales:
1. **Pérdida de sincronización:** Si las puntuaciones de los usuarios se recalculaban posteriormente, las crónicas antiguas seguían mostrando la puntuación estática que tenían en el momento de su generación.
2. **Confusión en el contexto de la IA:** Cuando se generaba la crónica de hoy, se alimentaba como contexto la crónica de ayer (que contenía en su texto las puntuaciones antiguas de ayer). Esto confundía a la IA (Gemini), haciendo que sumara o dedujera puntuaciones de forma errónea basándose en ese texto antiguo en lugar de los datos reales del repositorio de base de datos.

## Cambios Propuestos

Para solucionar esto de raíz y hacer caso a la indicación de Edu ("la puntuación debería estar en algún contador o repositorio concreto, simplemente haz que la consulte y ya está"), implementaremos los siguientes cambios:

1. **Guardar solo el comentario limpio en BD:** La crónica que se guarde en la base de datos (`DailySummary.content`) contendrá únicamente el cuerpo del comentario humorístico generado por la IA, sin ningún título o puntuación general incrustada.
2. **Consultar y construir el título dinámicamente en el Servidor:** Cuando el cliente solicite las crónicas (GET `/api/daily-summaries`) o cuando se acabe de generar una nueva crónica (POST `/api/daily-summaries/generate`), el backend consultará la tabla `User` (el repositorio real de puntuaciones), ordenará a los participantes de forma actualizada y prependerá el título en tiempo de ejecución:
   `Crónica de la Porra - Edu (45 pts), Juan (32 pts)...`
3. **Limpieza de contexto para la IA:** Como el contenido de la crónica anterior se almacena limpio en la base de datos (sin el título), la IA nunca volverá a ver puntuaciones generales desfasadas en el contexto de la crónica de ayer.
4. **Instrucciones claras al LLM:** El prompt de Gemini seguirá recibiendo la clasificación acumulada actual para que la IA tenga contexto humorístico (hacer piques sanos), pero se le instruirá explícitamente a no mencionar ni calcular puntuaciones generales acumuladas en su comentario, y a no escribir títulos.

---

### [Componente: Backend API & Servicios]

#### [MODIFY] [ai_summary_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/ai_summary_service.py)
- Añadir el método estático `get_overall_rankings_str(db: AsyncSession) -> str` para obtener las puntuaciones y formatear la clasificación directamente desde la base de datos.
- Modificar `generate_daily_summary` para que guarde en base de datos únicamente el `content` retornado por Gemini (el cual ya no tiene títulos ni puntuaciones acumuladas).
- Ajustar el prompt para asegurar que la IA no intente escribir clasificaciones o puntuaciones acumuladas totales en su comentario, y delegar esa visualización al servidor de forma externa.

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
- Modificar el endpoint GET `/api/daily-summaries` para que consulte `get_overall_rankings_str` y devuelva el contenido con el título dinámico prependido.
- Modificar el endpoint POST `/api/daily-summaries/generate` para que haga lo mismo al retornar la crónica recién generada.

#### [MODIFY] [test_endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/tests/test_endpoints.py)
- Actualizar el test `test_daily_summaries_prompt_content` para verificar el comportamiento correcto con el nuevo prompt y la generación dinámica del título.

---

## Plan de Verificación

### Pruebas Automatizadas
- Ejecutar la suite de pruebas del backend usando pytest para asegurar que todos los flujos e integraciones siguen funcionando:
  `docker compose exec backend pytest`

### Verificación Manual
- Generar una crónica diaria en el navegador (`http://localhost:3000`), verificar que el título con la clasificación se muestra correctamente y que los puntos corresponden exactamente a los de la base de datos.
