---
description: Genera una nueva versión de la Presentación Ejecutiva a partir de los documentos del proyecto.
---

Actúa como **@writer** (ver `.agents/agents.md`).

Este flujo de trabajo se activa cuando el usuario (especialmente Edu) solicita generar una nueva Presentación Ejecutiva mediante el comando `/presentacion`.

1. **Verificar.** Asegúrate de que los archivos de la documentación del proyecto en `docs/` y el historial en `docs/memory/` estén guardados y al día.
2. **Ejecutar.** Ejecuta el script generador de Python desde la raíz del proyecto:
   ```bash
   python3 scripts/generate_presentation.py
   ```
3. **Confirmar.** Revisa el mensaje de éxito del script para comprobar qué número de versión se ha generado (ej: `v1`, `v2`, `v3`) y que el archivo `versions.json` registre la nueva versión.
4. **Informar a Edu.** Responde a Edu con la máxima claridad y sin tecnicismos complejos:
   * Confirma que la compilación se ha completado correctamente.
   * Proporciona el enlace directo para visualizar la versión recién generada: `http://localhost:3000/presentacion-ejecutiva/versions/v<N>/index.html` (reemplaza `v<N>` con la versión real).
   * Proporciona el enlace general al portal que siempre apunta a la versión más nueva: `http://localhost:3000/presentacion-ejecutiva/`
