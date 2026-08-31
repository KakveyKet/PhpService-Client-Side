const CREDIT_LEVELS = [
  { minimum: 0, label: 'STARTER', severity: 'secondary' },
  { minimum: 250, label: 'BRONZE', severity: 'warn' },
  { minimum: 500, label: 'SILVER', severity: 'info' },
  { minimum: 750, label: 'GOLD', severity: 'success' },
  { minimum: 1000, label: 'PLATINUM', severity: 'contrast' }
];

export function normalizeCreditScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.trunc(score);
}

export function creditLevelDetails(value) {
  const score = normalizeCreditScore(value);
  let levelIndex = 0;

  for (let index = 0; index < CREDIT_LEVELS.length; index += 1) {
    if (score >= CREDIT_LEVELS[index].minimum) levelIndex = index;
  }

  const level = CREDIT_LEVELS[levelIndex];
  const nextLevel = CREDIT_LEVELS[levelIndex + 1] || null;

  return {
    score,
    label: level.label,
    severity: level.severity,
    nextScore: nextLevel?.minimum || null,
    nextLabel: nextLevel?.label || null,
    progress: nextLevel
      ? Math.min(100, Math.round((score / nextLevel.minimum) * 100))
      : 100
  };
}
