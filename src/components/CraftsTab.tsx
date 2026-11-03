import { describePlan } from '../lib/purchase';
import type { BuildSummary, Verdict } from '../lib/model';
import { ItemName, PriceInput, kamas } from './common';

export function verdictClass(v: Verdict) {
  return v === 'Craftar' ? 'good' : v === 'Comprar no market' ? 'bad' : 'muted';
}

export function CraftsTab({ summary, onMarketChange }: { summary: BuildSummary; onMarketChange: (key: string, v: number | undefined) => void }) {
  return (
    <section>
      {summary.equipments.map((eq) => (
        <div className="card equip" key={eq.key}>
          <div className="equip-main">
            <h3>
              <ItemName name={eq.name} sourceName={eq.sourceName} img={eq.img} resolved={eq.resolved} />
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Qtd</th>
                  <th>Como comprar</th>
                  <th>Sobra</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {eq.lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <ItemName name={l.name} sourceName={l.sourceName} img={l.img} />
                    </td>
                    <td className="num">{l.qty}</td>
                    <td className={l.plan.cost === null ? 'warn' : 'plan'}>{describePlan(l.plan)}</td>
                    <td className="num">{l.plan.cost === null ? '' : l.plan.leftover || ''}</td>
                    <td className="num">{kamas(l.plan.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>TOTAL DO CRAFT</td>
                  <td className="num">{kamas(eq.craftCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <aside className="compare">
            <h4>Comparativo</h4>
            <label>
              Preço no market
              <PriceInput value={eq.market} onChange={(v) => onMarketChange(eq.key, v)} placeholder="Digite o preço" />
            </label>
            <dl>
              <dt>Custo do craft</dt>
              <dd>{kamas(eq.craftCost)}</dd>
              <dt>Diferença (market − craft)</dt>
              <dd>{eq.diff === undefined ? '—' : kamas(eq.diff)}</dd>
              <dt>Recursos sem preço</dt>
              <dd className={eq.missing ? 'warn' : ''}>{eq.missing}</dd>
            </dl>
            <div className={`verdict ${verdictClass(eq.verdict)}`}>{eq.verdict}</div>
          </aside>
        </div>
      ))}
      <div className="card total-bar">
        TOTAL GERAL (cada equipamento comprado separado): <b>{kamas(summary.totalSeparate)}</b>
      </div>
    </section>
  );
}
