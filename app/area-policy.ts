export const STANDARD_SQM_TO_SQFT_FACTOR = 10.7639;
export const STANDARD_SQM_TO_SQYD_FACTOR = 1.1959900463;

export function normalizeSqmToSqftFactor(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 9 && parsed <= 12
    ? parsed
    : STANDARD_SQM_TO_SQFT_FACTOR;
}

export function sqmToSqft(value: number, factor = STANDARD_SQM_TO_SQFT_FACTOR) {
  return value * normalizeSqmToSqftFactor(factor);
}

export function sqftToSqm(value: number, factor = STANDARD_SQM_TO_SQFT_FACTOR) {
  return value / normalizeSqmToSqftFactor(factor);
}

export function sqmToSqyd(value: number) {
  return value * STANDARD_SQM_TO_SQYD_FACTOR;
}

export function sqydToSqm(value: number) {
  return value / STANDARD_SQM_TO_SQYD_FACTOR;
}
