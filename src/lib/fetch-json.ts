export async function fetchJson<T>(
  url: string,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });

  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      message = payload.message ?? payload.error ?? message;
    } catch {
      // Keep the fallback message when the error payload is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
