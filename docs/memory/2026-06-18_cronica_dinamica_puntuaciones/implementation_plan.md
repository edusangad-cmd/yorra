# Plan de Implementación: Historial de Predicciones y Lógica de Partidos Coincidentes/Semicoincidentes

Este plan tiene como objetivo permitir que los usuarios comparen visualmente sus predicciones con los resultados reales del torneo y no pierdan el rastro de sus pronósticos en la fase de grupos ni en las eliminatorias. Además, implementa la lógica de **Partido Coincidente** y **Partido Semicoincidente** para rescatar puntos en el cuadro de fase final cuando ocurren los enfrentamientos previstos por el usuario, aunque sea en ranuras de partidos u octavos de final diferentes.

---

## Preguntas Abiertas (¡Tu opinión es clave!)

> [!IMPORTANT]
> Por favor, revisa estas preguntas sobre cómo quieres que se comporte el sistema. Escríbeme tus respuestas o preferencias en tu próximo mensaje:
>
> 1. **Puntos en caso de Desajuste Total (Mismatch):**
>    Actualmente, el sistema te da puntos por el marcador de un partido eliminatorio aunque los equipos no coincidan (por ejemplo, si pronosticaste *Suecia 2 - Nigeria 1* en el partido 74, y el partido real fue *España 2 - Dinamarca 1*, te da los 3 puntos por acertar el 2-1). 
>    Con las nuevas reglas de Partido Coincidente y Semicoincidente, ¿debemos cambiar esto para que si los equipos no coinciden en absoluto (es decir, no es coincidente ni semicoincidente ni normal), el usuario obtenga **0 puntos** en ese partido? (Esto suele ser lo más lógico en porras deportivas).
>
> 2. **Normalización de Goles (Inversión Local/Visitante):**
>    Si tú pronosticaste *"España 2 - Argentina 1"* (España de local), pero en el partido real juegan *"Argentina vs España"* (Argentina de local) y queda *"Argentina 1 - España 2"*:
>    ¿Damos por bueno que tu pronóstico fue que ganaba España por 2-1 (es decir, invertimos el orden de tu predicción para compararla correctamente con el resultado real y darte los 3 puntos enteros)?
>
> 3. **Tratamiento de los Puntos con Decimales:**
>    Al otorgar la mitad de los puntos en los partidos Semicoincidentes (1.5 puntos por resultado exacto, 0.5 por acertar ganador/empate), los totales de los usuarios tendrán decimales (ej: 42.5 puntos).
>    ¿Te parece bien mostrar los decimales en el ranking, o prefieres que dupliquemos toda la escala de puntos para que siempre sean enteros (ej: Exacto = 6 pts, Ganador = 2 pts, Semicoincidente Exacto = 3 pts, Semicoincidente Ganador = 1 pt)?
>
> 4. **¿Qué predicción se usa si hay duplicados?**
>    Si por alguna razón predijiste el enfrentamiento España vs Argentina en dos rondas distintas de tu cuadro simulado (por ejemplo, en Octavos y en la Final), y el partido real ocurre en Octavos:
>    ¿Priorizamos siempre el partido de la misma ronda (Coincidente) sobre el de otra ronda (Semicoincidente)?

---

## Modificaciones Propuestas

### 1. Base de Datos y Modelos (Backend)

Para dar soporte a puntuaciones decimales si nos mantenemos con float.

#### [MODIFY] [models.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/models/models.py)
* Cambiar el tipo de `User.points` de `int` a `float`.
* Cambiar el tipo de `Prediction.points_earned` de `int` a `float`.

#### [MODIFY] [session.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/db/session.py)
* En `init_db()`, agregar comandos SQL para alterar el tipo de las columnas a `DOUBLE PRECISION` de forma segura:
  - `ALTER TABLE "user" ALTER COLUMN points TYPE DOUBLE PRECISION;`
  - `ALTER TABLE prediction ALTER COLUMN points_earned TYPE DOUBLE PRECISION;`

---

### 2. Lógica de Puntuación (Backend)

#### [MODIFY] [match_service.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/services/match_service.py)
* Crear una función auxiliar en Python para identificar si existe un emparejamiento coincidente o semicoincidente para un usuario:
  - Extraer los equipos reales de un partido terminado de fases eliminatorias.
  - Buscar en las predicciones resueltas del usuario si existe ese mismo emparejamiento de equipos (sin importar el orden de local/visitante).
  - Si se encuentra en la misma ronda -> **Coincidente** (100% de puntos).
  - Si se encuentra en una ronda diferente -> **Semicoincidente** (50% de puntos).
* En `recalculate_all_users_points`, aplicar estas reglas a la hora de calcular `p.points_earned` para cada predicción de eliminatorias, en lugar de comparar ciegamente por `match_id`.

---

### 3. Interfaz de Usuario y Lógica en Frontend

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)

* **Clasificaciones de Grupos:**
  - En la función de cálculo `useMemo`, calcular una tabla paralela de posiciones de grupo basada **100% en las predicciones/borradores del usuario** (ignorando los resultados reales).
  - Obtener el rango predicho (1º, 2º, 3º, 4º) de cada equipo en esa tabla paralela.
  - En la pestaña de Clasificación (`standings`), añadir una nueva columna **"Predicción"** (o "Pred.") que muestre una etiqueta o insignia con el puesto que el usuario había previsto para ese equipo.

* **Fases Eliminatorias (Bracket):**
  - En cada tarjeta de partido de eliminatorias (`renderBracketMatchCard`), mostrar en la parte inferior un texto con la predicción original de ese partido en formato texto e iconos:
    `Predicción: 🇸🇪 Suecia 3 - 🇳🇬 Nigeria 2`
  - Implementar la misma lógica de emparejamientos en el frontend para identificar visualmente los partidos Coincidentes y Semicoincidentes.
  - **Diseño Premium para Coincidencia:**
    - Si el partido es **Coincidente**: Enmarcar la tarjeta con un borde brillante verde menta/turquesa y añadir una etiqueta elegante: `✨ PARTIDO COINCIDENTE`.
    - Si el partido es **Semicoincidente**: Enmarcar la tarjeta con un borde ámbar/dorado y añadir la etiqueta: `⚠️ PARTIDO SEMICOINCIDENTE (50% pts)`.
    - Indicar debajo el partido original del que proviene la predicción: `Predicho originalmente para la Final: Suecia 3 - Nigeria 2`.

---

## Plan de Verificación

### Pruebas Automáticas
- Actualizar y añadir pruebas en `backend/tests/test_endpoints.py` que validen la adjudicación de puntos para partidos coincidentes y semicoincidentes (con decimales si aplica).
- Ejecutar `./scripts/verify.sh` para comprobar la tipación de TypeScript y Python.

### Verificación Manual
- Acceder a la web en el navegador, simular resultados reales aleatorios en el botón de administración y verificar que:
  1. En la pestaña de Clasificación de Grupos aparezca la nueva columna de predicción indicando la posición proyectada del usuario.
  2. En el simulador de llaves se mantenga la vista de lo predicho en cada tarjeta.
  3. Los partidos coincidentes y semicoincidentes resalten visualmente con bordes y badges temáticos.
