export type SourceFreshnessBand = "fresh" | "watch" | "stale";

export interface SourceFreshnessPolicyBand {
  band: SourceFreshnessBand;
  minDays: number;
  maxDays?: number;
  meaning: string;
}

export interface SourceFreshnessPolicy {
  name: "readiness-source-freshness-v1";
  freshMaxDays: number;
  watchMaxDays: number;
  bands: SourceFreshnessPolicyBand[];
}

export interface SourceFreshness {
  asOf: string;
  retrievedDaysAgo: number;
  band: SourceFreshnessBand;
  review: string;
}

export interface SourceFreshnessRef {
  label: string;
  source: {
    url?: string;
    sourceDate?: string;
    retrievedAt?: string;
    claim?: string;
  };
}

export interface SourceFreshnessAuditResult {
  ok: boolean;
  asOf: string;
  policy: SourceFreshnessPolicy;
  errors: string[];
  warnings: string[];
  countsByBand: Record<SourceFreshnessBand, number>;
}

const millisecondsPerDay = 86_400_000;

export const SOURCE_FRESHNESS_POLICY: SourceFreshnessPolicy = {
  name: "readiness-source-freshness-v1",
  freshMaxDays: 30,
  watchMaxDays: 90,
  bands: [
    {
      band: "fresh",
      minDays: 0,
      maxDays: 30,
      meaning: "Retrieved within 30 days of the readiness date; no refresh prompt."
    },
    {
      band: "watch",
      minDays: 31,
      maxDays: 90,
      meaning: "Retrieved 31-90 days before the readiness date; review soon, especially before release work."
    },
    {
      band: "stale",
      minDays: 91,
      meaning: "Retrieved more than 90 days before the readiness date; refresh before relying on the row."
    }
  ]
};

export function sourceFreshness(retrievedAt: string, asOf: string): SourceFreshness {
  const retrievedDaysAgo = daysBetweenIsoDates(asOf, retrievedAt);
  const band = sourceFreshnessBand(retrievedDaysAgo);

  return {
    asOf,
    retrievedDaysAgo,
    band,
    review: sourceFreshnessReview(band)
  };
}

export function sourceFreshnessBand(ageDays: number): SourceFreshnessBand {
  if (ageDays <= SOURCE_FRESHNESS_POLICY.freshMaxDays) {
    return "fresh";
  }
  if (ageDays <= SOURCE_FRESHNESS_POLICY.watchMaxDays) {
    return "watch";
  }
  return "stale";
}

export function sourceFreshnessReview(band: SourceFreshnessBand): string {
  if (band === "fresh") {
    return "Source was reviewed recently enough for the readiness export.";
  }
  if (band === "watch") {
    return "Source should be rechecked soon; this is a freshness prompt, not a compatibility downgrade.";
  }
  return "Source should be refreshed before relying on this row; stale does not mean incompatible.";
}

export function auditSourceFreshness(
  refs: SourceFreshnessRef[],
  asOf: string,
  policy = SOURCE_FRESHNESS_POLICY
): SourceFreshnessAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const countsByBand: Record<SourceFreshnessBand, number> = {
    fresh: 0,
    watch: 0,
    stale: 0
  };

  const asOfTime = parseIsoDate(asOf, "asOf", errors);

  for (const ref of refs) {
    const { source } = ref;
    if (!source.url) {
      errors.push(`${ref.label} is missing url.`);
    }
    if (!source.claim) {
      errors.push(`${ref.label} is missing claim.`);
    }
    if (!source.retrievedAt) {
      errors.push(`${ref.label} is missing retrievedAt.`);
      continue;
    }

    const retrievedTime = parseIsoDate(source.retrievedAt, `${ref.label}.retrievedAt`, errors);
    const sourceDateTime = source.sourceDate
      ? parseIsoDate(source.sourceDate, `${ref.label}.sourceDate`, errors)
      : undefined;

    if (retrievedTime === undefined || asOfTime === undefined) {
      continue;
    }

    if (retrievedTime > asOfTime) {
      errors.push(`${ref.label} has retrievedAt ${source.retrievedAt} after audit date ${asOf}.`);
      continue;
    }
    if (source.sourceDate && sourceDateTime !== undefined) {
      if (sourceDateTime > asOfTime) {
        errors.push(`${ref.label} has sourceDate ${source.sourceDate} after audit date ${asOf}.`);
      }
      if (retrievedTime < sourceDateTime) {
        errors.push(`${ref.label} has retrievedAt ${source.retrievedAt} before sourceDate ${source.sourceDate}.`);
      }
    }

    const ageDays = Math.max(0, Math.round((asOfTime - retrievedTime) / millisecondsPerDay));
    const band = ageDays <= policy.freshMaxDays
      ? "fresh"
      : ageDays <= policy.watchMaxDays
        ? "watch"
        : "stale";
    countsByBand[band] += 1;
    if (band !== "fresh") {
      warnings.push(
        `${ref.label} is ${band}: retrievedAt ${source.retrievedAt} is ${ageDays} days old as of ${asOf}.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    asOf,
    policy,
    errors,
    warnings,
    countsByBand
  };
}

export function daysBetweenIsoDates(later: string, earlier: string): number {
  const laterTime = parseIsoDateOrThrow(later);
  const earlierTime = parseIsoDateOrThrow(earlier);

  return Math.max(0, Math.round((laterTime - earlierTime) / millisecondsPerDay));
}

function parseIsoDateOrThrow(value: string): number {
  const errors: string[] = [];
  const parsed = parseIsoDate(value, "date", errors);
  if (parsed === undefined) {
    throw new Error(errors[0] ?? `Invalid date: ${value}`);
  }
  return parsed;
}

function parseIsoDate(value: string, label: string, errors: string[]): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    errors.push(`${label} must be a YYYY-MM-DD date.`);
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    errors.push(`${label} must be a valid calendar date.`);
    return undefined;
  }

  return time;
}
