# Plan de Implementación: Resolución de Cruces de Terceros Lugares (Mundial 2026)

Este plan describe cómo implementar de manera exacta y oficial las asignaciones de los 8 mejores terceros clasificados en la ronda de dieciseisavos de final de la porra de la Copa Mundial 2026, utilizando la tabla oficial de 495 combinaciones de la FIFA.

## Resumen del Problema
Actualmente, la porra utiliza una lógica simplificada tipo Copa América/Eurocopa para los terceros lugares y no tiene programada la matriz de combinaciones de la FIFA. Esto provoca que, incluso cuando los grupos están resueltos, el cálculo no asigne correctamente qué tercer lugar va a qué cruce en los dieciseisavos (Match 74, 77, 79, 80, 81, 82, 85, 87).

## Cambios Propuestos

### Backend

#### [NEW] [third_place_combinations.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/third_place_combinations.py)
* Ya se ha generado este archivo utilizando el wikitext oficial de Wikipedia para el Mundial 2026. Contiene la constante `THIRD_PLACE_COMBINATIONS` con las 495 claves posibles (las combinaciones ordenadas alfabéticamente de los 8 grupos que aportan terceros lugares, ej: `"EFGHIJKL"`) mapeando cada uno de los 8 primeros de grupo involucrados (`1A`, `1B`, `1D`, `1E`, `1G`, `1I`, `1K`, `1L`) a su tercer lugar correspondiente (`3A`, `3B`, etc.).

#### [MODIFY] [match_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/match_service.py)
* Importar la constante `THIRD_PLACE_COMBINATIONS` de `app.services.third_place_combinations`.
* Modificar `resolve_bracket_teams` para que:
  * Si todos los grupos están completados (`all_groups_resolved` es verdadero):
    1. Obtenga los 8 grupos cuyos terceros clasificados hayan avanzado.
    2. Construya la clave ordenando alfabéticamente esos 8 nombres de grupo.
    3. Busque en `THIRD_PLACE_COMBINATIONS` el mapeo correspondiente a esa combinación.
    4. Mapee cada uno de los partidos correspondientes (74, 77, 79, 80, 81, 82, 85, 87) al equipo del tercer lugar del grupo indicado por la tabla de la FIFA.
  * Si no todos los grupos están completados:
    * Continuar mostrando los marcadores de posición legibles, por ejemplo, `"3º Grupo A/B/C/D/F"`.

## Plan de Verificación

### Pruebas Automatizadas
* Ejecutar la suite de pruebas del backend en Docker para verificar que no haya regresiones:
  ```bash
  docker compose exec backend pytest
  ```
* Añadir un caso de prueba en `backend/tests/test_endpoints.py` que resuelva una combinación concreta de terceros lugares y verifique que los emparejamientos resultantes de dieciseisavos correspondan exactamente al reglamento oficial.

### Verificación Manual
* Entrar a la interfaz del frontend y completar pronósticos que clasifiquen a 8 terceros específicos de diferentes grupos.
* Validar visualmente en el Bracket que los cruces se rellenen con los equipos reales en lugar de los placeholders genéricos.
