import OpenAI from 'openai'

/* Create an OpenAI client if OPENAI_API_KEY is configured. */
export function createOpenAiClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    return null
  }

  return new OpenAI({ apiKey })
}

/* Ask OpenAI to propose labels/names for ontology suggestions. */
export async function askOpenAiForSuggestionText({ openAiClient, promptText }) {
  if (!openAiClient) {
    return null
  }

  const model = String(process.env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'

  const messages = [
    {
      role: 'system',
      content: 'You help name ontology entities and relationships. Be concise. Return JSON only.',
    },
    {
      role: 'user',
      content: promptText,
    },
  ]

  let result = null
  try {
    result = await openAiClient.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
      response_format: { type: 'json_object' },
    })
  } catch (error) {
    // Some OpenAI API versions/models may not support response_format.
    try {
      result = await openAiClient.chat.completions.create({
        model,
        temperature: 0.2,
        messages,
      })
    } catch (secondError) {
      return null
    }
  }

  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    return null
  }

  try {
    return JSON.parse(content)
  } catch (error) {
    return null
  }
}

