# Plan de Implementación - Registro de Usuarios desde el Frontend (Sin Telegram)

Este plan detalla los cambios necesarios para permitir que la aplicación se use de manera independiente a Telegram, permitiendo a los usuarios registrarse directamente desde la pantalla de inicio de sesión web introduciendo un nombre de usuario y su nombre completo.

## Cambios Propuestos

### 1. Backend (FastAPI)

#### [MODIFY] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
* **Crear endpoint `POST /api/register`**:
  * Recibirá un modelo `RegisterRequest` con los campos `username` y `full_name`.
  * Limpiará y normalizará el `username` (ej. quitar `@`, convertir a minúsculas).
  * Validará que el nombre de usuario no esté duplicado en la base de datos.
  * Creará e insertará un nuevo `User` en la base de datos utilizando el `username` como `telegram_id` (para mantener la compatibilidad con el esquema actual sin hacer migraciones de base de datos) y el `username` como `username`.
  * Devolverá los detalles del usuario recién creado para que inicie sesión automáticamente.

* **Mejorar endpoint `POST /api/auth`**:
  * Hacer que la búsqueda de usuarios por alias o identificador de Telegram sea insensible a mayúsculas/minúsculas para evitar problemas de escritura en el login.

---

### 2. Frontend (React)

#### [MODIFY] [api.ts](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/services/api.ts)
* Añadir el método `register(username: string, fullName: string)` que llama a la ruta `POST /api/register` del backend y devuelve el usuario creado.

#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
* Modificar la vista de inicio de sesión (`!user`):
  * Añadir un estado `isRegistering` (booleano) para alternar entre la pantalla de "Iniciar sesión" y la de "Crear cuenta".
  * **Pantalla de Iniciar Sesión**: Muestra el formulario actual simplificado (introducir nombre de usuario) y un enlace abajo: *"¿No tienes cuenta? Regístrate aquí"*.
  * **Pantalla de Registro**: Muestra un formulario con dos campos:
    1. **Nombre de usuario (ej. edu_sanchez)**: Nombre corto en minúsculas usado para iniciar sesión.
    2. **Nombre completo (ej. Edu Sánchez)**: Nombre legible que se mostrará en la clasificación y las tablas.
    3. Un botón para enviar el formulario y un enlace abajo: *"¿Ya tienes cuenta? Inicia sesión"*.
  * Gestionar el envío del formulario de registro llamando al nuevo método `api.register` y realizando la autenticación automática del usuario una vez registrado.

---

## Plan de Verificación

### Pruebas Automáticas
* Añadir una prueba en [test_endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/tests/test_endpoints.py) para validar el flujo completo de registro y posterior autenticación a través del nuevo endpoint.

### Verificación Manual
1. Acceder a `http://localhost:3000`.
2. Probar a iniciar sesión con un usuario inexistente; verificar que da error "Usuario no encontrado".
3. Hacer clic en "Regístrate aquí" para ir a la vista de creación de cuenta.
4. Rellenar los campos "Nombre de usuario" (`pedro_perez`) y "Nombre completo" (`Pedro Pérez`) y hacer clic en registrarse.
5. Verificar que se crea el usuario, inicia sesión automáticamente y nos redirige al panel de control de la porra.
6. Cerrar sesión e intentar iniciarla de nuevo usando `pedro_perez` para confirmar que el login funciona de manera consistente.
