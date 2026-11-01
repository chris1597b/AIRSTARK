import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

// Cargar variables de entorno
dotenv.config();

const app = express();
const parsedPort = parseInt(process.env.PORT, 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3001;

// ──────────────────────────────────────────────────────────────────────────────
// OpenRouter: pool de modelos gratuitos con rotación automática
// ──────────────────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Pool de modelos gratuitos en OpenRouter — verificados en vivo (oct 2026)
// Probe real: solo estos responden sin 429/403/503
const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",   // Mejor calidad, 550B params
  "nvidia/nemotron-3.5-lightning:free",         // Rápido y confiable
  "nvidia/nemotron-3.5-super-vl:free",          // Vision + lenguaje
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // Bueno para razonamiento
  "dots-studio/dots-3-note-preview:free",       // Bueno para texto estructurado
  "cohere/north-mini-code:free",                // Buen seguimiento de instrucciones
  "liquid/lfm-2.5-2.6b:free",                  // Ligero, fallback rápido
];

// Estado global de rotación
let currentModelIndex = 0;
// Set de modelos "muertos" temporalmente (quota agotada)
const exhaustedModels = new Set();
// Limpieza automática de modelos exhaustos cada 10 minutos
setInterval(() => {
  if (exhaustedModels.size > 0) {
    console.log(`♻️  Limpiando ${exhaustedModels.size} modelos exhaustos, re-intentando en próxima petición.`);
    exhaustedModels.clear();
  }
}, 10 * 60 * 1000);

/** Obtiene el siguiente modelo disponible (no exhausto) */
function getNextModel() {
  const total = FREE_MODELS.length;
  for (let i = 0; i < total; i++) {
    const idx = (currentModelIndex + i) % total;
    const model = FREE_MODELS[idx];
    if (!exhaustedModels.has(model)) {
      currentModelIndex = (idx + 1) % total;
      return model;
    }
  }
  // Si todos están exhaustos, limpiamos y empezamos de nuevo
  exhaustedModels.clear();
  const model = FREE_MODELS[currentModelIndex % total];
  currentModelIndex = (currentModelIndex + 1) % total;
  return model;
}

/** Determina si un error debe rotar al siguiente modelo */
function isQuotaError(error) {
  const msg = (error.message || "").toLowerCase();
  const code = error.status || error.statusCode || 0;
  return (
    code === 429 ||
    code === 503 ||
    code === 404 ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("exceeded") ||
    msg.includes("billing") ||
    msg.includes("capacity") ||
    msg.includes("overloaded") ||
    msg.includes("too many requests") ||
    msg.includes("provider returned error") ||
    msg.includes("unavailable") ||
    msg.includes("not available")
  );
}

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Backend AIRSTARK funcionando",
    provider: "OpenRouter",
    modelsAvailable: FREE_MODELS.length,
    modelsExhausted: exhaustedModels.size,
    currentModel: FREE_MODELS[currentModelIndex % FREE_MODELS.length],
  });
});

// GET /api/models — lista de modelos y estado
app.get("/api/models", (_req, res) => {
  res.json({
    models: FREE_MODELS.map((m) => ({
      id: m,
      exhausted: exhaustedModels.has(m),
    })),
    currentIndex: currentModelIndex,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/chat — endpoint principal con rotación automática
// ──────────────────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "OPENROUTER_API_KEY no está configurada en server/.env",
    });
  }

  try {
    const { prompt, systemInstruction, forceJson = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: "El prompt es requerido" });
    }

    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY,
    });

    let lastError = null;
    const maxAttempts = FREE_MODELS.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const model = getNextModel();
      console.log(`🤖 Intento ${attempt + 1}/${maxAttempts} → modelo: ${model}`);

      try {
        const messages = [];
        if (systemInstruction) {
          messages.push({ role: "system", content: systemInstruction });
        }
        messages.push({ role: "user", content: prompt });

        const result = await openai.chat.completions.create({
          model,
          messages,
          ...(forceJson ? { response_format: { type: "json_object" } } : {}),
        });

        const text = result.choices?.[0]?.message?.content || "";

        // Intentar parsear JSON si viene formateado
        let parsedData;
        try {
          const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
          parsedData = JSON.parse(cleanText);
        } catch {
          parsedData = { text };
        }

        console.log(`✅ Respuesta exitosa de ${model}`);
        return res.json({
          success: true,
          data: parsedData,
          metadata: { model, attempt: attempt + 1 },
        });

      } catch (error) {
        lastError = error;
        console.warn(`⚠️  Modelo ${model} falló: ${error.message}`);

        if (isQuotaError(error)) {
          console.warn(`🔄 Quota agotada en ${model}, rotando al siguiente modelo...`);
          exhaustedModels.add(model);
          continue; // Intentar con el siguiente modelo
        }

        // Error no relacionado con quota → no rotar, reportar de inmediato
        console.error("❌ Error no recuperable:", error.message);
        return res.status(500).json({
          success: false,
          error: "Error al procesar la solicitud",
          details: error.message,
          model,
        });
      }
    }

    // Si llegamos aquí, todos los modelos fallaron
    console.error("❌ Todos los modelos del pool están exhaustos.");
    return res.status(503).json({
      success: false,
      error: "Todos los modelos gratuitos están temporalmente agotados. Intenta de nuevo en unos minutos.",
      details: lastError?.message || "Unknown error",
    });

  } catch (error) {
    console.error("❌ Error general del servidor:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Backend AIRSTARK corriendo en http://localhost:${PORT}`);
  console.log(`🔑 OpenRouter API Key: ${OPENROUTER_API_KEY ? "✅ Configurada" : "❌ NO CONFIGURADA"}`);
  console.log(`🤖 Pool de ${FREE_MODELS.length} modelos gratuitos:`);
  FREE_MODELS.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
  console.log("");
});
