import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// ─── Pools de modelos (verificados el 31/10/2026 con las APIs oficiales) ───
// Gemini: https://ai.google.dev/gemini-api/docs/models
const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",   // estable, el más rápido y económico
  "gemini-3.6-flash",        // estable, equilibrio velocidad/calidad
  "gemini-flash-latest",     // alias que apunta siempre a la última Flash
];

// OpenRouter: GET https://openrouter.ai/api/v1/models (ids terminados en :free)
const FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "thinkingmachines/inkling-small:free",
  "nvidia/nemotron-3.5-lightning:free",
  "recursive/flint-v1.0:free",
];

// Estado en memoria (se reinicia por cold start en serverless, pero es aceptable)
let currentModelIndex = 0;

/** Determina si un error justifica rotar al siguiente modelo del pool */
function isRotatableError(error) {
  const msg = (error.message || "").toLowerCase();
  const code = error.status || error.statusCode || 0;
  return (
    code === 429 ||
    code === 404 ||
    code === 503 || // Sobrecarga transitoria del modelo (Gemini devuelve 503)
    (code === 400 &&
      (msg.includes("not a valid model") ||
        msg.includes("no endpoints") ||
        msg.includes("no allowed providers"))) ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exceeded") ||
    msg.includes("billing") ||
    msg.includes("capacity") ||
    msg.includes("overloaded") ||
    msg.includes("too many requests")
  );
}

/** Intenta obtener la respuesta con los modelos de Gemini. Devuelve null si falla todo el pool. */
async function tryGemini({ prompt, systemInstruction, forceJson }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  for (const model of GEMINI_MODELS) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          // Equivalente de response_format: json_object en la Gemini API
          ...(forceJson ? { responseMimeType: "application/json" } : {}),
        },
      });

      const text = result.text || "";
      if (!text.trim()) throw new Error("Respuesta vacía de Gemini");

      return { text, model };
    } catch (error) {
      const rotatable = isRotatableError(error);
      console.error(
        `[Gemini] Error en ${model} (code=${error.status || "?"}, rotatable=${rotatable}):`,
        error.message
      );
      // Si la key es inválida o hay un error estructural, no tiene sentido seguir en el pool de Gemini
      if (!rotatable) return null;
      continue;
    }
  }
  return null;
}

/** Intenta obtener la respuesta con los modelos gratuitos de OpenRouter. Devuelve null si falla todo el pool. */
async function tryOpenRouter({ prompt, systemInstruction, forceJson }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
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
      if (!text.trim()) throw new Error("Respuesta vacía de OpenRouter");

      // Avanzar el índice para la próxima petición (round-robin)
      currentModelIndex = (modelIdx + 1) % FREE_MODELS.length;

      return { text, model };
    } catch (error) {
      lastError = error;

      if (isRotatableError(error)) {
        console.warn(`[OpenRouter] Modelo ${model} no disponible (code=${error.status || "?"}), rotando...`);
        continue;
      }

      // Error no recuperable: registrar y pasar al siguiente intento/equivalente
      console.error(`[OpenRouter] Error en ${model} (code=${error.status || "?"}):`, error.message);
      return null;
    }
  }

  currentModelIndex = 0; // Reset para la próxima invocación
  if (lastError) console.error("[OpenRouter] Todos los modelos del pool fallaron:", lastError.message);
  return null;
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

  try {
    const { prompt, systemInstruction, forceJson = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: "El prompt es requerido" });
    }

    // 1) Gemini primero (key ya existente en Vercel)
    let result = await tryGemini({ prompt, systemInstruction, forceJson });

    // 2) OpenRouter como respaldo
    if (!result) {
      result = await tryOpenRouter({ prompt, systemInstruction, forceJson });
    }

    if (!result) {
      return res.status(503).json({
        success: false,
        error:
          "Ningún proveedor está disponible ahora mismo. Verifica GEMINI_API_KEY y OPENROUTER_API_KEY en Vercel, o inténtalo de nuevo en unos minutos.",
      });
    }

    let parsedData;
    try {
      const cleanText = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(cleanText);
    } catch {
      parsedData = { text: result.text };
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
      metadata: { model: result.model },
    });

  } catch (error) {
    console.error("[chat] Error general:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: error.message,
    });
  }
}
