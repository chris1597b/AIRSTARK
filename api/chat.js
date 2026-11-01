import OpenAI from "openai";

// Pool de modelos gratuitos en OpenRouter
const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "huggingfaceh4/zephyr-7b-beta:free",
];

// Estado en memoria (se reinicia por cold start en serverless, pero es aceptable)
let currentModelIndex = 0;

/** Determina si un error es de cuota/tokens agotados */
function isQuotaError(error) {
  const msg = (error.message || "").toLowerCase();
  const code = error.status || error.statusCode || 0;
  return (
    code === 429 ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("exceeded") ||
    msg.includes("billing") ||
    msg.includes("capacity") ||
    msg.includes("overloaded") ||
    msg.includes("too many requests")
  );
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "OPENROUTER_API_KEY no está configurada en las variables de entorno de Vercel",
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
      const modelIdx = (currentModelIndex + attempt) % FREE_MODELS.length;
      const model = FREE_MODELS[modelIdx];

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

        let parsedData;
        try {
          const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
          parsedData = JSON.parse(cleanText);
        } catch {
          parsedData = { text };
        }

        // Avanzar el índice para la próxima petición (round-robin)
        currentModelIndex = (modelIdx + 1) % FREE_MODELS.length;

        return res.status(200).json({
          success: true,
          data: parsedData,
          metadata: { model, attempt: attempt + 1 },
        });

      } catch (error) {
        lastError = error;

        if (isQuotaError(error)) {
          console.warn(`[OpenRouter] Quota agotada en ${model}, rotando...`);
          continue;
        }

        // Error no recuperable
        console.error(`[OpenRouter] Error en ${model}:`, error.message);
        return res.status(500).json({
          success: false,
          error: "Error al procesar la solicitud",
          details: error.message,
          model,
        });
      }
    }

    // Todos los modelos fallaron
    currentModelIndex = 0; // Reset para la próxima invocación
    return res.status(503).json({
      success: false,
      error: "Todos los modelos gratuitos están temporalmente agotados. Intenta de nuevo en unos minutos.",
      details: lastError?.message || "Unknown error",
    });

  } catch (error) {
    console.error("[OpenRouter] Error general:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: error.message,
    });
  }
}
