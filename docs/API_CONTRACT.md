# AIRSTARK — Contrato API y Arquitectura (Fase 1)

Este documento define las reglas arquitectónicas, los endpoints y los contratos JSON para la integración entre el Frontend (React), el Backend y la aplicación AR (Unity).

## 1. Regla Arquitectónica Principal

La implementación mantiene siempre esta separación:
- **GOOGLE LOGIN** = ¿Quién es el usuario? (Autenticación e identidad del docente).
- **EVALUATION** = ¿Qué evaluación se ejecutará? (Contenido/configuración de la sesión).
- **SESSION** = ¿Qué ejecución concreta está activa? (Instancia de la evaluación).
- **QR** = ¿Cómo vinculamos el dispositivo AR con esa sesión? (Contiene únicamente el `sessionId`).
- **BACKEND** = ¿Quién tiene autoridad para validar todo lo anterior? (Fuente de la verdad y validador de seguridad).

---

## 2. Autenticación y JWT

- **Fuente de Identidad:** Google Identity Services.
- **Flujo Frontend:** El Frontend recibe el `credential` (JWT) de Google y lo conserva temporalmente para autenticarse contra el Backend (enviado en el header `Authorization: Bearer <token>`).
- **Validación Backend:** El Backend es responsable de validar criptográficamente el token y determinar la identidad del usuario (ej: extraer `userId`, `teacherName`).
- **Seguridad:** El Frontend NUNCA utiliza el token como fuente de verdad para `userId`, `teacherName` o permisos al comunicarse con el Backend. No envía datos sensibles de identidad en el cuerpo (body) de las peticiones.
- **Producción:** Se debe evaluar una sesión segura (ej. cookies HttpOnly) u otro mecanismo definitivo definido por la arquitectura del Backend. `sessionStorage` es solo para la retención del JWT en desarrollo/fase inicial.

---

## 3. Separación entre Evaluación y Sesión

Están estrictamente separados:
- `Evaluation`: Contenido estático / configuración de la evaluación.
- `Session`: Ejecución temporal y viva de una evaluación.

### Arquitectura Ideal (Referencia):
```text
POST /api/v1/evaluations  -> Devuelve evaluationId
POST /api/v1/sessions     -> Devuelve sessionId (recibe evaluationId)
```

**Nota para Fase 1:** Temporalmente, el endpoint `POST /api/v1/sessions` del Frontend está enviando toda la configuración de la evaluación (consolidado) para crear ambos recursos a la vez, pero la arquitectura debe quedar preparada para separarlos.

---

## 4. Contratos JSON (Tipos TypeScript)

Las interfaces TypeScript en el Frontend utilizan **PascalCase** para los nombres, pero las **propiedades JSON utilizan camelCase** a menos que el Backend indique explícitamente lo contrario.

### `CreateSessionRequest`
```json
{
  "evaluation": {
    "title": "Corazón",
    "description": "Examen final",
    "durationMinutes": 5,
    "activationDate": "2023-12-01T00:00:00.000Z",
    "modelAssetId": "heart",
    "questions": [
      {
        "prompt": "¿Cuántas cavidades tiene?",
        "options": [
          { "id": "1", "text": "4", "isCorrect": true },
          { "id": "2", "text": "2", "isCorrect": false }
        ]
      }
    ]
  }
}
```

### `CreateSessionResponse`
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "expiresAt": "2023-12-01T02:00:00.000Z"
}
```

---

## 5. El Código QR y su Seguridad

- **Fase 1:** El QR contiene **únicamente el `sessionId`** (UUID generado exclusivamente por el Backend en modo real).
- **Fase 2:** El formato definitivo (ej: UUID simple, JSON, o Deep Link `airstark://session/<sessionId>`) se definirá con Unity.
- **El `sessionId` NO es una credencial:** Es un identificador público. Conocerlo no otorga acceso ilimitado.
- El QR **NUNCA** contiene contraseñas, tokens privados, o información sensible.

---

## 6. Conexión Unity / AR

El flujo recomendado para conectar la app AR es en dos pasos:

1. **Consulta/Validación:**
   ```text
   GET /api/v1/sessions/{sessionId}
   ```
   Unity consulta si la sesión existe, no expiró y está disponible.

2. **Conexión Activa:**
   ```text
   POST /api/v1/sessions/{sessionId}/connect
   ```
   Registra el dispositivo AR y cambia el estado de `waiting` a `connected`.

---

## 7. Máquina de Estados de la Sesión

El Backend es la autoridad final sobre el estado. Los estados propuestos son:

- `created`: Sesión recién creada, inactiva.
- `waiting`: Esperando conexión de dispositivos AR.
- `connected`: Dispositivo AR conectado (inicio inminente).
- `active`: Evaluación en curso.
- `completed`: Evaluación finalizada con éxito.
- `expired`: Tiempo de vida agotado (no se conectó o se pasó del límite).
- `cancelled`: Sesión abortada manualmente.

**Transiciones Ejemplo:**
- `created` → `waiting`
- `waiting` → `connected`
- `connected` → `active`
- `active` → `completed`
- `waiting` → `expired`

---

## 8. Expiración de Sesión

- `expiresAt` es generado y controlado estrictamente por el Backend.
- El Frontend solo oculta visualmente el QR cuando el reloj local supera el tiempo.
- Una sesión expirada no se puede utilizar aunque se manipule el Frontend.
- El usuario puede generar una nueva sesión solicitando al Backend un nuevo `sessionId`.

---

## 9. Mock API (Desarrollo)

Para desarrollo sin Backend, se utiliza la variable:
`VITE_USE_MOCK_API=true`

- Si es `true`, simula la respuesta del Backend (delay simulado y UUID generado localmente).
- Si es `false`, utilizará la API real (`VITE_API_BASE_URL`). Si falla, muestra un error real.
- **NO se activa automáticamente** si falta la URL del backend; debe ser explícito.
- Los UUID del Mock son únicamente para validación de interfaz, nunca se envían a un Backend real.
