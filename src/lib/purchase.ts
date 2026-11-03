import type { LotPrices } from './types';

export interface PurchasePlan {
  /** Custo total; null quando não há preço suficiente para comprar. */
  cost: number | null;
  n1: number;
  n10: number;
  n100: number;
  /** Unidades efetivamente compradas (pode ser maior que a quantidade pedida). */
  units: number;
  leftover: number;
}

const INF = Number.POSITIVE_INFINITY;

/**
 * Menor custo para obter pelo menos `n` unidades comprando lotes de 1, 10 e 100.
 * O preço de cada lote é o preço TOTAL do lote (como aparece no HDV).
 * Lotes ausentes (undefined) são considerados indisponíveis.
 *
 * Mesma lógica das fórmulas da planilha exportada.
 */
export function bestPurchase(n: number, prices: LotPrices): PurchasePlan {
  const empty: PurchasePlan = { cost: n === 0 ? 0 : null, n1: 0, n10: 0, n100: 0, units: 0, leftover: 0 };
  if (n <= 0) return { ...empty, cost: 0 };

  const p1 = valid(prices.p1), p10 = valid(prices.p10), p100 = valid(prices.p100);
  // Custo efetivo de cada "bloco" (o lote real ou 10 blocos menores, o que for mais barato)
  const e1 = p1 ?? INF;
  const e10 = Math.min(p10 ?? INF, 10 * e1);
  const e100 = Math.min(p100 ?? INF, 10 * e10);
  const real10 = p10 !== undefined && p10 <= 10 * e1;
  const real100 = p100 !== undefined && p100 <= 10 * e10;

  const m10 = n % 10;
  const rem10Cost = m10 === 0 ? 0 : m10 * e1;
  const up10 = m10 > 0 && e10 < rem10Cost;
  const g10 = Math.min(e10, rem10Cost);
  const m100 = n % 100;
  const g100r = mul(Math.floor(m100 / 10), e10) + g10;
  const up100 = e100 < g100r;
  const cost = mul(Math.floor(n / 100), e100) + Math.min(e100, g100r);
  if (!Number.isFinite(cost)) return empty;

  const c100 = Math.floor(n / 100) + (up100 ? 1 : 0);
  const c10 = up100 ? 0 : Math.floor(m100 / 10) + (up10 ? 1 : 0);
  const c1 = up100 || up10 ? 0 : m10;

  // Converte blocos "efetivos" em lotes reais
  const n100 = real100 ? c100 : 0;
  const k10 = c10 + (real100 ? 0 : 10 * c100);
  const n10 = real10 ? k10 : 0;
  const n1 = c1 + (real10 ? 0 : 10 * k10);
  const units = n100 * 100 + n10 * 10 + n1;
  return { cost, n1, n10, n100, units, leftover: units - n };
}

/** Multiplicação em que 0 × infinito = 0. */
function mul(a: number, b: number) {
  return a === 0 ? 0 : a * b;
}

function valid(v: number | undefined): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

export function describePlan(p: PurchasePlan): string {
  if (p.cost === null) return 'Sem preço informado';
  const parts: string[] = [];
  if (p.n100) parts.push(`${p.n100}× lote 100`);
  if (p.n10) parts.push(`${p.n10}× lote 10`);
  if (p.n1) parts.push(`${p.n1}× unidade`);
  return parts.join(' + ');
}
