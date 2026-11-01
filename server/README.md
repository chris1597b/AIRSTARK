# Backend AIRSTARK - OpenRouter con Rotación de Modelos Gratuitos

Este backend maneja de forma segura las llamadas a la IA usando **OpenRouter**, con un pool de modelos gratuitos y rotación automática cuando se agotan los tokens.

## 🚀 Inicio Rápido

### 1. Obtener API Key de OpenRouter (GRATIS)

1. Ve a [openrouter.ai](https://openrouter.ai) → **Sign In** (puedes usar Google)
2. Ve a [openrouter.ai/keys](https://openrouter.ai/keys)
3. Click en **Create Key** → nombra tu key "AIRSTARK"
4. Copia la key (`sk-or-v1-...`)

> **No necesitas agregar créditos.** Los modelos gratuitos funcionan sin billing.

### 2. Configurar Variables de Entorno

```bash
cd server
cp .env.example .env
```

Edita `.env` y agrega tu API key de OpenRouter:

```env
OPENROUTER_API_KEY=sk-or-v1-TU_API_KEY_AQUI
PORT=3001
```

### 3. Instalar Dependencias & Iniciar

```bash
npm install
npm start
```

El backend estará corriendo en `http://localhost:3001`

## 📋 Ejecutar el Proyecto Completo

Opción A — **Dos terminales:**

```bash
# Terminal 1 - Backend
cd server && npm start

# Terminal 2 - Frontend
npm run dev
```

Opción B — **Un solo comando:**

```bash
npm run dev:all
```

## 🤖 Modelos Gratuitos Disponibles

| # | Modelo | Provider |
|---|--------|----------|
| 1 | `google/gemini-2.0-flash-exp:free` | Google |
| 2 | `meta-llama/llama-3.1-8b-instruct:free` | Meta |
| 3 | `mistralai/mistral-7b-instruct:free` | Mistral |
| 4 | `qwen/qwen-2.5-7b-instruct:free` | Alibaba |
| 5 | `huggingfaceh4/zephyr-7b-beta:free` | Hugging Face |

### Rotación Automática

- Cuando un modelo agota su cuota (error 429), el servidor **rota automáticamente** al siguiente.
- Cada 10 minutos los modelos "exhaustos" se rehabilitan.
- Si todos fallan, retorna error 503 con mensaje descriptivo.

## 📡 API Endpoints

### `POST /api/chat`
Procesa consultas usando el pool de modelos de OpenRouter.

**Request:**
```json
{
  "prompt": "Explica la válvula aórtica",
  "systemInstruction": "Eres un experto en cardiología",
  "forceJson": false
}
```

**Response:**
```json
{
  "success": true,
  "data": { "text": "..." },
  "metadata": { "model": "google/gemini-2.0-flash-exp:free", "attempt": 1 }
}
```

### `GET /api/models`
Lista los modelos del pool y su estado actual.

### `GET /health`
Health check con estado de los modelos.

## 🔒 Seguridad

✅ **API key protegida**: Solo existe en el servidor, nunca se expone al navegador
✅ **CORS configurado**: Solo acepta peticiones del frontend local
✅ **.env en .gitignore**: Tu API key nunca se subirá a GitHub

## ⚠️ Importante

- **NO** subas el archivo `.env` a GitHub
- **NO** compartas tu API key en chats o código público
- Para **Vercel**, configura `OPENROUTER_API_KEY` en Settings → Environment Variables
