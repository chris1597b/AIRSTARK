import dotenv from "dotenv";
dotenv.config();

console.log("=== Verificación de Configuración ===");
console.log("API Key presente:", process.env.GEMINI_API_KEY ? "✅ Sí" : "❌ No");
console.log("Longitud de la key:", process.env.GEMINI_API_KEY?.length || 0);
console.log("Primeros 10 caracteres:", process.env.GEMINI_API_KEY?.substring(0, 10) || "N/A");
console.log("PORT:", process.env.PORT || "No configurado");
