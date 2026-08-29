# AIRSTARK — Especificación Técnica del Backend (v2.0)

**Versión:** 2.0  
**Fecha:** 2026-08-29  
**Propósito:** Guía oficial de integración e implementación para el desarrollador de Backend y el equipo de Unity.

Este documento define sin ambigüedades la arquitectura, el modelo de datos, los contratos de API y los flujos de comunicación entre los tres actores del sistema:

```
Frontend React/Vite (Docente)
          ↕
    Backend API (Fuente de Verdad)
          ↕
  Unity / Realidad Aumentada (Estudiante)
```

---

## 0. Principio Arquitectónico General

Cada actor del sistema tiene responsabilidades estrictamente definidas:

| Actor | Responsabilidades |
|---|---|
| **Frontend (Web)** | Autentica al profesor. Configura la evaluación. Envía solicitudes al Backend. Genera y muestra el QR con el `sessionId`. Muestra estadísticas en tiempo real. |
| **Backend** | Es la fuente de verdad. Autentica y autoriza. Valida todos los datos. Administra sesiones. Guarda información. Evalúa respuestas. Calcula resultados. Protege el campo `isCorrect`. Sincroniza Frontend y Unity mediante WebSockets. |
| **Unity** | Escanea el QR. Solicita la identidad del estudiante. Obtiene de la API los datos de la sesión (sin respuestas correctas). Ejecuta la experiencia AR. Envía progreso y respuestas al Backend. **Nunca determina si una respuesta es correcta.** |

---

## 1. Análisis del Frontend Actual

### Archivos Clave

| Archivo | Propósito |
|---|---|
| `App.tsx` | Orquestador principal. Gestiona los modos (`EXPLORE`, `NAVIGATION`, `QUIZ`, `EVALUATION`, `DRAW`), el visor 3D y el estado de autenticación. |
| `services/googleAuth.ts` | Maneja el login con Google Identity Services (GIS). Obtiene el JWT (`credential`), lo decodifica y lo almacena en `sessionStorage` (`airstark_token`). |
| `components/Evaluation.tsx` | Dashboard del profesor: `PanelView`, `InformacionView`, `ModeloView`, `CuestionarioView`, `CodigoQRView`, `EstadisticasView`. |
| `types/evaluation.ts` | Tipos TypeScript del Frontend: `EvaluationDraft`, `CreateSessionRequest`, `CreateSessionResponse`. |
| `services/evaluationMapper.ts` | Transforma `EvaluationDraft` (formato interno del Frontend, en español) al contrato JSON de la API (`CreateSessionRequest`, en camelCase). |
| `services/evaluationApi.ts` | Realiza el `POST /api/v1/sessions` al Backend. Inyecta automáticamente el token en `Authorization: Bearer <token>`. Soporta modo Mock (`VITE_USE_MOCK_API=true`). |
| `docs/API_CONTRACT.md` | Reglas arquitectónicas iniciales de integración. |

### Flujo de Información (Extremo a Extremo)

1. **Login (Web):** El profesor inicia sesión con Google. El Frontend guarda el JWT de Google en `sessionStorage`.
2. **Configuración (Web):** El profesor define título, descripción, modelo anatómico, duración y preguntas de opción múltiple.
3. **Creación de Sesión (Web → Backend):** Al pulsar "Generar código QR", `evaluationApi.ts` envía `POST /api/v1/sessions` con toda la configuración. El Backend responde con `sessionId`, `status: 'waiting'` y `expiresAt`.
4. **QR (Web):** El componente `CodigoQRView` renderiza un QR que contiene **únicamente el `sessionId`**.
5. **Escaneo (Estudiante → Unity):** El estudiante abre la app de Unity, escanea el QR y la app extrae el `sessionId`.
6. **Validación (Unity → Backend):** Unity llama a `GET /api/v1/sessions/{sessionId}` para verificar que la sesión existe, está activa y no expiró.
7. **Conexión (Unity → Backend):** Unity registra al estudiante con `POST /api/v1/sessions/{sessionId}/connect`. Recibe un `studentId` que conserva para el resto de la sesión.
8. **Evaluación (Unity ↔ Backend):** Unity presenta las preguntas. Por cada respuesta del estudiante, llama a `POST /api/v1/sessions/{sessionId}/answers`. El Backend calcula si es correcta, guarda el resultado y emite un evento WebSocket.
9. **Estadísticas en Vivo (Backend → Web):** El Frontend recibe los eventos WebSocket y actualiza la `EstadisticasView` en tiempo real.
10. **Fin:** La sesión termina cuando el tiempo expira, todos completan o el profesor la cancela.

---

## 2. Arquitectura del Backend

### Stack Tecnológico Recomendado

- **Framework:** Node.js con **NestJS** (TypeScript). Permite compartir los tipos de `types/evaluation.ts` y facilita el manejo de WebSockets y módulos. Alternativa: Python con FastAPI.
- **Base de Datos:** **PostgreSQL** (naturaleza relacional: Profesores → Evaluaciones → Sesiones → Estudiantes → Respuestas).
- **ORM:** Prisma o TypeORM.
- **Tiempo Real:** **Socket.io** (WebSockets con rooms por `sessionId`).
- **Autenticación:** `google-auth-library` para verificar el JWT de Google.

### Variables de Entorno Relevantes del Frontend

```
VITE_GOOGLE_CLIENT_ID=   # Client ID del proyecto de Google Cloud
VITE_API_BASE_URL=       # URL base del Backend (ej. https://api.airstark.dev)
VITE_USE_MOCK_API=       # "true" para desarrollo sin Backend, "false" en producción
```

---

## 3. Modelo de Base de Datos

### Diagrama de Relaciones

```
Users
  └── Evaluations
        ├── Questions
        │     └── Options
        └── Sessions
              └── Session_Students
                    └── Student_Answers
```

### Tablas Detalladas

#### `Users` (Docentes)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | Identificador interno del sistema |
| `google_id` | String, Unique | `sub` del JWT de Google |
| `email` | String, Unique | Correo del profesor |
| `name` | String | Nombre completo |
| `picture` | String | URL del avatar de Google |
| `created_at` | Timestamp | Fecha de registro |

#### `Evaluations`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | — |
| `teacher_id` | UUID, FK → Users | Dueño de la evaluación |
| `title` | String | Título de la evaluación |
| `description` | Text | Descripción/objetivos |
| `duration_minutes` | Int | Tiempo límite en minutos |
| `model_asset_id` | String | Identificador del modelo 3D (ej. `"heart"`) |
| `activation_date` | Date | Fecha programada de activación |
| `created_at` | Timestamp | — |

#### `Questions`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | — |
| `evaluation_id` | UUID, FK → Evaluations | — |
| `prompt` | Text | Enunciado de la pregunta |
| `order` | Int | Orden de presentación |

#### `Options`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | — |
| `question_id` | UUID, FK → Questions | — |
| `text` | String | Texto de la opción |
| `is_correct` | Boolean | **NUNCA se envía a Unity** |

#### `Sessions`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | El `sessionId` que va en el QR |
| `evaluation_id` | UUID, FK → Evaluations | — |
| `status` | Enum | Ver estados abajo |
| `expires_at` | Timestamp | Calculado y controlado por el Backend |
| `created_at` | Timestamp | — |

**Estados válidos de `Sessions.status`:**

| Estado | Descripción |
|---|---|
| `waiting` | Sesión creada por el profesor. Esperando conexiones de Unity. |
| `active` | Al menos un estudiante se conectó. La evaluación está en curso. |
| `completed` | Evaluación finalizada con éxito (todos completaron o el profesor la cerró). |
| `expired` | El `expiresAt` fue alcanzado sin que se completara. |
| `cancelled` | El profesor la canceló manualmente. |

**Transiciones de estado permitidas:**

```
waiting  → active     (primer estudiante conectado)
waiting  → expired    (se alcanzó expiresAt)
waiting  → cancelled  (el profesor cancela)
active   → completed  (evaluación finalizada)
active   → expired    (se alcanzó expiresAt)
active   → cancelled  (el profesor cancela)
```

#### `Session_Students`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | `studentId` que Unity conserva |
| `session_id` | UUID, FK → Sessions | — |
| `student_name` | String | Nombre ingresado por el estudiante en Unity |
| `device_id` | String | Identificador del dispositivo de Unity (ver §8) |
| `status` | Enum | Ver estados abajo |
| `score` | Int | Calculado por el Backend al responder |
| `joined_at` | Timestamp | — |
| `completed_at` | Timestamp | Cuándo terminó la evaluación |

**Estados válidos de `Session_Students.status`:**

| Estado | Descripción |
|---|---|
| `connected` | Estudiante conectado, evaluación no iniciada. |
| `in_progress` | Respondiendo preguntas activamente. |
| `completed` | Terminó todas las preguntas. |
| `disconnected` | Perdió la conexión durante la sesión. |

> **Nota importante:** Los estados de los estudiantes son **independientes** del estado de la sesión. Una sesión puede estar `active` con estudiantes en distintos estados simultáneamente.

#### `Student_Answers`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID, PK | — |
| `session_student_id` | UUID, FK → Session_Students | — |
| `question_id` | UUID, FK → Questions | — |
| `selected_option_id` | UUID, FK → Options | Opción elegida por el estudiante |
| `is_correct` | Boolean | Calculado por el Backend al momento de guardar |
| `answered_at` | Timestamp | — |

---

## 4. Flujo de Autenticación (Oficial)

### Flujo Recomendado para Fase 1

El Frontend actualmente envía el JWT de Google directamente en cada petición. Para Fase 1 esto es aceptable **mientras el Backend lo valide criptográficamente en cada request**. Sin embargo, el plan definitivo es:

**Paso 1:** El profesor inicia sesión en Google Identity Services (en el Frontend).

**Paso 2:** El Frontend obtiene el `credential` (JWT de Google) y lo envía al Backend:

```
POST /api/v1/auth/login
Authorization: (ninguna)
Content-Type: application/json
```
```json
{
  "credential": "<JWT de Google>"
}
```

**Paso 3:** El Backend verifica el JWT usando `google-auth-library`:
```typescript
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
const payload = ticket.getPayload(); // { sub, email, name, picture }
```

**Paso 4:** El Backend crea o actualiza el `User` en base de datos y emite su **propio token de sesión**.

**Paso 5:** Respuesta del Backend:
```json
{
  "token": "<JWT interno de AIRSTARK>",
  "user": {
    "id": "uuid-interno",
    "email": "profesor@universidad.edu",
    "name": "Dr. García",
    "picture": "https://..."
  }
}
```

**Paso 6:** El Frontend almacena el `token` de AIRSTARK (no el de Google) y lo usa en todas las peticiones siguientes.

### Decisión de Implementación: Cookie vs JWT

| Mecanismo | Ventajas | Desventajas |
|---|---|---|
| **Cookie `HttpOnly`** | Más segura (no accesible desde JS). Resistente a XSS. | Requiere configuración de CORS con `credentials: 'include'`. Complicada para Unity. |
| **JWT propio (Bearer)** | Más simple. Compatible con Unity y Web por igual. | El token debe tener vida corta + refresh token. |

**Recomendación para Fase 1:** JWT propio como Bearer token con expiración de 8 horas. El token de Google NO debe usarse como mecanismo permanente porque expira en 1 hora.

---

## 5. Diseño de APIs — Contratos Completos

### Base URL
```
https://api.airstark.dev/api/v1
```

Todas las respuestas de error siguen este formato:
```json
{
  "error": "SESSION_EXPIRED",
  "message": "La sesión ha expirado.",
  "statusCode": 410
}
```

---

### 5.1 `POST /api/v1/auth/login`
**Propósito:** Intercambiar el JWT de Google por un token interno de AIRSTARK.  
**Autenticación requerida:** Ninguna.

**Request:**
```json
{
  "credential": "<JWT de Google>"
}
```

**Response `200 OK`:**
```json
{
  "token": "<JWT interno AIRSTARK>",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "profesor@universidad.edu",
    "name": "Dr. Carlos García",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

**Validaciones:**
- El `credential` debe ser un JWT válido emitido por Google para el `client_id` del proyecto.

**Errores posibles:**
- `401` — JWT de Google inválido o expirado.

**Cambios en BD:** Crea o actualiza el registro en `Users`.  
**Eventos WebSocket:** Ninguno.

---

### 5.2 `POST /api/v1/sessions` ⬅ FASE 1 (Flujo Actual del Frontend)
**Propósito:** Crear una evaluación y su sesión asociada en una sola operación.  
**Autenticación requerida:** `Authorization: Bearer <token AIRSTARK>`

**Request:** (generado por `evaluationMapper.ts` del Frontend)
```json
{
  "evaluation": {
    "title": "Evaluación del Corazón",
    "description": "Examen final de anatomía cardíaca.",
    "durationMinutes": 20,
    "activationDate": "2026-08-29",
    "modelAssetId": "heart",
    "questions": [
      {
        "prompt": "¿Cuántas cavidades tiene el corazón humano?",
        "options": [
          { "id": "A", "text": "2", "isCorrect": false },
          { "id": "B", "text": "4", "isCorrect": true },
          { "id": "C", "text": "6", "isCorrect": false },
          { "id": "D", "text": "3", "isCorrect": false }
        ]
      }
    ]
  }
}
```

**Response `201 Created`:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "expiresAt": "2026-08-29T17:00:00.000Z"
}
```

**Validaciones:**
- El token de AIRSTARK debe ser válido.
- `evaluation.title` no puede estar vacío.
- `evaluation.durationMinutes` debe ser un entero entre 3 y 180.
- Cada `question` debe tener exactamente 1 opción con `isCorrect: true`.
- Cada `question` debe tener al menos 2 opciones.

**Errores posibles:**
- `401` — Token inválido o expirado.
- `400` — Datos de evaluación incompletos o inválidos.

**Cambios en BD:**
1. Recuperar el `teacher_id` del token.
2. Insertar registro en `Evaluations`.
3. Insertar registros en `Questions` (uno por pregunta).
4. Insertar registros en `Options` (uno por opción, con `is_correct`).
5. Insertar registro en `Sessions` con `status = 'waiting'` y `expires_at = now() + durationMinutes + margen`.

**Eventos WebSocket:** Ninguno.

> **Nota Fase 2:** En una implementación futura, este endpoint recibirá únicamente `{ evaluationId: "uuid" }` para reutilizar plantillas existentes. Ver §9.

---

### 5.3 `GET /api/v1/sessions/{sessionId}` ⬅ CONSUMIDO POR UNITY
**Propósito:** Obtener el estado y el contenido de una sesión para que Unity cargue la evaluación.  
**Autenticación requerida:** Ninguna (el `sessionId` como UUIDv4 es suficiente protección en Fase 1).

**Request:** Sin body.

**Response `200 OK`:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "expiresAt": "2026-08-29T17:00:00.000Z",
  "evaluation": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "title": "Evaluación del Corazón",
    "description": "Examen final de anatomía cardíaca.",
    "durationMinutes": 20,
    "modelAssetId": "heart",
    "questions": [
      {
        "id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        "prompt": "¿Cuántas cavidades tiene el corazón humano?",
        "options": [
          { "id": "a1b2c3d4-...", "text": "2" },
          { "id": "e5f6g7h8-...", "text": "4" },
          { "id": "i9j0k1l2-...", "text": "6" },
          { "id": "m3n4o5p6-...", "text": "3" }
        ]
      }
    ]
  }
}
```

> ⚠️ **CRÍTICO — Anti-Trampas:** El campo `isCorrect` **NUNCA** debe incluirse en esta respuesta. Unity solo recibe `id` y `text` de cada opción. El Backend es el único que evalúa la corrección.

**Errores posibles:**
- `404` — La sesión no existe.
- `410` — La sesión expiró (`status = 'expired'`).
- `409` — La sesión fue cancelada (`status = 'cancelled'`).

**Cambios en BD:** Ninguno.  
**Eventos WebSocket:** Ninguno.

---

### 5.4 `POST /api/v1/sessions/{sessionId}/connect` ⬅ CONSUMIDO POR UNITY
**Propósito:** Registrar al estudiante en la sesión. Unity conserva el `studentId` resultante para identificar al estudiante en el resto de la sesión.  
**Autenticación requerida:** Ninguna en Fase 1.

**Request:**
```json
{
  "studentName": "Juan Pérez",
  "deviceId": "UNITY-DEVICE-XYZ-12345"
}
```

**Response `201 Created`:**
```json
{
  "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "connected",
  "joinedAt": "2026-08-29T14:32:00.000Z"
}
```

**Validaciones:**
- La sesión debe existir.
- La sesión debe estar en estado `waiting` o `active`.
- La sesión no debe haber expirado.
- `studentName` no puede estar vacío.

**Lógica de Reconexión y Anti-Duplicados:**  
El Backend debe buscar si ya existe un `Session_Students` con el mismo `device_id` y `session_id`:
- **Si existe:** Devolver el `studentId` existente con `status` actualizado a `connected`. No crear duplicado.
- **Si no existe:** Crear nuevo registro en `Session_Students`.

**Errores posibles:**
- `404` — La sesión no existe.
- `410` — La sesión expiró.
- `409` — La sesión está `completed` o `cancelled`.
- `400` — `studentName` vacío.

**Cambios en BD:**
1. Insertar o actualizar registro en `Session_Students` (`status = 'connected'`).
2. Si la sesión estaba en `waiting`, cambiar `Sessions.status` a `active`.

**Eventos WebSocket:** Emitir `student_connected` a la room `session:{sessionId}`.

---

### 5.5 `POST /api/v1/sessions/{sessionId}/answers` ⬅ CONSUMIDO POR UNITY
**Propósito:** Registrar la respuesta individual de un estudiante para una pregunta.  
**Autenticación requerida:** Ninguna en Fase 1 (el `studentId` sirve de identificación).

**Estrategia:** Unity envía **una respuesta a la vez** (no un arreglo al final). Esto permite estadísticas en tiempo real en el Dashboard del profesor.

**Request:**
```json
{
  "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "questionId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "optionId": "e5f6g7h8-..."
}
```

**Response `200 OK`:**
```json
{
  "accepted": true,
  "progress": {
    "answered": 1,
    "total": 5
  }
}
```

> **Nota:** La respuesta NO indica si fue correcta o incorrecta. Unity puede mostrar animaciones de "respuesta enviada" pero no debe mostrar si fue acertada basándose en esta respuesta.

**Pasos de Validación del Backend (en orden):**
1. Verificar que la sesión existe y tiene `status = 'active'`.
2. Verificar que la sesión no ha expirado (`expires_at > now()`).
3. Verificar que el `studentId` pertenece a esta sesión.
4. Verificar que la `questionId` pertenece a la evaluación de esta sesión.
5. Verificar que la `optionId` pertenece a la `questionId`.
6. Verificar que el estudiante no ha respondido ya esta pregunta.
7. Calcular `is_correct` consultando `Options.is_correct` en BD.
8. Insertar registro en `Student_Answers`.
9. Recalcular y actualizar `Session_Students.score`.
10. Si el estudiante respondió todas las preguntas, actualizar `Session_Students.status = 'completed'` y registrar `completed_at`.
11. Emitir evento WebSocket correspondiente.

**Qué ocurre si el estudiante responde una pregunta ya respondida:**
- `409 Conflict` — `{ "error": "ALREADY_ANSWERED", "message": "Esta pregunta ya fue respondida." }`
- No se sobreescribe la respuesta original.

**Errores posibles:**
- `404` — Sesión, estudiante, pregunta u opción no encontrada.
- `410` — Sesión expirada.
- `403` — El `studentId` no pertenece a esta sesión.
- `409` — La pregunta ya fue respondida.
- `400` — Campos faltantes.

**Cambios en BD:**
1. Insertar en `Student_Answers` con `is_correct` calculado.
2. Actualizar `Session_Students.score`.
3. (Si completó todo) Actualizar `Session_Students.status = 'completed'` y `completed_at`.

**Eventos WebSocket:** Emitir `student_answered` (y `student_completed` si aplica) a la room `session:{sessionId}`.

---

## 6. WebSockets — Contratos de Eventos

### Conexión
```
WS: wss://api.airstark.dev/ws
```
El Frontend se suscribe a la room de una sesión enviando:
```json
{ "event": "join_session", "data": { "sessionId": "...", "token": "<JWT AIRSTARK>" } }
```

El Backend autoriza la conexión verificando que el `token` corresponde al profesor dueño de la sesión.

### Evento: `student_connected`
Emitido cuando un estudiante completa el `/connect`.
```json
{
  "event": "student_connected",
  "data": {
    "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "studentName": "Juan Pérez",
    "joinedAt": "2026-08-29T14:32:00.000Z"
  }
}
```

### Evento: `student_answered`
Emitido por cada respuesta individual recibida.
```json
{
  "event": "student_answered",
  "data": {
    "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "questionId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    "progress": 60
  }
}
```
> `progress` = porcentaje de preguntas respondidas (0–100).

### Evento: `student_completed`
Emitido cuando un estudiante responde la última pregunta.
```json
{
  "event": "student_completed",
  "data": {
    "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "studentName": "Juan Pérez",
    "score": 4,
    "totalQuestions": 5,
    "completedAt": "2026-08-29T14:50:00.000Z"
  }
}
```

### Evento: `session_ended`
Emitido cuando la sesión pasa a `completed`, `expired` o `cancelled`.
```json
{
  "event": "session_ended",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed"
  }
}
```

### Reconexión del Profesor
Si el profesor cierra y vuelve a abrir la `EstadisticasView`, el Frontend vuelve a emitir `join_session`. El Backend envía inmediatamente el estado actual de todos los estudiantes conectados.

---

## 7. Seguridad del Código QR

### Fase 1 (Actual)
- El QR contiene **únicamente el `sessionId`** (UUIDv4).
- Un UUIDv4 tiene 122 bits de entropía. No es adivinable en la práctica.
- El Backend valida siempre que la sesión exista, no haya expirado y no esté cancelada.
- **El `sessionId` no es una credencial de acceso completa:** no otorga acceso al dashboard, no permite ver las respuestas correctas y no permite crear o modificar sesiones.

### Validaciones Obligatorias en Cada Request de Unity
El Backend **siempre** debe verificar:
1. ¿Existe la sesión con ese `sessionId`?
2. ¿El `status` permite la operación? (no `expired`, no `cancelled`, no `completed` para nuevas respuestas).
3. ¿El `expires_at` es mayor que `now()`?

### Evolución Futura (Fase 2+)
Si se requiere mayor restricción de acceso:
- **PIN de sesión:** El profesor ve un PIN numérico junto al QR. El estudiante lo ingresa en Unity antes de conectarse.
- **Token temporal en el QR:** El QR contiene `sessionId:token_efimero` con expiración de minutos.
- **Autenticación del estudiante:** Login con correo institucional desde Unity.

---

## 8. `deviceId` — Definición y Uso

### Qué es
El `deviceId` es un identificador local generado por la app de Unity para representar una instalación específica del juego en un dispositivo.

### Cómo lo genera Unity
Se recomienda que Unity lo genere la primera vez que se instala la app y lo persista en `PlayerPrefs`:
```csharp
// Al iniciar la app
if (!PlayerPrefs.HasKey("airstark_device_id")) {
    PlayerPrefs.SetString("airstark_device_id", System.Guid.NewGuid().ToString());
}
string deviceId = PlayerPrefs.GetString("airstark_device_id");
```

### Para qué lo usa el Backend
1. **Detectar reconexiones:** Si el mismo `device_id` intenta conectarse a la misma sesión, el Backend devuelve el `studentId` existente en lugar de crear un duplicado.
2. **Evitar duplicados accidentales:** Un estudiante que cierra y vuelve a abrir la app no genera dos entradas en `Session_Students`.

### Lo que NO hace el `deviceId`
- No es un mecanismo de seguridad principal.
- No reemplaza la autenticación.
- No garantiza unicidad entre dispositivos (dos instalaciones distintas pueden tener el mismo ID en un caso muy improbable; el impacto es mínimo).

---

## 9. Expiración y Finalización de Sesiones

### Cálculo de `expiresAt`
El Backend calcula `expiresAt` al crear la sesión. Se recomienda añadir un margen de gracia:
```
expiresAt = now() + durationMinutes + 30 minutos (margen de gracia)
```
El margen permite que los estudiantes que están en medio de la evaluación puedan terminar aunque se haya alcanzado el tiempo límite nominal.

### Reglas por Escenario

| Escenario | Comportamiento del Backend |
|---|---|
| La sesión expira **antes** de que Unity se conecte | `GET /sessions/{id}` devuelve `410 Gone`. No se puede conectar. |
| La sesión expira **durante** la evaluación | El Backend puede permitir que se envíen respuestas hasta que se alcance el `expiresAt` real. Luego responde `410` a nuevas peticiones. |
| El profesor **cancela** la sesión | El Backend cambia `status = 'cancelled'`. Emite `session_ended`. Unity recibe `409` en el siguiente request. |
| El profesor **finaliza** manualmente | El Backend cambia `status = 'completed'`. Emite `session_ended`. |
| Unity intenta enviar respuestas **después** de la expiración | Backend devuelve `410 Gone`. Unity debe mostrar mensaje de fin de sesión. |
| El Frontend consulta estadísticas de una sesión **finalizada** | El Backend devuelve los datos históricos. No es un error. |

### Job de Expiración Automática
El Backend debe implementar un proceso periódico (cron job cada 1-5 minutos) que busque sesiones con `status = 'waiting'` o `'active'` cuyo `expires_at < now()` y las marque como `expired`.

---

## 10. Huecos Conocidos y Decisiones Pendientes

Estos puntos no están definidos en el Frontend actual y requieren acuerdo entre los equipos:

| # | Hueco | Decisión Requerida |
|---|---|---|
| 1 | ¿Se muestra al estudiante si su respuesta fue correcta o incorrecta en Unity? | Si Unity muestra feedback inmediato, el Backend podría incluirlo en la respuesta del `/answers` pero controlado por una flag de configuración de la sesión. |
| 2 | ¿Pueden múltiples estudiantes conectarse a la misma sesión? | El código lo soporta, pero la UI del Frontend muestra "0 Estudiantes". Confirmar si es 1:1 o 1:N. |
| 3 | Identificación del estudiante en Unity | **Resuelto en este documento:** Unity debe pedir el nombre antes de conectarse. |
| 4 | Token de Google de 1 hora | **Resuelto en este documento:** El Backend debe emitir su propio token de vida más larga. |
| 5 | ¿El profesor puede finalizar la sesión manualmente? | Requiere un endpoint adicional: `POST /api/v1/sessions/{sessionId}/end`. No existe en el Frontend actual. |
| 6 | ¿Las preguntas se presentan en orden o aleatoriamente en Unity? | Definir si el Backend debe indicar el orden o si Unity lo aleatoriza. |

---

## 11. Hoja de Ruta por Fases

### Fase 1 (Implementación Actual — MVP)
- [ ] `POST /api/v1/auth/login` — verificación de JWT de Google + emisión de token propio.
- [ ] `POST /api/v1/sessions` — creación consolidada de evaluación + sesión.
- [ ] `GET /api/v1/sessions/{sessionId}` — para Unity (sin `isCorrect`).
- [ ] `POST /api/v1/sessions/{sessionId}/connect` — registro de estudiante en Unity.
- [ ] `POST /api/v1/sessions/{sessionId}/answers` — respuesta individual en tiempo real.
- [ ] WebSockets con eventos básicos (`student_connected`, `student_answered`, `student_completed`, `session_ended`).
- [ ] Job de expiración automática de sesiones.
- [ ] Configuración CORS para el dominio del Frontend.

### Fase 2 (Mejoras Futuras)
- [ ] `POST /api/v1/evaluations` — crear plantillas reutilizables de evaluaciones.
- [ ] `GET /api/v1/evaluations` — listar plantillas del profesor.
- [ ] `POST /api/v1/sessions` — recibe solo `{ evaluationId }` (sin el cuestionario completo).
- [ ] `POST /api/v1/sessions/{sessionId}/end` — finalización manual por el profesor.
- [ ] Historial de sesiones con resultados (para la sección "Sesiones Recientes" del Dashboard).
- [ ] Autenticación de estudiantes (PIN de sesión o login institucional en Unity).
- [ ] Refresh tokens para el profesor.
