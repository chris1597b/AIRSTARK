import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { prompt, systemInstruction, forceJson = false } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "El prompt es requerido" });
        }

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction || "Eres un asistente médico experto en anatomía cardíaca.",
            config: forceJson ? { responseMimeType: "application/json" } : undefined
        });

        let text = result.text || "";

        if (!text && result.response && result.response.candidates) {
            text = result.response.candidates[0].content.parts[0].text;
        }

        let parsedData;
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            parsedData = { text: text };
        }

        return res.status(200).json({ success: true, data: parsedData });
    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        return res.status(500).json({
            success: false,
            error: "Error al procesar la solicitud",
            details: error.message,
        });
    }
}
