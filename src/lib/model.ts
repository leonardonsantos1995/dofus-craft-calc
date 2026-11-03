import { bestPurchase, type PurchasePlan } from './purchase';
import type { Build, ItemInfo, ItemRef, Lang, LotPrices, ServerPrices } from './types';

export type ItemResolver = (lang: Lang, ref: ItemRef) => ItemInfo | null | undefined;

export interface ResourceSummary {
  key: string;
  name: string; // nome em português (ou o original, se não encontrado)
  sourceName: string;
  img?: string;
  resolved: boolean;
  totalQty: number;
  prices: LotPrices;
  plan: PurchasePlan;
}

export interface EquipmentLine {
  key: string;
  name: string;
  sourceName: string;
  img?: string;
  qty: number;
  plan: PurchasePlan;
}

export type Verdict = 'Informe o preço' | 'Faltam preços' | 'Craftar' | 'Comprar no market';

export interface EquipmentSummary {
  key: string;
  name: string;
  sourceName: string;
  img?: string;
  resolved: boolean;
  lines: EquipmentLine[];
  craftCost: number;
  missing: number;
  market?: number;
  diff?: number;
  verdict: Verdict;
}

export interface BuildSummary {
  resources: ResourceSummary[];
  equipments: EquipmentSummary[];
  totalSeparate: number;
  totalTogether: number;
  totalMarket: number;
}

export function itemKey(info: ItemInfo | null | undefined, ref: ItemRef) {
  if (info) return `id:${info.id}`;
  if (ref.id !== undefined) return `id:${ref.id}`;
  return `name:${ref.sourceName.toLowerCase()}`;
}

export function summarize(build: Build, resolve: ItemResolver, prices: ServerPrices): BuildSummary {
  const lang = build.sourceLang;
  const ptName = (info: ItemInfo | null | undefined, src: string) => info?.names.pt ?? src;

  const resMap = new Map<string, ResourceSummary>();
  const selected = build.equipments.filter((e) => e.include !== false && e.resources.length > 0);
  const equipments: EquipmentSummary[] = selected.map((eq) => {
    const count = eq.count ?? 1;
    const eqInfo = resolve(lang, eq);
    const key = itemKey(eqInfo, eq);
    const lines: EquipmentLine[] = eq.resources.map((r) => {
      const qty = r.qty * count;
      const info = resolve(lang, r);
      const rKey = itemKey(info, r);
      const lot = prices.resources[rKey] ?? {};
      let agg = resMap.get(rKey);
      if (!agg) {
        agg = {
          key: rKey,
          name: ptName(info, r.sourceName),
          sourceName: r.sourceName,
          img: info?.img,
          resolved: !!info,
          totalQty: 0,
          prices: lot,
          plan: bestPurchase(0, lot),
        };
        resMap.set(rKey, agg);
      }
      agg.totalQty += qty;
      return {
        key: rKey,
        name: ptName(info, r.sourceName),
        sourceName: r.sourceName,
        img: info?.img,
        qty,
        plan: bestPurchase(qty, lot),
      };
    });
    const craftCost = lines.reduce((s, l) => s + (l.plan.cost ?? 0), 0);
    const missing = lines.filter((l) => l.plan.cost === null).length;
    const market = prices.equipments[key]?.price;
    const verdict: Verdict =
      market === undefined
        ? 'Informe o preço'
        : missing > 0
          ? 'Faltam preços'
          : market < craftCost
            ? 'Comprar no market'
            : 'Craftar';
    const baseName = ptName(eqInfo, eq.sourceName);
    return {
      key,
      name: count > 1 ? `${baseName} ×${count}` : baseName,
      sourceName: eq.sourceName,
      img: eqInfo?.img,
      resolved: !!eqInfo,
      lines,
      craftCost,
      missing,
      market,
      diff: market === undefined ? undefined : market - craftCost,
      verdict,
    };
  });

  const resources = [...resMap.values()]
    .map((r) => ({ ...r, plan: bestPurchase(r.totalQty, r.prices) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return {
    resources,
    equipments,
    totalSeparate: equipments.reduce((s, e) => s + e.craftCost, 0),
    totalTogether: resources.reduce((s, r) => s + (r.plan.cost ?? 0), 0),
    totalMarket: equipments.reduce((s, e) => s + (e.market ?? 0), 0),
  };
}
