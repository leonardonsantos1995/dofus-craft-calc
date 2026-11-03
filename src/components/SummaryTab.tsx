import type { BuildSummary } from '../lib/model';
import { ItemName, kamas } from './common';
import { verdictClass } from './CraftsTab';

export function SummaryTab({ summary }: { summary: BuildSummary }) {
  const totalDiff = summary.equipments.reduce((s, e) => s + (e.diff ?? 0), 0);
  const marketTotal = summary.equipments.reduce((s, e) => s + (e.market ?? 0), 0);
  return (
    <section className="card">
      <h2>Resumo: craftar ou comprar?</h2>
      <table>
        <thead>
          <tr>
            <th>Equipamento</th>
            <th>Custo do craft</th>
            <th>Preço no market</th>
            <th>Economia craftando</th>
            <th>Melhor opção</th>
          </tr>
        </thead>
        <tbody>
          {summary.equipments.map((e) => (
            <tr key={e.key}>
              <td>
                <ItemName name={e.name} sourceName={e.sourceName} img={e.img} resolved={e.resolved} />
              </td>
              <td className="num">{kamas(e.craftCost)}</td>
              <td className="num">{kamas(e.market)}</td>
              <td className="num">{e.diff === undefined ? '—' : kamas(e.diff)}</td>
              <td className={`verdict-cell ${verdictClass(e.verdict)}`}>{e.verdict}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTAL</td>
            <td className="num">{kamas(summary.totalSeparate)}</td>
            <td className="num">{kamas(marketTotal)}</td>
            <td className="num">{kamas(totalDiff)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="together">
        <div>
          Comprando os recursos de todos os equipamentos de uma vez: <b>{kamas(summary.totalTogether)}</b>
        </div>
        <div>
          Economia por comprar tudo junto (lotes maiores): <b>{kamas(summary.totalSeparate - summary.totalTogether)}</b>
        </div>
      </div>
    </section>
  );
}
