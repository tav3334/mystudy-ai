export type ProcessingStage =
  | "load_document"
  | "drive_auth"
  | "download"
  | "extract"
  | "chunk"
  | "embed"
  | "save";
export function processingFailure(error: unknown, stage: ProcessingStage) {
  const raw = error instanceof Error ? error.message : "";
  const name = error instanceof Error ? error.name : "UnknownError";
  const result = (code: string, message: string) => ({ code, message, stage });
  if (raw.includes("DAILY_AI_LIMIT"))
    return result(
      "AI_DAILY_LIMIT",
      "Limite AI quotidienne atteinte. Réessayez après la remise à zéro du quota (UTC). Les embeddings déjà créés sont conservés.",
    );
  if (/AI provider failed \(429\)/.test(raw))
    return result(
      "AI_PROVIDER_QUOTA",
      "Gemini refuse la requête : quota ou limite de débit atteint (429). Vérifiez les quotas du projet Google AI Studio avant de réessayer.",
    );
  if (/AI provider failed \((400|401|403)\)/.test(raw))
    return result(
      "AI_ACCESS",
      "Gemini refuse l’accès. Vérifiez GEMINI_API_KEY, ses restrictions et l’activation du service dans le projet Google.",
    );
  if (/AI provider failed \(404\)/.test(raw))
    return result(
      "AI_MODEL",
      "Modèle d’embedding introuvable. Vérifiez GEMINI_EMBEDDING_MODEL dans Vercel puis redéployez.",
    );
  if (/AI provider failed \(5\d\d\)/.test(raw))
    return result(
      "AI_UNAVAILABLE",
      "Gemini est temporairement indisponible. Réessayez l’indexation plus tard.",
    );
  if (raw.includes("Configuration manquante"))
    return result(
      "CONFIGURATION",
      "Une variable serveur requise est absente dans Vercel. Vérifiez les clés Supabase, Google et Gemini, puis redéployez.",
    );
  if (
    /Google account reconnection required|Drive request failed \((401|403)\)/.test(
      raw,
    )
  )
    return result(
      "DRIVE_ACCESS",
      "Accès Google Drive refusé ou expiré. Reconnectez le compte dans Paramètres et vérifiez l’accès au fichier.",
    );
  if (/Drive request failed \(404\)/.test(raw))
    return result(
      "DRIVE_FILE_MISSING",
      "Fichier Drive supprimé ou inaccessible. Synchronisez Google Drive pour actualiser la bibliothèque.",
    );
  if (
    stage === "drive_auth" &&
    /authenticate data|Unsupported state|Invalid authentication tag/i.test(raw)
  )
    return result(
      "DRIVE_ENCRYPTION",
      "Le jeton Drive ne peut pas être déchiffré. Rétablissez TOKEN_ENCRYPTION_KEY ou reconnectez Google Drive.",
    );
  if (/PasswordException/.test(name))
    return result(
      "PDF_PASSWORD",
      "Ce PDF est protégé par mot de passe. Importez une version déverrouillée pour l’indexer.",
    );
  if (/InvalidPDFException|FormatError/.test(name))
    return result(
      "PDF_INVALID",
      "Le PDF ne peut pas être lu. Vérifiez qu’il s’ouvre correctement puis réimportez-le dans Drive.",
    );
  if (
    /worker|DOMMatrix|@napi-rs\/canvas|Cannot find module|Cannot find package/i.test(
      raw,
    ) &&
    stage === "extract"
  )
    return result(
      "PDF_RUNTIME",
      "Le moteur PDF est incomplet sur le serveur. Déployez la correction du moteur PDF puis relancez l’indexation.",
    );
  // Only fixed application messages are shown verbatim. Never expose provider bodies, tokens, or document text.
  if (
    /^(PDF sans texte lisible\.|Format non pris en charge[.:]|Document trop (volumineux|long)[ :.]|Présentation trop (longue|volumineuse)[ .:]|Aucun texte exploitable dans ce document\.)/.test(
      raw,
    )
  )
    return result("DOCUMENT_CONTENT", raw.slice(0, 350));
  if (name === "TimeoutError" || name === "AbortError")
    return result(
      "TIMEOUT",
      "Le traitement a dépassé le délai autorisé. Réessayez ; pour un gros PDF, utilisez des chapitres plus courts.",
    );
  return result(
    "PROCESSING_FAILED",
    `Indexation interrompue à l’étape « ${stage} ». Consultez les logs Vercel pour le code d’erreur, puis réessayez.`,
  );
}
