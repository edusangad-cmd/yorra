# Walkthrough: Corrección del Estado "En Juego" de los Partidos

Hemos corregido un bug en el que los partidos recién empezados eran marcados inmediatamente como "FINALIZADO" con un marcador de 0-0.

## Cambios realizados

### 1. Servidor (Backend)
En [match_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/match_service.py):
* Modificamos la función `recalculate_all_users_points` para que solo considere los resultados reales de partidos cuyo estado oficial sea `"FT"` (Full Time / Finalizado). Si el estado del partido no es `"FT"`, su marcador real se ignora (se trata como `None`) a la hora de calcular puntos y actualizar el cuadro de eliminación (bracket).
* Actualizamos el bloque de actualización rápida para que solo modifique los puntos ganados de predicciones individuales si el estado del partido entrante es `"FT"`.

### 2. Interfaz de Usuario (Frontend)
En [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx):
* Actualizamos la lógica de `hasFinished` para que verifique si `m.status === "FT"` en lugar de basarse en si los campos `m.home_score` y `m.away_score` son no-nulos.
* Cambiamos las comprobaciones en el cálculo de las clasificaciones de grupos y los resultados de partidos del cuadro para asegurar que solo se resuelvan oficialmente si el estado del partido indica que ha concluido (`m.status === "FT"`).

## Verificación

* Ejecutamos `./scripts/verify.sh` con éxito. Todos los linters, el análisis estático de tipos de TypeScript/Mypy y los 15 tests unitarios del backend pasaron de forma satisfactoria.
