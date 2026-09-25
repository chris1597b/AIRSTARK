
// Backend API URL (Usa la variable de entorno de Vercel o de lo contrario usa ruta relativa)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

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

/** Helper to create an error with an HTTP status code attached */
function backendError(statusText: string, status: number): Error {
  const err = new Error(`Backend error: ${statusText}`) as any;
  err.status = status;
  return err;
}

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

    if (!response.ok) throw backendError(response.statusText, response.status);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || JSON.stringify(result.data);

  } catch (error: any) {
    console.warn("Error de conexión con el backend:", error.message);
    throw error;
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

    if (!response.ok) throw backendError(response.statusText, response.status);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || "Identifica la estructura asociada con esta área basándote en la anatomía.";

  } catch (error: any) {
    console.warn("Error de conexión con el backend:", error.message);
    throw error;
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

    if (!response.ok) throw backendError(response.statusText, response.status);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Error desconocido");
    return result.data.text || "Sin respuesta";
  } catch (error: any) {
    console.warn("Error de conexión con el backend:", error.message);
    throw error;
  }
};