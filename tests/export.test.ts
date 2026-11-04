import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { parseCraftText } from '../src/lib/parser';
import { summarize } from '../src/lib/model';
import { buildWorkbook } from '../src/lib/exportXlsx';
import { EXAMPLE_TEXT } from '../src/lib/example';
import type { ServerPrices } from '../src/lib/types';

it('gera o xlsx de teste', async () => {
  const build = { sourceLang: 'en' as const, equipments: parseCraftText(EXAMPLE_TEXT), importedAt: '' };
  const prices: ServerPrices = { resources: {}, equipments: {} };
  let i = 0;
  const first = summarize(build, () => undefined, prices);
  for (const r of first.resources) {
    i++;
    if (i % 9 === 0) continue; // alguns sem preço
    prices.resources[r.key] = { p1: 20 + i * 7, p10: i % 3 ? 150 + i * 60 : undefined, p100: i % 4 === 0 ? 1200 + i * 400 : undefined };
  }
  first.equipments.forEach((e, k) => (prices.equipments[e.key] = k % 3 === 2 ? undefined as never : { price: 3000 + k * 900 }));
  const s = summarize(build, () => undefined, prices);
  const buf = await buildWorkbook(s, 'Rafal').xlsx.writeBuffer();
  writeFileSync('/tmp/export_test.xlsx', Buffer.from(buf));
  writeFileSync('/tmp/export_expected.json', JSON.stringify({
    resources: s.resources.map((r) => [r.name, r.totalQty, r.plan.cost ?? 0, r.plan.leftover]),
    equipments: s.equipments.map((e) => [e.name, e.craftCost, e.verdict]),
    totalTogether: s.totalTogether, totalSeparate: s.totalSeparate,
  }));
  expect(s.resources.length).toBe(44);
});

it('lista de compras segue o veredito de cada equipamento', async () => {
  const { shoppingList } = await import('../src/lib/model');
  const build = {
    sourceLang: 'en' as const,
    importedAt: '',
    equipments: [
      { sourceName: 'A', resources: [{ sourceName: 'Pedra', qty: 6 }, { sourceName: 'Pena', qty: 2 }] },
      { sourceName: 'B', resources: [{ sourceName: 'Pedra', qty: 5 }] },
      { sourceName: 'C', resources: [{ sourceName: 'Pena', qty: 1 }] },
      { sourceName: 'D', resources: [{ sourceName: 'Osso', qty: 1 }] },
    ],
  };
  const prices: ServerPrices = {
    resources: { 'name:pedra': { p1: 10, p10: 80 }, 'name:pena': { p1: 5 } },
    equipments: {
      'name:a': { price: 1000 }, // craft 6×10 + 2×5 = 70 → Craftar
      'name:b': { price: 1000 }, // craft 50 → Craftar
      'name:c': { price: 1 }, // craft 5 → Comprar no market
      'name:d': { price: 100 }, // Osso sem preço → Faltam preços
    },
  };
  const list = shoppingList(summarize(build, () => undefined, prices));
  expect(list.buyItems.map((e) => e.name)).toEqual(['C']);
  expect(list.undecided.map((e) => e.name)).toEqual(['D']);
  // Pedra: 6 + 5 = 11 → 1 lote 10 + 1 unidade = 90 (somado entre A e B); Pena: só de A (C é comprado pronto)
  expect(list.craftResources.map((r) => [r.name, r.totalQty, r.plan.cost])).toEqual([
    ['Pedra', 11, 90],
    ['Pena', 2, 10],
  ]);
  expect(list.total).toBe(1 + 90 + 10);
});
