export type ModelLike = {
  provider: string;
  id: string;
};

export type SettingsLike = Record<string, unknown>;

/**
 * Cheap model candidates in preference order (substring matched against model ID).
 * Configured model tiers are tried before these generic fallbacks.
 */
export const CHEAP_MODEL_CANDIDATES = [
  "haiku-4-5",
  "gpt-5.4-mini",
  "gpt-5.1-codex-mini",
  "gpt-5.3-codex-spark",
  "gpt-5-mini",
  "gpt-4o-mini",
  "gemini-3-flash",
  "claude-sonnet-4-5",
];

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function autoSummarizeModel(settings: SettingsLike): string | undefined {
  return stringValue(objectValue(settings.autoSummarize)?.model);
}

function scoutOverrideModel(settings: SettingsLike): string | undefined {
  const subagents = objectValue(settings.subagents);
  const agentOverrides = objectValue(subagents?.agentOverrides);
  const scout = objectValue(agentOverrides?.scout);
  return stringValue(scout?.model);
}

export function configuredModelReferences(settings: SettingsLike = {}): string[] {
  return [
    autoSummarizeModel(settings),
    scoutOverrideModel(settings),
  ].filter((value): value is string => Boolean(value));
}

function referenceMatchRank(model: ModelLike, reference: string): number {
  const slash = reference.indexOf("/");
  const referenceProvider = slash === -1 ? undefined : reference.slice(0, slash);
  const referenceId = slash === -1 ? reference : reference.slice(slash + 1);

  if (referenceProvider && model.provider !== referenceProvider) return 0;
  if (model.id === referenceId) return 3;
  if (model.id.startsWith(referenceId)) return 2;
  if (model.id.includes(referenceId)) return 1;
  return 0;
}

function preferredCandidate(matches: ModelLike[]): ModelLike | undefined {
  return matches.find((m) => m.id.startsWith("arn:"))
    ?? matches.find((m) => m.id.startsWith("global."))
    ?? matches[0];
}

export function selectCheapModel<T extends ModelLike>(
  models: Iterable<T>,
  hasConfiguredAuth: (model: T) => boolean,
  settings: SettingsLike = {},
): T | undefined {
  const all = Array.from(models);

  for (const reference of configuredModelReferences(settings)) {
    const rankedMatches = all
      .map((model) => ({ model, rank: referenceMatchRank(model, reference) }))
      .filter(({ model, rank }) => rank > 0 && hasConfiguredAuth(model))
      .sort((a, b) => b.rank - a.rank);
    const configured = preferredCandidate(rankedMatches.map(({ model }) => model));
    if (configured) return configured as T;
  }

  for (const substr of CHEAP_MODEL_CANDIDATES) {
    const matches = all.filter((model) => model.id.includes(substr) && hasConfiguredAuth(model));
    const selected = preferredCandidate(matches);
    if (selected) return selected as T;
  }

  return undefined;
}
