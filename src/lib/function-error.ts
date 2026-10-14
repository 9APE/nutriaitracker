/**
 * supabase.functions.invoke reports any non-2xx as the generic
 * "Edge Function returned a non-2xx status code". The real reason is in the
 * response body, so pull it out for display.
 */
export async function getFunctionErrorMessage(error: unknown, fallback = "Request failed"): Promise<string> {
  const err = error as { message?: string; context?: Response } | null;
  try {
    const res = err?.context;
    if (res && typeof res.clone === "function") {
      const body = await res.clone().json();
      if (typeof body?.error === "string" && body.error) return body.error;
      if (typeof body?.message === "string" && body.message) return body.message;
    }
  } catch {
    /* body was not JSON */
  }
  return err?.message || fallback;
}
