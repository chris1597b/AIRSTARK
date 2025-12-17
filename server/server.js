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
        const { prompt, systemInstruction } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "El prompt es requerido" });
        }

        // Generar respuesta usando la API correcta de Gemini
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            systemInstruction: systemInstruction || "Eres un asistente médico experto en anatomía cardíaca.",
            config: { responseMimeType: "application/json" }
        });

        const text = result.text || "";

        // Intentar parsear como JSON si es posible
        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (e) {
            // Si no es JSON válido, devolver como texto plano
            parsedData = { text };
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
