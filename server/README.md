# Backend AIRSTARK - Configuración

Este backend maneja de forma segura las llamadas a la API de Gemini, protegiendo tu API key.

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

Crea un archivo `.env` en la carpeta `server/`:

```bash
cd server
cp .env.example .env
```

Edita el archivo `.env` y agrega tu API key de Gemini:

```env
GEMINI_API_KEY=tu_api_key_real_aqui
PORT=3001
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Iniciar el Servidor

```bash
npm start
```

El backend estará corriendo en `http://localhost:3001`

## 📋 Ejecutar el Proyecto Completo

Necesitas **DOS terminales**:

### Terminal 1 - Backend
```bash
cd server
npm install
npm start
```

### Terminal 2 - Frontend
```bash
npm run dev
```

## 🔒 Seguridad

✅ **La API key está protegida**: Solo existe en el servidor, nunca se expone al navegador
✅ **CORS configurado**: Solo acepta peticiones del frontend local
✅ **.env en .gitignore**: Tu API key nunca se subirá a GitHub

## 📡 API Endpoints

### `POST /api/chat`
Procesa consultas médicas usando Gemini AI.

**Request:**
```json
{
  "prompt": "Explica la válvula aórtica",
  "systemInstruction": "Eres un experto en cardiología"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "..."
  }
}
```

### `GET /health`
Verifica que el servidor está funcionando.

**Response:**
```json
{
  "status": "ok",
  "message": "Backend AIRSTARK funcionando"
}
```

## 🛠️ Desarrollo

Para desarrollo con auto-reload:
```bash
npm run dev
```

## ⚠️ Importante

- **NO** subas el archivo `.env` a GitHub
- **NO** compartas tu API key en chats o código público
- El archivo `.env.example` es solo una plantilla (sin la key real)
