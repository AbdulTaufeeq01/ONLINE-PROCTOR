import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

export const geminiFlashModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export function getGeminiFlashModel() {
  return geminiFlashModel;
}
