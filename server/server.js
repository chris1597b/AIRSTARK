import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Gemini AI con la API key del servidor
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint de salud
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Backend AIRSTARK funcionando" });
});

// Endpoint principal para chat con Gemini
app.post("/api/chat", async (req, res) => {
    try {
        const { prompt, systemInstruction, forceJson = false } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "El prompt es requerido" });
        }

        // Generar respuesta usando la SDK de Gemini (v1)
        // Nota: El usuario tenía configurado gemini-2.5-flash originalmente
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction || "Eres un asistente médico experto en anatomía cardíaca.",
            config: forceJson ? { responseMimeType: "application/json" } : undefined
        });

        // La SDK v1 devuelve el texto directamente en el objeto result si es exitoso
        let text = result.text || "";

        // Si no hay texto directo, intentar navegar por la respuesta
        if (!text && result.response && result.response.candidates) {
            text = result.response.candidates[0].content.parts[0].text;
        }

        // Intentar parsear como JSON si se solicitó o si parece ser JSON
        let parsedData;
        try {
            // Limpiar posibles bloques de código markdown
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            // Si no es JSON válido o falla, devolver como objeto con propiedad text
            parsedData = { text: text };
        }

        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        res.status(500).json({
            success: false,
            error: "Error al procesar la solicitud",
            details: error.message,
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Backend AIRSTARK corriendo en http://localhost:${PORT}`);
    console.log(`✅ Gemini API configurada correctamente`);
});
