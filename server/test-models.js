import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
    try {
        console.log("Listing models...");
        const models = await ai.models.list();
        console.log("Available models:");
        models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
