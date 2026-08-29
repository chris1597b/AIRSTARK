# AIRSTARK — Contrato de API (Fase 1)

Documento de referencia técnica para la integración entre **Frontend**, **Backend** y **Unity/AR**.  
Cada cambio de contrato debe actualizarse aquí antes de modificar cualquier archivo de código.

```
Google Login
    ↓
Usuario autenticado
    ↓
Frontend AIRSTARK
    ↓ construye CreateSessionRequest
POST /api/v1/sessions
    ↓
Backend: valida + guarda evaluación + genera SessionId
    ↓ responde CreateSessionResponse
Frontend recibe SessionId
    ↓
Genera QR con SessionId (solo SessionId)
    ↓
Unity / AR escanea QR → obtiene SessionId
    ↓
GET /api/v1/sessions/{SessionId}
    ↓
Backend devuelve datos de la sesión (sin isCorrect)
    ↓
Unity ejecuta evaluación AR
    ↓
POST /api/v1/sessions/{SessionId}/connect  (registro del estudiante)
POST /api/v1/sessions/{SessionId}/answers  (respuesta individual)
```

---

## Reglas Arquitectónicas

| Actor | Responsabilidad |
|---|---|
| **Frontend** | Autenticar al profesor. Configurar la evaluación. Enviar `CreateSessionRequest` al Backend. Mostrar el QR con `sessionId`. Mostrar estadísticas. |
| **Backend** | Fuente de verdad. Validar, persistir y generar `sessionId`. Evaluar respuestas. Proteger `isCorrect`. Emitir eventos WebSocket. |
| **Unity** | Escanear QR. Obtener datos de sesión del Backend. Solicitar nombre del estudiante. Enviar respuestas. Nunca determinar si una respuesta es correcta. |

---

## Autenticación

- **Mecanismo actual (Fase 1):** El Frontend envía el JWT de Google en el header `Authorization: Bearer <token>`.
- **Mecanismo futuro:** El Backend emitirá su propio token de sesión con mayor vida útil (ver `BACKEND_SPECIFICATION.md §4`).
- **Regla:** El Frontend **NUNCA** envía `userId` ni `teacherName` en el body. El Backend los extrae del JWT.
- **Regla:** Las variables `VITE_*` son públicas en el navegador. No colocar secretos del Backend en el Frontend.

---

## Endpoint 1: Crear Sesión

### [IMPLEMENTADO (Frontend) / PENDIENTE (Backend)] `POST /api/v1/sessions`

**Propósito:** Crear una evaluación y su sesión asociada en una sola operación (Fase 1).  
**Autenticación:** `Authorization: Bearer <JWT de Google>`  
**Quién llama:** Frontend (`services/evaluationApi.ts`)  
**Quién genera el `sessionId`:** El Backend exclusivamente.

#### Request JSON

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

**Notas del contrato:**
- `isCorrect` se envía al Backend para que lo almacene internamente. **Nunca se devuelve a Unity.**
- El mapper `services/evaluationMapper.ts` transforma `EvaluationDraft` → este JSON. Ningún componente lo construye manualmente.
- Todos los campos son obligatorios. Cada pregunta debe tener exactamente 1 opción con `isCorrect: true`.

#### Response JSON — `201 Created`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "expiresAt": "2026-08-29T17:00:00.000Z"
}
```

#### Errores esperados

| Código HTTP | Significado | `ApiErrorCode` en Frontend |
|---|---|---|
| `400` | Datos inválidos o incompletos | `VALIDATION_ERROR` |
| `401` | Token ausente o inválido | `UNAUTHORIZED` |
| `422` | Error de validación semántica | `VALIDATION_ERROR` |
| `500` | Error interno del Backend | `SERVER_ERROR` |
| (red) | Sin conexión | `NETWORK_ERROR` |

---

## Endpoint 2: Obtener Sesión (para Unity)

### [PENDIENTE] `GET /api/v1/sessions/{sessionId}`

**Propósito:** Obtener el estado y contenido de la sesión para que Unity cargue la evaluación.  
**Autenticación:** Ninguna en Fase 1 (el UUIDv4 es suficientemente opaco).  
**Quién llama:** Unity / AR.

#### Response JSON — `200 OK`

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
          { "id": "a1b2c3d4-0000-0000-0000-000000000001", "text": "2" },
          { "id": "a1b2c3d4-0000-0000-0000-000000000002", "text": "4" },
          { "id": "a1b2c3d4-0000-0000-0000-000000000003", "text": "6" },
          { "id": "a1b2c3d4-0000-0000-0000-000000000004", "text": "3" }
        ]
      }
    ]
  }
}
```

> ⚠️ **CRÍTICO:** El campo `isCorrect` **NUNCA** debe incluirse en esta respuesta. Unity solo recibe `id` y `text` de cada opción.

#### Errores esperados

| Código HTTP | Significado |
|---|---|
| `404` | La sesión no existe |
| `410` | La sesión expiró |
| `409` | La sesión fue cancelada |

---

## Endpoint 3: Conectar Estudiante (Unity)

### [PENDIENTE] `POST /api/v1/sessions/{sessionId}/connect`

**Propósito:** Registrar al estudiante en la sesión. Unity conserva el `studentId` resultante.  
**Autenticación:** Ninguna en Fase 1.  
**Quién llama:** Unity / AR.

#### Request JSON

```json
{
  "studentName": "Juan Pérez",
  "deviceId": "UNITY-DEVICE-XYZ-12345"
}
```

- `deviceId` es generado por Unity al instalarse y persistido en `PlayerPrefs`. Se usa para detectar reconexiones y evitar duplicados, no como mecanismo de seguridad.

#### Response JSON — `201 Created`

```json
{
  "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "connected",
  "joinedAt": "2026-08-29T14:32:00.000Z"
}
```

#### Errores esperados

| Código HTTP | Significado |
|---|---|
| `404` | La sesión no existe |
| `410` | La sesión expiró |
| `409` | La sesión está completada o cancelada |
| `400` | `studentName` vacío |

---

## Endpoint 4: Enviar Respuesta (Unity)

### [PENDIENTE] `POST /api/v1/sessions/{sessionId}/answers`

**Propósito:** Registrar una respuesta individual del estudiante. Se envía una por una para estadísticas en tiempo real.  
**Autenticación:** Ninguna en Fase 1 (el `studentId` sirve de identificación).  
**Quién llama:** Unity / AR.

#### Request JSON

```json
{
  "studentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "questionId": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "optionId": "a1b2c3d4-0000-0000-0000-000000000002"
}
```

#### Response JSON — `200 OK`

```json
{
  "accepted": true,
  "progress": {
    "answered": 1,
    "total": 5
  }
}
```

> **Nota:** La respuesta NO indica si la opción fue correcta. Unity no recibe feedback de corrección; solo confirma que la respuesta fue aceptada.

#### Errores esperados

| Código HTTP | Significado |
|---|---|
| `404` | Sesión, estudiante, pregunta u opción no encontrada |
| `410` | La sesión expiró |
| `403` | El `studentId` no pertenece a esta sesión |
| `409` | Esta pregunta ya fue respondida |

---

## El Código QR

- **Contiene exclusivamente:** el `sessionId` (UUIDv4).
- **No contiene:** datos de la evaluación, tokens, credenciales, ni datos del profesor.
- **Arquitectura:** `QR → sessionId → Backend → GET /sessions/{sessionId} → datos de la sesión`
- **El `sessionId` no es una credencial:** conocerlo no otorga acceso al dashboard del profesor.
- **Quién genera el `sessionId`:** el Backend exclusivamente (en producción). En modo mock, se genera localmente solo para UI.

---

## Estados de la Sesión

| Estado | Descripción |
|---|---|
| `waiting` | Creada. Esperando conexión de Unity. |
| `active` | Al menos un estudiante conectado. Evaluación en curso. |
| `completed` | Finalizada con éxito. |
| `expired` | `expiresAt` alcanzado sin completarse. |
| `cancelled` | Cancelada manualmente por el profesor. |

```
waiting → active     (primer estudiante conectado)
waiting → expired    (tiempo agotado)
waiting → cancelled  (profesor cancela)
active  → completed  (todos completan o el profesor finaliza)
active  → expired    (tiempo agotado)
active  → cancelled  (profesor cancela)
```

---

## Mock API (Solo para Desarrollo de UI)

| Variable de entorno | Efecto |
|---|---|
| `VITE_USE_MOCK_API=true` | Simula la respuesta del Backend. El `sessionId` generado **no es una sesión real**. Unity no puede recuperar datos con estos IDs. Usar solo para validar el flujo de interfaz. |
| `VITE_USE_MOCK_API=false` | Llama al Backend real en `VITE_API_BASE_URL`. Si falla, muestra el error real. |

**El mock NO se activa automáticamente** si falta `VITE_API_BASE_URL`. Debe configurarse explícitamente.

---

## Tipos TypeScript del Contrato

Los tipos viven en `types/evaluation.ts`. El mapper en `services/evaluationMapper.ts` es el único punto de transformación entre el estado interno del Frontend y el JSON de la API. Los componentes React nunca construyen el JSON de la API directamente.

```
EvaluationDraft (UI interna)
    ↓ evaluationMapper.ts
CreateSessionRequest (API → Backend)
    ↓
CreateSessionResponse (Backend → Frontend)
    ↓ sessionId
QRCodeSVG value={sessionId}
```

---

## Pendientes para cuando el Backend esté disponible

- [ ] Configurar `VITE_API_BASE_URL` con la URL real del Backend una vez esté desplegado.
- [ ] Establecer `VITE_USE_MOCK_API=false`.
- [ ] (Backend) Aceptar el JWT de Google en `POST /api/v1/auth/login` y emitir el token AIRSTARK.
- [ ] Confirmar el formato exacto de los `id` de opciones que el Backend asignará (UUIDs vs strings cortos).
- [ ] (Backend) Implementar WebSocket `WS /ws` para la vista de Estadísticas en vivo (Frontend ya lo implementa).
- [ ] (Fase 2) Separar `POST /api/v1/evaluations` de `POST /api/v1/sessions`.
