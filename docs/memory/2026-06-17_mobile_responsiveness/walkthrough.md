# Walkthrough: Rediseño Completo Mobile-First

Hemos implementado un rediseño completo de la interfaz de usuario de la porra enfocado en dispositivos móviles (Mobile-First). Esto soluciona los problemas de desbordamiento horizontal y mejora significativamente la estética y usabilidad en pantallas pequeñas.

## Cambios de Diseño Implementados

### 1. Corrección Crítica del Modelo de Caja (`box-sizing`)
* **Problema raíz**: El archivo original de estilos solo declaraba `box-sizing: border-box` en la regla `:root`. Esto provocaba que cualquier input, botón o panel de ancho `100%` con paddings o bordes añadiera ese espacio extra externamente, estirando la pantalla móvil y causando desbordamientos.
* **Solución**: Se asignó de forma global la propiedad a todos los elementos usando el selector universal en `index.css`:
  ```css
  *, *::before, *::after {
    box-sizing: border-box;
  }
  ```
  Esto garantiza que el padding y el borde se calculen dentro del ancho del elemento, previniendo desbordamientos automáticos.

### 2. Tarjetas de Partido Apiladas en Vertical para Móviles
* **Diseño clásico (Escritorio)**: Mantiene la estructura de fila horizontal `[Team A] [Inputs] [Team B]`.
* **Diseño móvil (Mobile-First)**: Inspirado en aplicaciones deportivas como *SofaScore* o *ESPN*. En pantallas menores a `640px` la tarjeta se transforma en dos filas verticales independientes (una por equipo):
  * **Fila Superior (Equipo Local)**: Bandera y Nombre del país alineados a la izquierda, y marcador (real o input de entrada) alineado a la derecha.
  * **Fila Inferior (Equipo Visitante)**: Bandera y Nombre del país alineados a la izquierda, y marcador (real o input de entrada) alineado a la derecha.
  * Este diseño ofrece casi un **80% de ancho de pantalla** para el nombre del equipo, lo que hace físicamente imposible que un nombre largo empuje o rompa la tarjeta de partido.

### 3. Pestañas de Navegación de Píldora con Emojis
* Rediseñamos el menú de navegación superior `.tab-nav` para transformarlo en una barra de cápsula o píldoras con fondo translúcido y bordes redondeados.
* Añadimos emojis significativos a cada pestaña en `App.tsx` para mejorar la accesibilidad móvil y acortamos los textos para ahorrar espacio:
  * ⚽ Grupos
  * 🏆 Fase Final
  * 📋 Posiciones
  * 🎯 Especiales
  * 🏅 Clasificación
  * 📜 Reglas
* Los botones activos se resaltan con el color primario de acento (`var(--accent)`) y tienen un sombreado flotante para dar un efecto premium.

### 4. Botón Flotante de Guardado en Móviles (FAB)
* Para liberar espacio en la cabecera en móviles, el botón estático "Guardar Todo" del header se oculta en pantallas pequeñas.
* En su lugar, mediante React calculamos de forma reactiva si el usuario tiene cambios locales pendientes por guardar en el servidor (`hasUnsavedDrafts`).
* Si existen cambios pendientes, aparece un **Botón de Acción Flotante (`floating-save-btn`)** en la esquina inferior derecha. Cuenta con una micro-animación pulsante en color verde (`var(--success)`) para invitar sutilmente al usuario a guardar antes de salir. Desaparece automáticamente en cuanto se guardan los cambios o se restablecen los marcadores.

### 5. Panel de Herramientas de Prueba Colapsable
* Las herramientas de administración (simulación y reseteo de partidos) ocupaban demasiado espacio vertical en móvil por defecto.
* Envolvimos la barra `.control-toolbar` en una etiqueta nativa HTML `<details>` y `<summary>` en `App.tsx`.
* Ahora las herramientas de prueba se encuentran agrupadas bajo una pestaña colapsable ("🛠️ Herramientas de Desarrollo y Prueba") que permanece **cerrada por defecto** en móviles y escritorio, pero se despliega con un clic mostrando una animación suave.

---

## Verificación de Calidad

### Validaciones Estáticas (verify.sh)
Ejecutamos el conjunto completo de validaciones (Ruff, Mypy, ESLint, TypeScript Compiler y Vitest) a través de los contenedores de Docker. Los resultados pasaron exitosamente sin errores:

```bash
── backend: ruff ──
── frontend: eslint ──
All checks passed!
── backend: mypy ──
── frontend: tsc ──

> frontend@0.0.0 lint
> eslint .

Success: no issues found in 21 source files
── frontend: tsc ──

> frontend@0.0.0 typecheck
> tsc -b

✅ verify passed
```
