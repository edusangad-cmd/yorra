# Plan de Rediseño Mobile-First: Yorra Mundial 2026

Este plan detalla una reestructuración completa del diseño de la aplicación para ofrecer una experiencia móvil nativa y premium, en lugar de adaptar a la fuerza el diseño de escritorio.

## User Review Required

> [!IMPORTANT]
> **Rediseño de Tarjetas de Partido (Layout de Sofascore/ESPN)**:
> Reemplazamos la fila horizontal en móvil por una distribución vertical de dos filas (una para cada equipo) con el marcador/input en el extremo derecho. Esto evita que los nombres de los equipos queden apretados y emula el diseño de las apps de resultados deportivos líderes.
>
> **Botón Flotante de Guardado (FAB)**:
> En móviles, el botón "Guardar Todo" del header se ocultará y aparecerá un **Botón de Acción Flotante (FAB)** en la esquina inferior derecha cuando existan cambios pendientes de guardar. Tendrá una micro-animación pulsante para notificar al usuario que tiene pronósticos por enviar.

## Proposed Changes

### 1. Reestructuración de Componentes (React)

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* **Pestañas de Navegación (`.tab-nav`)**: Agregar emojis identificadores a cada botón para mejorar el reconocimiento visual en pantallas pequeñas.
* **Acordeón para Herramientas de Prueba**: Envolver la barra de control (`.control-toolbar`) en una etiqueta nativa `<details>` para colapsar las herramientas de administración por defecto, liberando espacio en móviles.
* **Doble Layout en Tarjetas de Partido (`renderMatchCard`)**:
  * Implementar dos contenedores de cuerpo diferentes: `.match-card-body-desktop` (horizontal clásica) y `.match-card-body-mobile` (filas verticales apiladas por equipo).
  * Estructura del Layout Móvil:
    * Fila del Equipo Local: Bandera, Nombre del Equipo, Marcador Real o Caja de Entrada.
    * Fila del Equipo Visitante: Bandera, Nombre del Equipo, Marcador Real o Caja de Entrada.
* **Lógica de Pronósticos Pendientes**:
  * Añadir un `useMemo` (`hasUnsavedDrafts`) que verifique si el usuario tiene algún marcador modificado pendiente de ser guardado en el servidor.
  * Renderizar al final del componente el botón flotante `floating-save-btn` condicionado a `hasUnsavedDrafts` y ocultarlo en escritorio vía CSS.

### 2. Estilización del Diseño Mobile-First (CSS)

#### [MODIFY] [index.css](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/index.css)
* **Menú de Pestañas Premium (Pill-Tabs)**:
  * Cambiar las pestañas de texto simple por cápsulas/píldoras con bordes semi-transparentes y un color de fondo suave.
  * Aplicar un sombreado y gradiente al botón activo para que resalte.
* **Estilos del Layout de Partido Móvil**:
  * Definir `.match-card-body-mobile` con `display: flex; flex-direction: column; gap: 0.75rem;` y `.match-card-body-desktop` con `display: none;` en móvil.
  * Crear la clase `.team-row` para alinear equipo e input a los extremos (`justify-content: space-between`).
  * Invertir los estilos de visibilidad mediante media queries para resoluciones `>= 640px`.
* **Botón Flotante (`.floating-save-btn`)**:
  * Diseñar el botón con posición fija (`position: fixed`), fondo verde (`var(--success)`), bordes redondeados y una sombra proyectada.
  * Añadir la animación `@keyframes pulseSave` para dar un efecto de pulso suave.
* **Acordeón de Herramientas de Prueba**:
  * Diseñar la etiqueta `<details>` con un estilo limpio y cabecera indicativa para evitar que las herramientas administrativas ocupen espacio visual innecesario en móviles por defecto.

---

## Plan de Verificación

### Automated Tests
* Validar que la compilación de TypeScript y ESLint pasen sin errores:
  ```bash
  docker compose exec frontend npm run lint
  docker compose exec frontend npm run typecheck
  ```

### Manual Verification
* Probar la vista en navegadores móviles e incógnito en el host para verificar:
  * El colapso del panel administrativo.
  * La legibilidad y orden del nuevo layout de tarjeta vertical de partido.
  * La visibilidad del botón flotante verde al cambiar cualquier marcador, y su desaparición tras pulsar "Guardar".
  * El diseño estético de las pestañas en formato de píldora.
