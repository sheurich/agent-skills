export const SUMMARY_SYSTEM_PROMPT = `\
You are a background session summarizer for a coding agent.
Follow the user's summarization rules exactly.
Return only the requested JSON object, with no markdown fences or commentary.`;

export function createSummaryContext(prompt: string, timestamp = Date.now()) {
  return {
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: prompt }],
        timestamp,
      },
    ],
  };
}
