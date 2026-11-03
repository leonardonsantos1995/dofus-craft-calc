import { describe, expect, it } from 'vitest';
import { bestPurchase, describePlan } from '../src/lib/purchase';

/** Força bruta: menor custo para obter >= n unidades. */
function brute(n: number, p1?: number, p10?: number, p100?: number): number | null {
  let best = Infinity;
  const max100 = p100 === undefined ? 0 : Math.ceil(n / 100);
  for (let a = 0; a <= max100; a++) {
    const rem1 = Math.max(0, n - a * 100);
    const max10 = p10 === undefined ? 0 : Math.ceil(rem1 / 10);
    for (let b = 0; b <= max10; b++) {
      const rem = Math.max(0, rem1 - b * 10);
      if (rem > 0 && p1 === undefined) continue;
      const cost = a * (p100 ?? 0) + b * (p10 ?? 0) + rem * (p1 ?? 0);
      best = Math.min(best, cost);
    }
  }
  return Number.isFinite(best) ? best : null;
}

describe('bestPurchase', () => {
  it('exemplo: 67 unidades', () => {
    const p = bestPurchase(67, { p1: 30, p10: 250, p100: 2000 });
    expect(p.cost).toBe(1710);
    expect(describePlan(p)).toBe('6× lote 10 + 7× unidade');
  });

  it('arredonda para cima quando compensa', () => {
    const p = bestPurchase(9, { p1: 30, p10: 250 });
    expect(p).toMatchObject({ cost: 250, n10: 1, leftover: 1 });
  });

  it('sem preço nenhum -> null', () => {
    expect(bestPurchase(5, {}).cost).toBeNull();
  });

  it('bate com força bruta em casos aleatórios', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 4000; i++) {
      const n = 1 + Math.floor(rnd() * 350);
      const pick = (base: number) => (rnd() < 0.2 ? undefined : Math.round(base * (0.4 + rnd() * 1.4)));
      const p1 = pick(100), p10 = pick(1000), p100 = pick(10000);
      const plan = bestPurchase(n, { p1, p10, p100 });
      const expected = brute(n, p1, p10, p100);
      expect(plan.cost, JSON.stringify({ n, p1, p10, p100 })).toBe(expected);
      if (plan.cost !== null) {
        const real = (plan.n1 ? plan.n1 * p1! : 0) + (plan.n10 ? plan.n10 * p10! : 0) + (plan.n100 ? plan.n100 * p100! : 0);
        expect(real).toBe(plan.cost);
        expect(plan.units).toBeGreaterThanOrEqual(n);
      }
    }
  });
});
