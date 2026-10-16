// Friendly message extraction for Edge Function failures: prefer the JSON
// body the function returned ({ error, message }), then the response object
// carried by FunctionsHttpError, then a caller-supplied fallback.

type EdgeErrorLike = { context?: { bodyUsed: boolean; json(): Promise<unknown> } };

export async function edgeErrorMessage(
  error: unknown,
  data: unknown,
  fallback: string,
): Promise<string> {
  const fromData = data as { message?: string } | null;
  if (fromData?.message) return fromData.message;

  const response = (error as EdgeErrorLike | null)?.context;
  if (response && !response.bodyUsed) {
    try {
      const body = (await response.json()) as { message?: string };
      return body.message ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
