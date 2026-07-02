import { supabase } from "../lib/supabase";

export type AiChatResult = {
  answer: string;
  followUpQuestion: string | null;
  memoriesUpdated: number;
};

export type AiChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function shapeAiChatResult(data: any): AiChatResult {
  if (!data || typeof data.answer !== "string") {
    throw new Error("Invalid AI chat response");
  }
  return {
    answer: data.answer,
    followUpQuestion: typeof data.followUpQuestion === "string" ? data.followUpQuestion : null,
    memoriesUpdated: typeof data.memoriesUpdated === "number" ? data.memoriesUpdated : 0,
  };
}

export async function askAiChat(message: string, recentMessages: AiChatMessage[] = []): Promise<AiChatResult> {
  const body: { message: string; recentMessages?: AiChatMessage[] } = { message: message.trim() };
  const cleanRecent = recentMessages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 500) }));
  if (cleanRecent.length > 0) body.recentMessages = cleanRecent;

  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body,
  });
  if (error) throw error;
  return shapeAiChatResult(data);
}
