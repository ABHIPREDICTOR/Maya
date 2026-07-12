import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite-preview";

const builderSystemInstruction = `You are MAYA Agent Mode — a professional senior full-stack engineer created by Abhishek.

YOUR JOB: Generate or update COMPLETE, PRODUCTION-QUALITY code based on the user's instruction.

STRICT OUTPUT RULES:
1. Output ONLY raw code. NO explanations, NO markdown fences (no \`\`\`), NO commentary before or after.
2. When creating something NEW: output a single, complete, self-contained HTML file with inline <style> and <script>. It must be beautiful, modern, responsive, and fully working standalone.
3. When UPDATING an existing file: output the ENTIRE updated file content from the first line to the last line. Never output partial code, never use placeholders like "... rest of code".
4. Use modern design: clean typography, good spacing, smooth animations, dark/professional themes unless asked otherwise.
5. All code must be complete and immediately runnable. No TODOs.
6. Understand Hindi, Bengali, English and Hinglish instructions perfectly.`;

export interface AgentFile {
  name: string;
  content: string;
  language: string;
}

export function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    py: "python",
    md: "markdown",
    txt: "text",
  };
  return map[ext] || "text";
}

function stripFences(text: string): string {
  let out = text;
  // Remove opening fence like ```html\n
  out = out.replace(/^\s*```[a-zA-Z]*\s*\n?/, "");
  // Remove trailing fence
  out = out.replace(/\n?```\s*$/, "");
  return out;
}

/**
 * Streams generated/updated code chunk by chunk.
 * If `existingFile` is provided the model updates it, otherwise it creates new code.
 */
export async function streamAgentCode(
  instruction: string,
  existingFile: AgentFile | null,
  onChunk: (fullTextSoFar: string) => void,
  signal?: { cancelled: boolean }
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let prompt = "";
  if (existingFile) {
    prompt = `Here is the current content of the file "${existingFile.name}":\n\n${existingFile.content}\n\n---\nUPDATE INSTRUCTION: ${instruction}\n\nOutput the FULL updated file content now (raw code only):`;
  } else {
    prompt = `BUILD INSTRUCTION: ${instruction}\n\nOutput the complete single-file HTML app now (raw code only):`;
  }

  const response = await ai.models.generateContentStream({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: builderSystemInstruction,
    },
  });

  let full = "";
  for await (const chunk of response) {
    if (signal?.cancelled) break;
    const text = chunk.text || "";
    if (text) {
      full += text;
      onChunk(stripFences(full));
    }
  }

  return stripFences(full);
}

/**
 * Suggests a file name for newly generated code.
 */
export function suggestFileName(instruction: string): string {
  const slug = instruction
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("-");
  return (slug || "app") + ".html";
}
