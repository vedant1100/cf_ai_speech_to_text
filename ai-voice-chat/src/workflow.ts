import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message } from "./durable-object";

export interface WorkflowInput {
  sessionId: string;
  userMessage: string;
  history: Message[];
  apiKey: string;
}

export interface WorkflowOutput {
  reply: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_INSTRUCTION = `You are a helpful, concise voice assistant. Respond naturally as if speaking aloud.
Keep answers brief and clear — aim for 1-3 sentences unless the user asks for detail.`;

/**
 * Orchestrates a single chat turn using Gemini:
 * 1. Build conversation history
 * 2. Call Gemini with a system instruction
 * 3. Return the assistant reply and token usage
 */
export async function runChatWorkflow(
  input: WorkflowInput
): Promise<WorkflowOutput> {
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  // Map stored history (excluding the latest user turn) to Gemini format
  const history = input.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(input.userMessage);
  const response = result.response;
  const reply = response.text();

  const usage = response.usageMetadata;
  return {
    reply,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}
