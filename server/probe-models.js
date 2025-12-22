import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testModel(modelName) {
    try {
        console.log(`Testing ${modelName}...`);
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: "hi" }] }]
        });
        console.log(`✅ ${modelName} works!`);
        return true;
    } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message}`);
        return false;
    }
}

async function runTests() {
    const models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
        "gemini-2.0-flash-exp",
        "gemini-2.0-flash"
    ];
    for (const model of models) {
        await testModel(model);
    }
}

runTests();
