# Walkthrough: Permisos de Eliminación para @educonsul

Hemos implementado la funcionalidad para que el usuario `@educonsul` pueda eliminar a otros participantes de la porra de forma segura y directa desde la web.

---

## Cambios Realizados

### 1. Backend
* **[MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)**:
  * Nueva ruta `DELETE /api/users/{user_id}`.
  * Valida que el `current_user` tenga el `telegram_id` exacto de `"educonsul"`. Si no es así, devuelve un error `403 Prohibido`.
  * Realiza un borrado en cascada (primero elimina registros de `Prediction` y `TournamentPrediction` de ese usuario) para no violar restricciones de clave ajena, y luego elimina al `User`.

### 2. Frontend
* **[MODIFY] [api.ts](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/services/api.ts)**:
  * Añadida la llamada API asíncrona `deleteUser(userId)`.
* **[MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)**:
  * Renderiza una "❌" roja flotante a la derecha del nombre del participante en la tabla de clasificación.
  * La "❌" **solo se muestra si el usuario logueado actualmente es `educonsul`** (usando la comprobación `user?.telegram_id?.toLowerCase() === "educonsul"`). Ningún otro usuario la verá.
  * Al hacer clic en la "❌", se detiene la propagación del evento (para no abrir su ficha de predicciones) y se solicita confirmación. Tras confirmar, se elimina el usuario de base de datos y se actualiza la tabla.

---

## Verificación

### Pruebas Automatizadas
* Se añadió la prueba de integración `test_delete_user_flow` en [test_endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/tests/test_endpoints.py).
* Valida que:
  * Usuarios normales que intentan hacer DELETE reciben un `403`.
  * El usuario `educonsul` elimina exitosamente al usuario objetivo y este desaparece de la base de datos.
  * La suite completa de pruebas pasa exitosamente.
