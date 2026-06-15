# Plan de Implementación: Ver Dashboard de otros Usuarios (Modo Comparativa)

Este plan detalla cómo agregar la capacidad de hacer clic en cualquier participante de la clasificación general para ver su dashboard completo (pronósticos de fase de grupos, fase final, posiciones de grupos y apuestas especiales) en modo de solo lectura con un tono grisáceo y una opción para volver atrás.

## Resumen del Comportamiento

1. **Interacción en la Clasificación General:** Al hacer clic en un usuario en la tabla de clasificación o en el podio, en lugar de abrir el modal actual, el dashboard principal del usuario cambiará de contexto para mostrar la información del usuario seleccionado.
2. **Banner Informativo y Botón de Retorno:** Se mostrará un banner superior muy visual (`viewing-user-banner`) indicando a quién pertenece la porra que se está visualizando y con un botón destacado de "Volver a mi porra" que restablecerá el contexto al usuario original.
3. **Modo Solo Lectura (Sin Control):**
   - Se ocultará el panel de herramientas de prueba/administración y el botón de "Guardar Todo" del header.
   - Todos los inputs de marcadores de partidos (`pred-input` y `bracket-score-input`) y selectores de apuestas especiales estarán deshabilitados.
   - Los botones de guardar individuales en las tarjetas de partidos y llaves de fase final se ocultarán.
4. **Estilo Grisáceo:** El contenedor del dashboard recibirá la clase CSS `.viewing-mode-gray`, aplicando un filtro de escala de grises y brillo atenuado para hacer evidente al usuario que está en el perfil de otra persona.

---

## Cambios Propuestos

### Frontend

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
- **Estados Nuevos:**
  - `viewingUser`: `LeaderboardUser | null` - Para almacenar el usuario de la clasificación que se está comparando.
  - `viewedUserPredictions`: `Record<number, Prediction>` - Pronósticos del usuario comparado.
  - `viewedUserTournament`: `TournamentPrediction` - Apuestas especiales del usuario comparado.
  - `viewedUserLoading`: `boolean` - Estado de carga al obtener los datos del usuario comparado.
  - `viewedUserError`: `string | null` - Posible error al cargar los datos.
- **Acciones y Lógica:**
  - `handleViewUserDashboard(u: LeaderboardUser)`: Función asíncrona que cambia el tab activo a `"matches"`, obtiene los pronósticos y apuestas del usuario `u` a través de `api.getUserPredictions(u.id)` y rellena los estados.
  - Adaptar la computación de `standings` y `resolvedBracket` en `useMemo` para usar `activePredictions` (sea `viewedUserPredictions` si se está comparando, o `predictions` por defecto).
  - Actualizar `renderMatchCard` y `renderBracketMatchCard` para consumir los pronósticos y resolver nombres de equipo en base al usuario activo en pantalla, deshabilitando inputs y ocultando botones de guardado.
  - Deshabilitar los selectores de apuestas especiales (`Tournament Predictions`) y ocultar su botón de guardado en el tab de apuestas especiales cuando `viewingUser` esté activo.
  - Ocultar herramientas de prueba y botones de guardado global cuando `viewingUser` esté activo.
  - Añadir el banner `viewing-user-banner` debajo del header si `viewingUser` no es nulo, con el botón "Volver a mi porra" que llama a `setViewingUser(null)` y vuelve a la pestaña `"leaderboard"`.

#### [MODIFY] [index.css](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/index.css)
- Añadir la regla `.viewing-mode-gray` para aplicar un filtro visual grisáceo a los elementos de contenido.
- Añadir los estilos del banner superior (`viewing-user-banner`), su contenido, iconos y el botón de retorno.

---

## Plan de Verificación

### Verificación Manual
1. Iniciar los contenedores de Docker localmente.
2. Acceder a `http://localhost:3000`.
3. Navegar a la pestaña "Clasificación General".
4. Hacer clic en cualquiera de los participantes del podio o de la lista.
5. Comprobar que:
   - Se cambia automáticamente a la pestaña de partidos de grupo.
   - El dashboard adopta un tono grisáceo distintivo.
   - Se muestra un banner superior oscuro con el texto "Viendo la porra de [Nombre]" y un botón "Volver a mi porra".
   - Todos los marcadores de fase de grupos, fase final, posiciones de grupo y apuestas especiales reflejan la predicción de ese usuario y no permiten edición (inputs deshabilitados, sin botones de guardado).
6. Hacer clic en "Volver a mi porra" y verificar que el dashboard recupera sus colores normales, nos devuelve a la pestaña de "Clasificación General" y las predicciones vuelven a ser las nuestras.
