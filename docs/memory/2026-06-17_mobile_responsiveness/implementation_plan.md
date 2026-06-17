# Plan de Implementación: Frontend Mobile-Friendly

Este plan describe los cambios necesarios en el frontend para asegurar que la aplicación de la porra (Yorra Mundial 2026) sea completamente responsiva y amigable en dispositivos móviles, previniendo los desbordamientos de pantalla reportados.

## User Review Required

> [!NOTE]
> Para la navegación principal (`.tab-nav`), en lugar de colapsar las pestañas en un menú desplegable (que escondería opciones principales), proponemos mantenerlas en una sola línea pero habilitar un **desplazamiento horizontal fluido (swipe/scroll)** con barra de desplazamiento oculta. Este es el patrón de diseño móvil más común y estético para menús de pestañas.

> [!WARNING]
> La sección del simulador de Fase Final (Bracket) requiere desplazarse horizontalmente en móviles para ver todas las rondas (ya que no caben 5 columnas en 375px). Agregaremos un contenedor con `overflow-x: auto` y suavizado de scroll para que la experiencia sea fluida.

## Proposed Changes

### Frontend styling and layouts

---

#### [MODIFY] [index.css](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/index.css)
* Crear clases responsivas para reemplazar estilos inline en `App.tsx` (márgenes y paddings excesivos en móvil).
* Modificar `.tab-nav` para permitir scroll horizontal fluido sin barras de desplazamiento visibles en móvil.
* Modificar `.matches-grid` para que use `grid` real (1 columna en móvil, 2 en pantallas de tablets/computadores) en lugar de una lista vertical larga.
* Ajustar la tarjeta de partido `.match-card` y el nombre de los equipos `.team-name` con `word-break: break-word` y `min-width: 0` para evitar que nombres largos (ej. "República Democrática del Congo") ensanchen la tarjeta más allá del viewport.
* Modificar la visualización del podio `.podium` para encogerse ordenadamente en pantallas pequeñas sin encabalgarse.
* Agregar media queries para la tarjeta de autenticación (`.auth-card`), toolbar de herramientas (`.control-toolbar`), el banner del modo lectura (`.viewing-user-banner`) y tablas.

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* Reemplazar los estilos inline que fuerzan paddings de `2rem` o `2.5rem` por nuevas clases CSS asociadas:
  * El contenedor `<main>` principal (`padding: "0 2rem 2rem 2rem"` -> `className="main-content"`).
  * El panel de herramientas de prueba (`style={{ margin: "1rem 2rem", ... }}` -> `className="control-toolbar glass-panel"`).
  * El contenedor de Apuestas Especiales (`style={{ maxWidth: "600px", margin: "0 auto" }}` -> `className="sidebets-container"` y su panel interno -> `className="sidebets-panel glass-panel"`).
  * Las posiciones de grupo (`style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}` -> `className="standings-grid"`).
  * El panel de crónicas diarias de la IA (`style={{ marginTop: "2rem", padding: "2rem", borderRadius: "16px" }}` -> `className="ai-summaries-panel glass-panel"`).
  * El panel de reglas y puntuación (`style={{ padding: "2.5rem", borderRadius: "16px" }}` -> `className="rules-panel glass-panel"`).

## Verification Plan

### Automated Tests
* Ejecutar verificación estática y tipado del frontend en Docker:
  ```bash
  docker compose exec frontend npm run lint
  docker compose exec frontend npm run typecheck
  ```

### Manual Verification
* Dado que el `browser_subagent` ha fallado por problemas de contexto CDP en este entorno local, la verificación visual debe ser realizada manualmente o mediante un navegador real en el host.
* Pasos para la verificación manual:
  1. Abrir `http://localhost:3000` en un navegador web (e.g. Chrome/Safari) en el host.
  2. Activar las herramientas de desarrollador y emular un dispositivo móvil (ej: iPhone SE o iPhone 12/13/14 Pro - anchos de 375px a 390px).
  3. Comprobar que:
     * El menú de navegación de pestañas se desplaza horizontalmente deslizando el dedo y no se sale de los bordes de la pantalla.
     * La lista de partidos de grupos se ajusta al ancho de la pantalla y no hay scroll horizontal general en el body.
     * Los nombres largos de los equipos se envuelven en varias líneas y no rompen la tarjeta.
     * La pestaña de apuestas especiales y reglas se ven legibles sin márgenes gigantes a los lados.
     * El podio de clasificación general se escala proporcionalmente.
