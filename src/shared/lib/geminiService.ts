
// Backend API URL (Usa la variable de entorno de Vercel o de lo contrario asume fallback)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// Fallback Key from Vite environment (necesario en Vercel si no hay backend)
const FALLBACK_API_KEY = import.meta.env.VITE_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);

// Defines the structure of the medical data we expect
export interface MedicalData {
  physiology: string;
  pathology: string;
  symptoms: string;     // Clinical presentation
  diagnosis: string;    // Diagnostic modality
  treatment: string;    // Management
  pearl: string;        // High yield fact
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error("La solicitud tardó demasiado, por favor intenta de nuevo.");
    }
    throw error;
  }
};

// Función auxiliar para llamar directamente en caso de que el backend falle (Vercel)
const callGeminiDirectly = async (prompt: string, systemInstruction: string, forceJson: boolean): Promise<string> => {
  if (!FALLBACK_API_KEY) throw new Error("No hay API Key de respaldo configurada (VITE_API_KEY en Vercel).");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${FALLBACK_API_KEY}`;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: forceJson ? "application/json" : "text/plain"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error("Respuesta de Gemini malformada o vacía.");
};

export const getClinicalContext = async (partName: string): Promise<string> => {
  const prompt = `
    Actúa como un profesor experto en cardiología preparando a un estudiante para el examen MIR o USMLE.
    El estudiante está revisando la estructura: "${partName}".
    Genera un objeto JSON válido (sin markdown) con las siguientes claves en ESPAÑOL:
    {
      "physiology": "Función hemodinámica normal (conciso, máx 20 palabras).",
      "pathology": "2 patologías frecuentes (ej. Estenosis, Insuficiencia).",
      "symptoms": "Presentación clínica típica (ej. Disnea, Síncope, Angina).",
      "diagnosis": "Método diagnóstico principal o hallazgo físico (ej. Soplo sistólico en foco aórtico).",
      "treatment": "Manejo o tratamiento de primera línea general.",
      "pearl": "Un 'Dato Clave' (High Yield) indispensable para exámenes."
    }
  `;

  const systemInstruction = `Eres un profesor experto en cardiología. Responde siempre en formato JSON válido.`;

  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemInstruction, forceJson: true }),
    });

    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || JSON.stringify(result.data);

  } catch (error: any) {
    console.warn("Backend no disponible. Tratando conexión directa con Gemini de respaldo...", error.message);
    // Si fue un timeout del backend, abortar de inmediato para no hacer esperar al usuario de nuevo
    if (error.message.includes('tardó demasiado')) throw error;
    
    // 2. Si el backend falla, intentar directo:
    return await callGeminiDirectly(prompt, systemInstruction, true);
  }
};

export const getQuizQuestion = async (partName: string): Promise<string> => {
  const prompt = `
      Genera una viñeta clínica corta y desafiante (estilo examen MIR/USMLE) sobre un paciente con patología en: "${partName}".
      NO menciones el nombre de la estructura.
      Describe la edad del paciente, síntomas clave, y hallazgos a la auscultación o imagen.
      El objetivo es que el estudiante deduzca la estructura afectada.
      Longitud máxima: 50 palabras. Idioma: ESPAÑOL.
    `;

  const systemInstruction = `Eres un profesor de medicina que crea casos clínicos desafiantes.`;

  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemInstruction, forceJson: false }),
    });

    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || "Identifica la estructura asociada con esta área basándote en la anatomía.";

  } catch (error: any) {
    console.warn("Backend no disponible. Fallback directo a Gemini para Quiz...", error.message);
    if (error.message.includes('tardó demasiado')) throw error;
    return await callGeminiDirectly(prompt, systemInstruction, false);
  }
};

export const sendChatMessage = async (partName: string, message: string, history: { role: string, text: string }[]): Promise<string> => {
  const historyText = history.map(m => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${m.text}`).join('\n');
  const prompt = `Historial de conversación:\n${historyText}\n\nUsuario: ${message}`;

  const systemInstruction = `Eres un asistente médico experto de IA, especializado en cardiología. Tu objetivo es proporcionar información científica validada, precisa y educativa sobre la estructura anatómica seleccionada: "${partName}". Responde de forma profesional, como si fueras un tutor clínico. Si el usuario hace preguntas fuera del ámbito médico, declina responder cortésmente recordando tu rol.`;

  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemInstruction, forceJson: false }),
    });

    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || "Sin respuesta";
  } catch (error: any) {
    console.warn("Backend no disponible. Fallback directo a Gemini para Chat...", error.message);
    if (error.message.includes('tardó demasiado')) throw error;
    return await callGeminiDirectly(prompt, systemInstruction, false);
  }
};