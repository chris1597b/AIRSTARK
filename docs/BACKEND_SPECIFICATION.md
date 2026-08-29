# AIRSTARK — Especificación Técnica del Backend

Este documento sirve como guía completa y especificación técnica para el desarrollo del Backend del sistema AIRSTARK. Detalla el funcionamiento actual del Frontend, el flujo de datos, y propone la arquitectura, el modelo de base de datos, el diseño de APIs y la seguridad necesarios para integrar el Frontend web con la aplicación de Realidad Aumentada (AR) en Unity.

---

## 1. Análisis del Frontend Actual y Flujo de Información

El Frontend actual (React/Vite) funciona como un panel de control para los docentes. A continuación, se explica el propósito de los archivos clave y el ciclo de vida de la información:

### Archivos Clave del Frontend
- **`App.tsx`**: Es el orquestador principal. Gestiona los modos de la aplicación (`EXPLORE`, `NAVIGATION`, `QUIZ`, `EVALUATION`, `DRAW`), el visor 3D (`model-viewer`), y el estado de autenticación.
- **`services/googleAuth.ts`**: Maneja el inicio de sesión con *Google Identity Services (GIS)*. Obtiene un JWT (credential) de Google, lo decodifica para mostrar el perfil del profesor y lo almacena en `sessionStorage` (`airstark_token`).
- **`components/Evaluation.tsx`**: Contiene todo el dashboard del profesor (PanelView, InformacionView, ModeloView, CuestionarioView, CodigoQRView, EstadisticasView). Aquí se configura la evaluación.
- **`types/evaluation.ts`**: Define los contratos y tipos (ej. `EvaluationDraft`, `CreateSessionRequest`, `CreateSessionResponse`).
- **`services/evaluationApi.ts`**: Servicio que envía la petición `POST /api/v1/sessions` al backend, inyectando el token de Google en el header `Authorization`.
- **`docs/API_CONTRACT.md`**: Establece las reglas iniciales de integración (separación entre Login, Evaluation, Session y QR).

### Flujo de la Información (De Inicio a Fin)
1. **Login (Web):** El profesor inicia sesión con Google. El frontend recibe un JWT de Google y lo guarda.
2. **Configuración de Evaluación (Web):** El profesor entra al modo "Evaluación" y define:
   - *Información:* Título, descripción, fecha de activación, duración, estado.
   - *Modelo:* Selecciona un modelo anatómico (ej. Heart, Brain).
   - *Cuestionario:* Crea preguntas de opción múltiple, marcando la opción correcta.
3. **Creación de la Sesión (Web → Backend):** Al pulsar "Generar código QR", el frontend envía toda la configuración (consolidada) al backend mediante `POST /api/v1/sessions`. El backend responde con un `sessionId` (UUIDv4), `status: 'waiting'` y `expiresAt`.
4. **Vinculación (Web):** El frontend genera un Código QR que contiene **exclusivamente el `sessionId`**.
5. **Escaneo y Validación (Unity → Backend):** El estudiante escanea el QR con la app de Unity. Unity extrae el `sessionId` y hace un `GET /api/v1/sessions/{sessionId}` para verificar que la sesión existe y no ha expirado.
6. **Conexión (Unity → Backend):** Unity llama a `POST /api/v1/sessions/{sessionId}/connect` para unirse a la sesión. El backend cambia el estado de la sesión (ej. de `waiting` a `connected` o `active`).
7. **Desarrollo (Unity ↔ Backend ↔ Web):** Unity envía las respuestas y el progreso del estudiante al Backend. El Frontend web (en la vista de Estadísticas) consumirá estos datos (idealmente vía WebSockets) para mostrar resultados en vivo.
8. **Fin de la Sesión:** El tiempo expira (`expiresAt`) o el profesor la termina, cerrando la sesión (`completed` o `expired`).

---

## 2. Propuesta de Arquitectura del Backend

### Stack Tecnológico Recomendado
- **Lenguaje/Framework:** Node.js con NestJS o Express (TypeScript). Compartir tipos (`types/evaluation.ts`) con el frontend acelerará el desarrollo. Alternativamente: Python con FastAPI.
- **Base de Datos:** PostgreSQL. La naturaleza de los datos (Profesores -> Evaluaciones -> Sesiones -> Estudiantes -> Respuestas) es fuertemente relacional.
- **Tiempo Real:** Socket.io o WebSockets nativos para la vista de estadísticas en vivo del profesor.

### Modelo de Base de Datos (Entidad-Relación)

1. **`Users` (Docentes)**
   - `id` (UUID, PK)
   - `google_id` (String, Unique)
   - `email` (String, Unique)
   - `name` (String)
   - `picture` (String)

2. **`Evaluations`**
   - `id` (UUID, PK)
   - `teacher_id` (UUID, FK -> Users)
   - `title` (String)
   - `description` (Text)
   - `duration_minutes` (Int)
   - `model_asset_id` (String)

3. **`Questions`**
   - `id` (UUID, PK)
   - `evaluation_id` (UUID, FK -> Evaluations)
   - `prompt` (Text)

4. **`Options`**
   - `id` (UUID, PK)
   - `question_id` (UUID, FK -> Questions)
   - `text` (String)
   - `is_correct` (Boolean)

5. **`Sessions`**
   - `id` (UUID, PK)
   - `evaluation_id` (UUID, FK -> Evaluations)
   - `status` (Enum: `created`, `waiting`, `connected`, `active`, `completed`, `expired`, `cancelled`)
   - `expires_at` (Timestamp)
   - `created_at` (Timestamp)

6. **`Session_Students` (Para la vista de Estadísticas)**
   - `id` (UUID, PK)
   - `session_id` (UUID, FK -> Sessions)
   - `student_identifier` (String) *// Ver sección de huecos/mejoras*
   - `score` (Int)
   - `status` (String)
   - `joined_at` (Timestamp)

---

## 3. Diseño de APIs (Contrato Backend)

### Autenticación y Usuarios
- `POST /api/v1/auth/login`
  - **Uso:** El frontend podría enviar el JWT de Google aquí para que el Backend expida su propio token JWT interno o Cookie de sesión (Mejor práctica).
  - *(Nota: Si se usa directamente el token de Google como se hace actualmente, el backend deberá verificarlo usando `google-auth-library` en cada petición).*

### Evaluaciones y Sesiones (Fase 1 - Consolidado)
Como indica el `API_CONTRACT.md`, actualmente el frontend envía la evaluación y la sesión juntas.
- **`POST /api/v1/sessions`** (Requiere Auth: Bearer Token)
  - **Body:** `CreateSessionRequest` (contiene `evaluation: { title, ..., questions: [...] }`).
  - **Acción Backend:** Verifica el token de Google, crea el `User` en base de datos si no existe, crea la `Evaluation`, crea las `Questions` y `Options`, y finalmente crea la `Session`.
  - **Respuesta:** `{ sessionId, status: 'waiting', expiresAt }`

### Endpoints para Unity
- **`GET /api/v1/sessions/:sessionId`** (Público o validado por API Key de la app)
  - **Respuesta:** Detalles de la sesión y la evaluación (**OJO: preguntas sin el campo `isCorrect`**) para que Unity cargue la UI.
- **`POST /api/v1/sessions/:sessionId/connect`**
  - **Body:** `{ studentName: "Juan Perez", deviceId: "XYZ..." }`
  - **Acción Backend:** Registra al estudiante en la sesión (`Session_Students`).
- **`POST /api/v1/sessions/:sessionId/answers`**
  - **Body:** `{ studentId: "...", answers: [{ questionId: "...", optionId: "..." }] }`
  - **Acción Backend:** Calcula el puntaje comparando con las opciones correctas y actualiza `Session_Students`. Emite evento WebSocket al Dashboard.

### WebSockets (Dashboard)
- `WS /ws/sessions/:sessionId`
  - El frontend web se suscribe a esta sala para recibir eventos: `student_connected`, `student_answered`, `session_ended`.

---

## 4. Seguridad y Autenticación

- **Backend como Fuente de Verdad:** El backend **NUNCA** debe confiar en que el frontend le envíe el `userId` en el body. El backend debe usar `google-auth-library` para verificar el JWT del header `Authorization`, extraer el `sub` (Google ID) y el `email`, y con eso operar.
- **Seguridad del Código QR:** El QR expone el `sessionId`. Al ser un UUIDv4, es imposible de adivinar. Cualquiera con el QR puede unirse. Si se requiere restringir quién se une, Unity deberá pedir un PIN adicional (que se muestre junto al QR) o autenticación de alumnos.
- **Anti-Trampas (Cheat Prevention):** El endpoint `GET /api/v1/sessions/:sessionId` que consume Unity **NO debe devolver el campo `isCorrect`** de las opciones. Unity solo debe renderizar las opciones, enviar la respuesta del alumno al Backend, y el Backend debe evaluar si es correcta.

---

## 5. Problemas Identificados y Mejoras (Huecos en el Frontend)

Al revisar el código del Frontend, se identifican las siguientes lagunas que el desarrollador Backend y el equipo de Unity deben resolver en conjunto:

1. **Identidad del Estudiante en Unity:**
   - **El Problema:** El QR solo tiene el `sessionId`. Cuando Unity hace `POST /connect`, ¿cómo sabe el sistema qué estudiante es?
   - **Solución:** La app de Unity debe solicitar al estudiante que escriba su nombre (o matrícula) antes de iniciar, y enviarlo en el body del `/connect`. La tabla `EstadisticasView` espera columnas como "Estudiante", por lo que esta identidad es obligatoria.

2. **Expiración del Token de Google (1 hora):**
   - **El Problema:** El frontend usa `sessionStorage.setItem('airstark_token', response.credential)`. El JWT de Google expira en 1 hora. Si el profesor deja la pestaña abierta y crea una sesión horas después, fallarán las peticiones a la API por token expirado.
   - **Solución (Backend):** El Frontend debe enviar el JWT de Google al Backend *una vez* (`/auth/login`), y el Backend debe devolver una Cookie `HttpOnly` o su propio JWT con un tiempo de expiración manejable (ej. 12 horas).

3. **Separación de Evaluación y Sesión (Fase 2):**
   - **El Problema:** Actualmente cada vez que se genera un QR, se está mandando todo el cuestionario y creando una nueva Evaluación en base de datos. Se llenará la BD de datos duplicados si se usa el mismo examen varias veces.
   - **Solución:** Implementar `POST /api/v1/evaluations` para guardar plantillas, y `POST /api/v1/sessions` enviando solo `{ evaluationId: "..." }`. El frontend deberá actualizarse para soportar este flujo.

4. **Flujo de Respuestas desde Unity:**
   - **El Problema:** No está documentado cómo y cuándo Unity envía las respuestas. ¿Las envía una a una o todas al final?
   - **Solución:** Se recomienda enviar respuestas en tiempo real (`POST /answers` individual) para que la tabla de *Estadísticas* del profesor se actualice dinámicamente y vea el progreso en vivo.

5. **CORS:**
   - El Backend deberá tener configurado CORS (`Access-Control-Allow-Origin`) para permitir peticiones desde el dominio donde se hospede el frontend web.
