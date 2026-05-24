import OpenAI from 'openai';

// Create an OpenAI client when OPENAI_API_KEY is configured.
export function createOpenAiClient(): OpenAI | null {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

// Ask OpenAI for JSON output from system and user prompts.
export async function completeJsonFromOpenAi(options: {
  openAiClient: OpenAI;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, unknown>> {
  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini';
  const messages = [
    { role: 'system' as const, content: options.systemPrompt },
    { role: 'user' as const, content: options.userPrompt },
  ];

  let completion;
  try {
    completion = await options.openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
      response_format: { type: 'json_object' },
    });
  } catch {
    completion = await options.openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    });
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenAI response was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}
