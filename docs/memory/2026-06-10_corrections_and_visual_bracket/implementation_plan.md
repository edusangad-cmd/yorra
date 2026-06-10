# Plan de Implementación: Sistema de Puntos por Clasificación en Fases Eliminatorias

Queremos añadir una nueva lógica de puntuación a la porra: los usuarios recibirán puntos adicionales no solo por acertar marcadores individuales, sino también por **cada selección que logren clasificar correctamente a las sucesivas rondas eliminatorias** (Dieciseisavos, Octavos, Cuartos, Semifinales y Final).

Para ello, seguiremos una progresión matemática lógica (basada en la secuencia de Fibonacci) para premiar con más puntos a medida que avanza el torneo y sea más difícil acertar.

---

## Progresión de Puntos Propuesta (Fibonacci)

* 🚪 **Clasificar a Dieciseisavos (1/16):** +1 punto por equipo acertado (Máximo 32 puntos)
* 🏃 **Clasificar a Octavos (1/8):** +2 puntos por equipo acertado (Máximo 32 puntos)
* 🏆 **Clasificar a Cuartos (1/4):** +3 puntos por equipo acertado (Máximo 24 puntos)
* 🔥 **Clasificar a Semifinales (Semis):** +5 puntos por equipo acertado (Máximo 20 puntos)
* 👑 **Clasificar a la Final (Finalistas):** +8 puntos por equipo acertado (Máximo 16 puntos)

---

## Cambios Propuestos

### 1. Lógica del Backend (Python)

Necesitamos replicar exactamente el simulador del cuadro en Python en el backend para poder calcular qué equipos avanzan en la porra real del torneo y en la porra simulada de cada usuario.

#### [MODIFY] [match_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/match_service.py)
* **Simulador de Cuadro en Python**:
  - Implementar una función `resolve_bracket_teams(matches: list[Match], scores_map: dict[int, tuple[int, int]], penalty_winners_map: dict[int, bool])` que resuelva la clasificación de grupos y la propagación de llaves eliminatorias (del partido 73 al 104).
* **Función de Recálculo de Puntos General**:
  - Crear una función `recalculate_all_users_points(db: AsyncSession)` que se ejecute siempre que se actualicen resultados reales de partidos (en la sincronización de la API o en la simulación de debug).
  - Esta función calculará:
    1. Los equipos reales clasificados a cada ronda (R32, R16, QF, SF, Final).
    2. Para cada usuario, los equipos que su predicción clasificó a cada ronda.
    3. Sumará los puntos de aciertos de rondas eliminatorias utilizando la progresión 1, 2, 3, 5, 8.
    4. Sumará los puntos de acierto exacto (+3) o resultado (+1) de los partidos individuales.
    5. Sumará los puntos de Apuestas Especiales (Campeón +10, Subcampeón +5, y si están definidos en variables de entorno, Goleador +5, Portero +5, Revelación +5).
    6. Actualizará la columna `points` en la tabla `User` de forma atómica.

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
* En el endpoint `/debug/simulate-real-scores`, después de actualizar los marcadores de los partidos, llamar a `MatchService.recalculate_all_users_points(db)` para actualizar los puntos de todos los usuarios de forma consolidada.

---

### 2. Lógica del Frontend (React)

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* **Pestaña de Reglas**:
  - Actualizar la sección "Reglas y Puntuación" para detallar los nuevos puntos por clasificación a cada ronda (Dieciseisavos +1, Octavos +2, Cuartos +3, Semis +5, Finalista +8).

---

## Plan de Verificación

### Pruebas Automáticas
* Escribir un test en [test_endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/tests/test_endpoints.py) que simule marcadores reales de fase de grupos y eliminatorias, y valide que los usuarios obtienen los puntos correspondientes por equipos clasificados a octavos, cuartos, etc.
* Ejecutar `./scripts/verify.sh` para asegurar que pasa todo.

### Verificación Manual
* Ejecutar la simulación de resultados reales desde el dashboard (`Simular resultados reales`).
* Verificar en la tabla de clasificación (Leaderboard) que los puntos se actualizan sumando correctamente los aciertos de avance de fases eliminatorias.
