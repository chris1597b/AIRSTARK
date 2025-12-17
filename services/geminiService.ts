import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const model = "gemini-2.5-flash";
    // Request JSON format explicitly and IN SPANISH with clinical depth
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

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    return response.text || JSON.stringify({ 
        physiology: "Datos no disponibles", 
        pathology: "Datos no disponibles", 
        symptoms: "-",
        diagnosis: "-",
        treatment: "-",
        pearl: "Sin datos" 
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    return JSON.stringify({ 
        physiology: "Error de conexión.", 
        pathology: "No se pudieron recuperar los datos.", 
        symptoms: "Verifica conexión.",
        diagnosis: "Verifica conexión.",
        treatment: "Verifica conexión.",
        pearl: "Verifica tu API Key." 
    });
  }
};

export const getQuizQuestion = async (partName: string): Promise<string> => {
    try {
      const model = "gemini-2.5-flash";
      const prompt = `
        Genera una viñeta clínica corta y desafiante (estilo examen MIR/USMLE) sobre un paciente con patología en: "${partName}".
        NO menciones el nombre de la estructura.
        Describe la edad del paciente, síntomas clave, y hallazgos a la auscultación o imagen.
        El objetivo es que el estudiante deduzca la estructura afectada.
        Longitud máxima: 50 palabras. Idioma: ESPAÑOL.
      `;
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      return response.text || "Identifica la estructura asociada con esta área basándote en la anatomía.";
    } catch (error) {
      return "Identifica esta estructura anatómica.";
    }
}