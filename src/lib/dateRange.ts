export type RangePreset = 'today' | 'this week' | 'this month' | 'this year';

export function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function presetRange(preset: RangePreset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === 'this week') {
    const day = now.getDay();
    const mon = new Date(y, m, now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return { from: toLocalYMD(mon), to: toLocalYMD(sun) };
  }
  if (preset === 'this month') return { from: toLocalYMD(new Date(y, m, 1)), to: toLocalYMD(new Date(y, m + 1, 0)) };
  if (preset === 'this year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  const t = toLocalYMD(now);
  return { from: t, to: t };
}
