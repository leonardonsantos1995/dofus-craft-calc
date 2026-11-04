import { describePlan } from '../lib/purchase';
import type { BuildSummary } from '../lib/model';
import type { LotPrices } from '../lib/types';
import { ItemName, PriceInput, daysAgo, kamas } from './common';

type Field = keyof Omit<LotPrices, 'updatedAt'>;

export function PricesTab({ summary, server, onChange }: { summary: BuildSummary; server: string; onChange: (key: string, field: Field, v: number | undefined) => void }) {
  const missing = summary.resources.filter((r) => r.plan.cost === null).length;
  return (
    <section className="card">
      <h2>Preços dos recursos — {server}</h2>
      <p className="muted">
        Digite o preço <b>total do lote</b> como aparece no market. Deixe vazio o lote que não estiver à venda. Os preços ficam salvos por servidor e são
        reaproveitados em outros sets.
      </p>
      {missing > 0 && <p className="message error">{missing} recursos ainda sem preço.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Recurso</th>
              <th className="num input-col">Preço x1</th>
              <th className="num input-col">Lote 10</th>
              <th className="num input-col">Lote 100</th>
              <th className="num">Qtd total</th>
              <th>Como comprar (todos os crafts)</th>
              <th className="num">Custo</th>
              <th className="num">Sobra</th>
              <th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {summary.resources.map((r) => (
              <tr key={r.key}>
                <td>
                  <ItemName name={r.name} sourceName={r.sourceName} img={r.img} resolved={r.resolved} />
                </td>
                {(['p1', 'p10', 'p100'] as Field[]).map((f) => (
                  <td key={f} className="input-cell">
                    <PriceInput value={r.prices[f]} onChange={(v) => onChange(r.key, f, v)} />
                  </td>
                ))}
                <td className="num">{r.totalQty}</td>
                <td className={r.plan.cost === null ? 'warn' : 'plan'}>{describePlan(r.plan)}</td>
                <td className="num strong">{kamas(r.plan.cost)}</td>
                <td className="num">{r.plan.cost === null ? '' : r.plan.leftover || ''}</td>
                <td className="muted small">{daysAgo(r.prices.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>TOTAL (comprando tudo de uma vez)</td>
              <td className="num">{kamas(summary.totalTogether)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
