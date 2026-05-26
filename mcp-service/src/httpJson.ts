// Perform a JSON HTTP request and parse the response body.
export async function requestJson<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseText = await response.text();
  let parsed: unknown = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsed as T;
}

// Perform a Turtle export request and return plain text.
export async function requestTurtle(
  baseUrl: string,
  body: { entity_ids?: '*' | number[]; entity_names?: string[]; role_id?: string },
): Promise<string> {
  const response = await fetch(`${baseUrl}/rdf/turtle`, {
    method: 'POST',
    headers: {
      Accept: 'text/turtle',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as { error?: string };
      if (parsed.error) {
        errorMessage = parsed.error;
      }
    } catch {
      if (responseText) {
        errorMessage = responseText;
      }
    }
    throw new Error(errorMessage);
  }

  return responseText;
}
