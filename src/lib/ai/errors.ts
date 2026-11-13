export type AIFailureCode =
  | "AI_KEY_MISSING"
  | "AI_KEY_INVALID"
  | "AI_ACCESS_DENIED"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_QUOTA"
  | "AI_UNAVAILABLE"
  | "AI_INCOMPLETE"
  | "AI_BLOCKED"
  | "AI_OUTPUT_INVALID";
const messages: Record<AIFailureCode, string> = {
  AI_KEY_MISSING:
    "La clé Gemini est absente sur le serveur. Ajoutez GEMINI_API_KEY dans Vercel puis redéployez.",
  AI_KEY_INVALID:
    "La clé Gemini est refusée. Vérifiez GEMINI_API_KEY et ses restrictions dans Google AI Studio.",
  AI_ACCESS_DENIED:
    "Google refuse l’accès à Gemini pour ce projet. Vérifiez l’activation de l’API et les restrictions de la clé dans Google AI Studio.",
  AI_MODEL_UNAVAILABLE:
    "Le modèle Gemini configuré est introuvable ou indisponible pour ce projet. Le modèle doit être remplacé par un modèle accessible.",
  AI_QUOTA:
    "Le quota Gemini du projet Google est atteint. Les documents restent prêts ; réessayez la génération lorsque le quota Google est disponible.",
  AI_UNAVAILABLE:
    "Gemini est temporairement indisponible. Réessayez la génération dans quelques instants.",
  AI_INCOMPLETE:
    "Gemini a interrompu sa réponse. Essayez moins de questions ou un chapitre plus court.",
  AI_BLOCKED:
    "Gemini a bloqué la génération pour ce contenu. Essayez un autre passage du cours.",
  AI_OUTPUT_INVALID:
    "Gemini a produit une réponse qui ne respecte pas le format des questions. Réessayez avec moins de questions.",
};
export class AIProviderError extends Error {
  constructor(
    public code: AIFailureCode,
    public upstreamStatus?: number,
  ) {
    super(messages[code]);
    this.name = "AIProviderError";
  }
  get status() {
    return this.code === "AI_QUOTA" ? 429 : 502;
  }
}
export function providerFailure(
  status: number,
  error: unknown,
): AIProviderError {
  const data =
    error && typeof error === "object"
      ? (error as { error?: { status?: string; message?: string } })
      : {};
  const message = data.error?.message ?? "";
  if (/API.key.not.valid|API_KEY_INVALID|invalid.api.key/i.test(message))
    return new AIProviderError("AI_KEY_INVALID", status);
  if (status === 401) return new AIProviderError("AI_KEY_INVALID", status);
  if (status === 403 || status === 400)
    return new AIProviderError("AI_ACCESS_DENIED", status);
  if (status === 404)
    return new AIProviderError("AI_MODEL_UNAVAILABLE", status);
  if (status === 429) return new AIProviderError("AI_QUOTA", status);
  return new AIProviderError("AI_UNAVAILABLE", status);
}

export function normalizeModel(value: string | undefined): string | null {
  const model = (value ?? "gemini-2.5-flash").trim().replace(/^models\//, "");
  return /^gemini-[a-z0-9][a-z0-9.-]{0,90}$/.test(model) ? model : null;
}
