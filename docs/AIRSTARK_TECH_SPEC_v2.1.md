# AIRSTARK — Contrato de API / Especificación Técnica Backend v2.1

Este documento constituye la **única fuente de verdad** para la integración técnica entre el **Frontend (React/Vite)**, **Backend (NestJS/NodeJS)** y **Unity/AR** del proyecto AIRSTARK. Todo lo definido aquí es la **IMPLEMENTACIÓN DEFINITIVA** para producción.

## 1. Principios Arquitectónicos
- **Backend como Única Autoridad:** Validaciones, estados, corrección (`isCorrect`), puntaje (`score`), expiración absoluta (`expiresAt`), e identidad.
- **Seguridad 1 (Profesor):** Autenticación estricta mediante **Cookie HttpOnly**.
- **Seguridad 2 (Estudiante):** Autenticación mediante **`studentToken`** opaco.
- **1:N (Sesiones Multi-Estudiante):** 1 Profesor → 1 Sesión → N Estudiantes. El estudiante completado no finaliza la sesión global.

## 2. Autenticación del Profesor y CSRF
### 2.1 Flujo de Autenticación Definitivo
1. **Google Identity Services:** El profesor obtiene el Google ID Token (`credential`). Este token **solo** se utiliza en `/api/v1/auth/login`. El Frontend no debe enviar `teacherId`, `userId`, `email` ni `role`. La identidad se obtiene exclusivamente del token validado por Backend.
2. **Cookie de Sesión AIRSTARK:** Backend genera la sesión AIRSTARK y envía una cookie con: `HttpOnly = true`, `Secure = true`, `SameSite = Lax` (o `None` si es estrictamente necesario cross-site y con CSRF real), y `Path = /`. Preferir `__Host-<cookie-name>` cuando la topología lo permita. No utilizar `Domain` salvo que sea estrictamente necesario. No permitir `Access-Control-Allow-Origin: *` con credenciales.
3. **Almacenamiento y Frontend:** El Frontend **NO** puede leer la cookie HttpOnly. Por lo tanto, no debe intentar leerla, copiarla, ni guardarla en Web Storage. El Frontend envía credenciales usando `credentials: include`.

### 2.2 Logout
*   **`POST /api/v1/auth/logout`**
*   **Autenticación:** Cookie de sesión.
*   **Backend:** Invalida sesión/token, inutiliza cookie, retorna `204 No Content`.
*   **Frontend:** Llama a `logout()` sin inventar endpoints adicionales.

### 2.3 Protección CSRF (IMPLEMENTACIÓN DEFINITIVA)
Las operaciones mutantes (`POST`, `PUT`, `PATCH`, `DELETE`) autenticadas por cookie requieren protección CSRF explícita:
- Backend valida `Origin` en requests mutantes.
- Backend valida `Sec-Fetch-Site` cuando esté disponible.
- Backend utiliza un mecanismo CSRF explícito (ej. tokens anti-CSRF sincronizados o double submit cookie). `SameSite` es defensa adicional, no única defensa.
- Frontend utilizará el mecanismo CSRF que defina Backend.

## 3. Autenticación del Estudiante (Unity) y ROTACIÓN
### 3.1 `studentToken` (IMPLEMENTACIÓN DEFINITIVA)
- Token **opaco**, criptográficamente aleatorio, **no JWT**, vinculado estrictamente a `sessionId + studentId`, revocable y de duración limitada.
- `studentToken.expiresAt <= session.expiresAt`. Si se usa TTL propio: `studentToken TTL = min(studentTokenTTL, session.expiresAt - now)`.
- Backend almacena **únicamente un hash irreversible** del `studentToken`. Backend **NO** almacena el token original en texto plano ni utiliza hash cifrado.
- Backend invalida el token si expira, si la sesión termina, o si se revoca/re-conecta.

### 3.2 Rotación de `studentToken`
- Regla: Mismo `sessionId` + mismo `deviceId` → resuelve a mismo `studentId` → generar **nuevo `studentToken`** → **invalidar token anterior**.
- Si llega una petición con el token anterior tras la invalidación, Backend responde obligatoriamente `401 UNAUTHORIZED`.

### 3.3 El Código QR y `deviceId`
- **QR:** Contiene **EXCLUSIVAMENTE** el `sessionId`. No colocar token de profesor ni `studentToken`.
- **`deviceId`:** Backend exige `UNIQUE(session_id, device_id)`. **No autentica**, no autoriza, no representa identidad humana. Solo detecta reconexiones.

## 4. Expiración y Fechas (Backend es Autoridad)
- **`durationMinutes`:** Duración académica oficial.
- **`expiresAt`:** Límite absoluto. Frontend y Unity NUNCA lo modifican.
- **`activationDate` (Fase 1):** Metadata de programación. Su valor futuro no bloquea la creación de la sesión.
- Backend posee job de expiración idempotente que emite `session_ended` **una sola vez**.

## 5. Idempotencia, Payload y Rate Limiting
### 5.1 Idempotency-Key — CONTRATO FINAL
- `POST /api/v1/sessions` requiere obligatoriamente cabecera `Idempotency-Key: <UUID>`.
- Generado por Frontend por cada operación lógica de creación. No reutilizar entre evaluaciones.
- La clave está vinculada a `authenticatedUser + Idempotency-Key` (un usuario no puede reutilizar la de otro).
- Repetir misma clave + usuario = devuelve resultado original.
- Misma clave + diferente payload = responde `409 IDEMPOTENCY_CONFLICT`.

### 5.2 Límites de Payload y Rate Limiting
- Backend limitará razonablemente el tamaño de: título, descripción, prompts, textos de opción, `studentName`, `deviceId`, y el body total (requisito Backend).
- **429 RATE_LIMITED** obligatorio y configurable por entorno en: `/auth/login`, `/auth/logout`, `/sessions`, `/connect`, `/answers` y Socket.IO.

## 6. Límite de Estudiantes y Estados
### 6.1 Límite de Estudiantes
- `MAX_STUDENTS_PER_SESSION` en Backend. Responde `409 SESSION_FULL` al rebasarse.

### 6.2 Transiciones de Estado (Backend)
- Sesión: `waiting` → `active` / `completed` / `expired` / `cancelled`. Las transiciones ilegales son rechazadas de forma determinista.
- Estudiante: `connected` → `in_progress` → `completed` (o a `disconnected`).

## 7. Modelo de Datos y Ownership
Entidades a mantener: `Users`, `Evaluations`, `Questions`, `Options`, `Sessions`, `Session_Students`, `Student_Answers`.
Restricciones obligatorias atómicas en BD:
- `UNIQUE(session_id, device_id)`
- `UNIQUE(session_student_id, question_id)`

**Ownership:** Derivar identidad siempre del contexto autenticado (token/cookie), no confiar en `teacherId` o `userId` enviado en payloads por el cliente. Backend debe verificar el recurso específico.

## 8. Contratos REST (Endpoints)

Base URL: `https://api.airstark.dev/api/v1` (HTTPS obligatorio).
**Cache:** `Cache-Control: no-store` obligatorio para respuestas de autenticación, información privada, endpoints con riesgo de caché compartido, y `GET /sessions`.

### 8.1. Autenticación y Cierre (Profesor)
* **`POST /auth/login`**: Response configura Cookie HttpOnly.
* **`POST /auth/logout`**: Invalida Cookie.

### 8.2. Crear Sesión
* **`POST /sessions`**: Auth por Cookie. Requiere `Idempotency-Key`. Retorna estado inicial de la sesión.

### 8.3. Finalizar Sesión Manual
* **`POST /sessions/{sessionId}/end`**
  - **Auth:** Cookie HttpOnly de profesor.
  - **Validaciones:** Sesión existe, usuario es propietario, estado actual es `waiting` o `active`. Si está completada (`409 SESSION_COMPLETED`), cancelada (`409 SESSION_CANCELLED`), o expirada (`410 SESSION_EXPIRED`).
  - **Response (200 OK):** `{ "sessionId": "uuid", "status": "completed" }` y emite `session_ended` exactamente una vez.

### 8.4. Obtener Sesión (Unity)
* **`GET /sessions/{sessionId}`**
  - **Auth:** Ninguna en Fase 1.
  - **Restricción Estricta:** Rate limiting, payload mínimo. **NUNCA** devolver información privada, `isCorrect`, `studentToken`, `score` individual o datos del profesor (solo lo estrictamente necesario). Cache-Control: no-store.

### 8.5. Conectar Estudiante (Unity)
* **`POST /sessions/{sessionId}/connect`**
  - **Auth:** No requiere autenticación inicial.
  - **Validaciones:** Rate limiting, sessionId, estado, expiresAt, max students, studentName, deviceId, y anti-duplicados.
  - **Response Definitiva:** `{ "studentId": "uuid", "studentToken": "opaque-token", "sessionId": "uuid", "status": "connected", "joinedAt": "..." }`

### 8.6. Enviar Respuesta (Unity)
* **`POST /sessions/{sessionId}/answers`**
  - **Auth:** `Authorization: Bearer <studentToken>`
  - **Validaciones en cadena:** `studentToken` válido → `studentId` coincide → `studentId` pertenece a `sessionId` → `questionId` pertenece a `evaluation` → `optionId` pertenece a `question`. Nunca confiar solo en IDs enviados.
  - **Repetición (Replay):** Protegido por `UNIQUE(session_student_id, question_id)`. Si llega de nuevo, no sobrescribir, no incrementar score y retornar `409 ALREADY_ANSWERED`.

## 9. WebSockets (Socket.IO)

* **Protocolo y Path:** Socket.IO, `path = /socket.io`.
* **CORS / Origin:** Backend acepta conexiones **solamente** de orígenes oficiales (development, staging, production). Nunca `*`. Valida Origin antes del join.
* **Autenticación (IMPLEMENTACIÓN DEFINITIVA):** Browser hace handshake → incluye automáticamente cookie HttpOnly → Backend autentica sesión → Frontend solicita `join_session(sessionId)` → Backend verifica ownership → une al room `session:{sessionId}`. (El Frontend NO lee ni pasa la cookie en Javascript).
* **Eventos Oficiales Emitidos:** `session_state`, `student_connected`, `student_answered`, `student_completed`, `session_ended`.

## 10. Contrato de Errores Definitivo
Formato canónico obligatorio con códigos cerrados (no mezclar significados):
* `400 VALIDATION_ERROR`
* `401 UNAUTHORIZED`
* `403 FORBIDDEN`
* `404 SESSION_NOT_FOUND`
* `409 IDEMPOTENCY_CONFLICT`
* `409 SESSION_CANCELLED`
* `409 SESSION_COMPLETED`
* `409 ALREADY_ANSWERED`
* `409 SESSION_FULL`
* `410 SESSION_EXPIRED`
* `429 RATE_LIMITED`
* `500 SERVER_ERROR`

## 11. Seguridad (Security Headers y OWASP)
* **Headers:** `Content-Security-Policy` (solo recursos legítimos, no wildcards), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.
* **OWASP API Security obligatoria:** Pruebas contra Broken Object Level Authorization (BOLA), Broken Authentication, BOPLA, Unrestricted Resource Consumption, Broken Function Level Authorization y Security Misconfiguration.

---

## 12. Pruebas Obligatorias (E2E y Seguridad)

**Autenticación**
* login válido, token Google inválido, token Google expirado, logout, cookie inválida.
**Ownership**
* profesor A → sesión A = permitido
* profesor A → sesión B = 403
**Estudiante**
* connect válido, connect duplicado, max students, token válido, token expirado, token anterior después de rotación (espera 401).
**Answers**
* respuesta válida, respuesta duplicada (409), optionId ajeno a questionId, questionId ajeno a evaluation, studentId ajeno a session, token perteneciente a otro estudiante. (Student A intenta responder como Student B = Falla).
**Session**
* waiting, active, completed, expired, cancelled.
**WebSocket**
* conexión válida, sin sesión válida, profesor accediendo a sesión ajena, reconexión, `session_state`, `session_ended`.
**Seguridad**
* CSRF, XSS, IDOR/BOLA, rate limiting, payload excesivo, replay de peticiones, cache leakage.
