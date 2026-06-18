# Plan de Implementación - Mejoras en la Crónica de la Porra

Este plan detalla los cambios solicitados para mejorar la generación de la crónica diaria de la porra.

## Resumen de los Cambios

1. **Filtro de partidos del día anterior por contexto:** Modificar la lógica para que en lugar de usar timestamps (`created_at` contra `last_updated`), se envíen todos los partidos del día anterior a Gemini junto con el texto de la crónica anterior, permitiendo que la IA evalúe si un partido ya estaba finalizado y cerrado o si estaba pendiente/en juego/no empezado.
2. **Clasificación general en el título:** Obtener los puntos acumulados de todos los participantes de la porra y pasarlos al prompt para obligar a Gemini a incluirlos en el título.
3. **Ampliación del glosario y tono:** Integrar nuevos términos (el gitano, el fercho, el cé, negros, zarik, el bomba, la yorra, llevar goles, el filmo) y ajustar el tono ("qué bello", "macho", "niño") dentro de la crónica.

---

## Cambios Propuestos

### [Componente: Servicio de Crónicas IA]

#### [MODIFY] [ai_summary_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/ai_summary_service.py)

- **Eliminar filtro de timestamps:**
  En lugar de descartar partidos de ayer usando `pm.status != "FT" or pm.last_updated > yesterday_summary_obj.created_at`, se recopilarán todos los partidos de ayer y sus predicciones/puntos actuales.
- **Obtener Clasificación General:**
  Consultar la base de datos para obtener todos los usuarios ordenados por puntos descendentes:
  ```python
  user_query = select(User).order_by(User.points.desc())
  user_result = await db.execute(user_query)
  all_users = user_result.scalars().all()
  overall_rankings_str = ", ".join([f"{u.full_name} ({u.points} pts)" for u in all_users])
  ```
- **Actualizar Prompt de Gemini:**
  - Agregar sección de `CLASIFICACIÓN GENERAL ACUMULADA HASTA HOY`.
  - Instruir a la IA a filtrar los partidos de ayer que ya estaban finalizados según la crónica anterior, describiendo el desenlace solo para los que no estaban finalizados.
  - Agregar instrucción explícitamente para que el título en la primera línea contenga la clasificación general.
  - Agregar los nuevos términos al glosario y las instrucciones de tono ("qué bello", "macho", "niño").

---

## Plan de Verificación

### Pruebas Automatizadas
- Ejecutar la suite de tests existente con `pytest` para asegurar que no hay regresiones.
- Verificar que el test `test_daily_summaries_flow` sigue pasando.

### Verificación Manual
- Generar una crónica diaria en un escenario de prueba (o simularla mediante llamadas locales) y comprobar que el prompt enviado incluye las clasificaciones generales y las reglas del glosario actualizadas.
