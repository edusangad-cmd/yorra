# Resumen de Cambios: Modo Comparativa de Porras (Solo Lectura)

Se ha implementado con éxito la funcionalidad de poder hacer clic en el nombre de otros participantes dentro del apartado de clasificación general para visualizar su dashboard completo en modo de lectura.

## Cambios Realizados

### Frontend

1. **Gestión de Estados (`App.tsx`):**
   - Se añadieron estados para almacenar el usuario que se está comparando (`viewingUser`), sus predicciones (`viewedUserPredictions`) y sus apuestas especiales (`viewedUserTournament`).
   - Se añadió un estado de carga (`viewedUserLoading`) y error (`viewedUserError`).

2. **Acciones y Navegación:**
   - Se creó la función `handleViewUserDashboard(u)` para cargar dinámicamente las predicciones del usuario `u` mediante la API de backend, activando la pestaña de partidos (`matches`).
   - Se modificaron los manejadores `onClick` del podio y de la lista de participantes en la clasificación para invocar a `handleViewUserDashboard` cuando el usuario cliqueado no sea el propio usuario conectado.

3. **Cálculos Dinámicos del Cuadro y Posiciones:**
   - Se adaptó la lógica del `useMemo` de posiciones de grupo (`standings`) y cuadro final (`resolvedBracket`) para basarse en `activePredictions` (las predicciones del usuario comparado cuando `viewingUser` está activo).

4. **Componentes y Renderizado de Solo Lectura:**
   - **Partidos (`renderMatchCard`):** Se deshabilitaron los campos de entrada de goles y se ocultaron los botones de guardado individuales.
   - **Fase Final (`renderBracketMatchCard`):** Se deshabilitaron los casilleros del cuadro de fase final y el botón para alternar el ganador por tanda de penaltis. Se ocultaron los botones de guardado.
   - **Apuestas Especiales (`Tab 4`):** Se deshabilitaron los menús desplegables (`select`) y se ocultó el botón de guardar apuestas especiales.
   - **Barra de Herramientas de Prueba:** Se ocultaron las herramientas de prueba y desarrollo cuando se está en modo comparativa.

5. **Banner Superior y Botón de Retorno:**
   - Se implementó un banner superior (`viewing-user-banner`) oscuro con el texto: *"Viendo la porra de [Nombre]... en modo lectura"*.
   - El banner incluye el botón *"Volver a mi porra"* que restaura el dashboard al usuario propio y le devuelve a la pestaña de clasificación general.

6. **Estilo Grisáceo (`index.css`):**
   - Se aplicó un filtro CSS `.viewing-mode-gray` al contenedor principal del dashboard (`<main>`) para conferirle un tono grisáceo y desactivado (`pointer-events: none` / `user-select: none`). Esto bloquea toda interacción con el dashboard del otro usuario, mientras que el banner superior y el menú de pestañas permanecen completamente interactivos.

---

## Resultados de Verificación

Se han ejecutado pruebas automatizadas y manuales en el entorno local a través de Docker.

### Pruebas Automatizadas
Se ejecutó el CI gate `./scripts/verify.sh` de manera exitosa:
- **Backend:** `ruff` y `mypy` superados sin errores. Pruebas unitarias de `pytest` pasadas con éxito.
- **Frontend:** `eslint` superado y comprobación de tipos `tsc` finalizada sin problemas.

### Pruebas en Navegador
El flujo completo fue validado exitosamente en el navegador usando un subagente de automatización:
1. Inicio de sesión como `edu_sanchez` e inspección de Clasificación General.
2. Clic sobre otro usuario en el podio (por ejemplo, *Juan Perez*).
3. Confirmación del cambio de vista automático a partidos de grupo con el filtro de color grisáceo y el banner de aviso en la parte superior.
4. Confirmación de que todos los inputs de partidos y apuestas especiales están deshabilitados.
5. Retorno al dashboard propio al hacer clic en *"Volver a mi porra"*.
