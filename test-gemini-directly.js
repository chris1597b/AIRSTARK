const API_KEY = "AIzaSyAp-LlEDRs5nofnpJrZfYXdi6G1QcjBYRQ";

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

fetch(endpoint, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        system_instruction: {
            parts: [{ text: "You are a helpful assistant." }]
        },
        contents: [{
            parts: [{ text: "Say hi" }]
        }],
        generationConfig: {
            responseMimeType: "text/plain"
        }
    })
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(e => console.error(e));
