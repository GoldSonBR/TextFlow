
import { GoogleGenAI } from "@google/genai";

// We use the Gemini API to simulate different "agents" (GPT, Copilot, etc.)
// by using different models and system instructions.

export const generateText = async (
  modelName: string,
  prompt: string,
  systemInstruction?: string,
  globalContext?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Combine Global Context (Workspace description) with Node specific instructions
  const combinedSystemInstruction = `
${globalContext ? `### GLOBAL CONTEXT / COMPANY VOICE:\n${globalContext}\n\n` : ''}
### ROLE INSTRUCTION:
${systemInstruction || 'You are a helpful AI assistant.'}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: combinedSystemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
    