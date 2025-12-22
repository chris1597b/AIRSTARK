// Backend API URL
const BACKEND_URL = "http://localhost:3001";

// Defines the structure of the medical data we expect
export interface MedicalData {
  physiology: string;
  pathology: string;
  symptoms: string;     // Clinical presentation
  diagnosis: string;    // Diagnostic modality
  treatment: string;    // Management
  pearl: string;        // High yield fact
}

export const getClinicalContext = async (partName: string): Promise<string> => {
  try {
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

    // Llamar al backend en lugar de Gemini directamente
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemInstruction,
        forceJson: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error desconocido del backend");
    }

    // Retornar el texto de la respuesta
    return result.data.text || JSON.stringify(result.data);
  } catch (error) {
    console.error("Gemini Error:", error);
    return JSON.stringify({
      physiology: "Error de conexión.",
      pathology: "No se pudieron recuperar los datos.",
      symptoms: "Verifica conexión.",
      diagnosis: "Verifica conexión.",
      treatment: "Verifica conexión.",
      pearl: "Verifica tu API Key o el backend."
    });
  }
};

export const getQuizQuestion = async (partName: string): Promise<string> => {
  try {
    const prompt = `
        Genera una viñeta clínica corta y desafiante (estilo examen MIR/USMLE) sobre un paciente con patología en: "${partName}".
        NO menciones el nombre de la estructura.
        Describe la edad del paciente, síntomas clave, y hallazgos a la auscultación o imagen.
        El objetivo es que el estudiante deduzca la estructura afectada.
        Longitud máxima: 50 palabras. Idioma: ESPAÑOL.
      `;

    const systemInstruction = `Eres un profesor de medicina que crea casos clínicos desafiantes.`;

    // Llamar al backend
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemInstruction,
        forceJson: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error desconocido del backend");
    }

    return result.data.text || "Identifica la estructura asociada con esta área basándote en la anatomía.";
  } catch (error) {
    console.error("Error:", error);
    return "Identifica esta estructura anatómica.";
  }
}