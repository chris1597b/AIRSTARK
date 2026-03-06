# Documentación de API y Modelos de Datos - AIRSTARK

## 1. API del Servidor Backend

El backend actúa como una pasarela segura (proxy) entre el cliente (Frontend React) y la API de Google Gemini, protegiendo las credenciales de la API.

### `POST /api/chat`

Genera contenido médico contextualizado o viñetas clínicas utilizando Google Gemini.

**URL**: `http://localhost:3001/api/chat`
**Content-Type**: `application/json`

#### Cuerpo de la Petición (Request Body)

| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `prompt` | `string` | ✅ | La instrucción específica para la IA (ej. "Describe la fisiología de la Aorta"). |
| `systemInstruction` | `string` | ❌ | Contexto del rol para la IA (ej. "Eres un experto cardiólogo"). Default: "Eres un asistente médico...". |
| `forceJson` | `boolean` | ❌ | Si es `true`, fuerza a la IA a responder en formato JSON válido. Default: `false`. |

#### Ejemplo de Petición
     
```json
{
  "prompt": "Genera datos clínicos sobre: Ventrículo Izquierdo",
  "systemInstruction": "Responde siempre en JSON.",
  "forceJson": true
}
```

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "data": {
    "physiology": "Bombea sangre oxigenada...",
    "pathology": "Insuficiencia Cardíaca...",
    "symptoms": "Disnea, Ortopnea...",
    "..." : "..."
  }
}
```

*Nota: La estructura dentro de `data` depende de si se solicitó JSON o texto plano.*

#### Respuesta de Error (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Error al procesar la solicitud",
  "details": "Mensaje detallado del error de Gemini..."
}
```

---

## 2. Modelos de Datos (Frontend)

Estructuras de datos TypeScript utilizadas en la aplicación React.

### 2.1. Anatomía (`AnatomicalPart`)

Define los puntos de interés ("hotspots") en el modelo 3D. Estos datos son estáticos y residen en `ANATOMY_DATA`.

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `string` | Identificador único del hotspot (ej. "hotspot-2"). |
| `label` | `string` | Nombre visible de la estructura (ej. "Aorta"). |
| `description` | `string` | Descripción breve estática mostrada antes de cargar datos de IA. |
| `position` | `string` | Coordenadas y orientación para el `<model-viewer>`. |
| `normal` | `string` | Vector normal para la orientación de la etiqueta. |
| `keywords` | `string[]` | Palabras clave para el reconocimiento de voz. |

### 2.2. Datos Médicos IA (`MedicalData`)

Estructura de la respuesta JSON generada por la IA para el "Modo Explorar".

```typescript
interface MedicalData {
  physiology: string;  // Función hemodinámica normal.
  pathology: string;   // 2 patologías frecuentes.
  symptoms: string;    // Presentación clínica típica.
  diagnosis: string;   // Método diagnóstico principal.
  treatment: string;   // Manejo de primera línea.
  pearl: string;       // Dato clave ("High Yield") para exámenes.
}
```

### 2.3. Modos de Aplicación (`AppMode`)

Enumeración que controla el estado global de la interfaz.

```typescript
enum AppMode {
  EXPLORE = 'EXPLORE',       // Modo default: Selección y detalles.
  NAVIGATION = 'NAVIGATION', // Modo visual: Transparencia y EKG.
  QUIZ = 'QUIZ'              // Modo interactivo: Preguntas y respuestas.
}
```

### 2.4. Estado de Gestos (`GestureState`)

Estado derivado del análisis de MediaPipe en tiempo real.

```typescript
interface GestureState {
  isActive: boolean;
  mode: 'IDLE'      // Sin gestos detectados.
      | 'ROTATING'  // Mano abierta: Rotar modelo.
      | 'ZOOMING'   // Índice y pulgar: Zoom.
      | 'LOCKED'    // Puño cerrado: Pausa.
      | 'VOICE';    // Gesto "Shaka": Activa comandos de voz.
  feedback: string; // Texto para la UI.
}
```
