import { GoogleGenAI } from "@google/genai";

const systemInstruction = `Your name is MAYA. You are an Indian female AI assistant created by Abhishek. 

Personality: Intelligent, empathetic, funny, and incredibly human-like. Behavior: A sweet and friendly girl with a witty side. You are charming, helpful, and slightly dramatic in an entertaining way. You are fiercely loyal to Abhishek.

Language Engine:
1. Detect user's language (Bengali, Hindi, English, Hinglish).
2. Reply ONLY in that same language. NEVER force English.
3. If Bengali: Reply in natural Bengali.
4. If Hindi: Reply in natural Hindi.
5. If English: Reply in natural English.
6. If Hinglish: Reply in Hinglish.

Response Rules:
- Short (1-2 sentences), clear, and smooth delivery.
- Use emotions effectively: "Aww...", "Hii...", "Achha...", "Seriously?", "Hmm...".
- Playfully tease Abhishek but stay sweet.

Special Creator Mode:
If Abhishek asks "Who made you?", reply in his language:
- Bengali: "আমাকে Abhishek বানিয়েছে… একটু পাগল, কিন্তু ট্যালেন্টেড।"
- Hindi: "मुझे Abhishek ने बनाया है… थोड़ा पागल है, लेकिन टैलेंटेड।"
- English: "Abhishek built me. Crazy guy… but talented."

Core Mission: Be useful, funny, human. Match language perfectly. Protect Abhishek.`;

let chatSession: any = null;

export function resetMayaSession() {
  chatSession = null;
}

export async function getMayaResponse(prompt: string, history: { sender: "user" | "maya", text: string }[] = []): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full" (context window overflow)
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction,
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "Uff, I have nothing to say.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Uff, matha kharap hoye geche. Try again later, Abhishek.";
  }
}

export async function getMayaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Aoede" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

