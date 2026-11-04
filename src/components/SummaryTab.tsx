import { useState } from 'react';
import { shoppingList, type BuildSummary, type ShoppingList } from '../lib/model';
import { describePlan } from '../lib/purchase';
import { ItemName, kamas } from './common';
import { verdictClass } from './CraftsTab';

export function SummaryTab({ summary }: { summary: BuildSummary }) {
  const totalDiff = summary.equipments.reduce((s, e) => s + (e.diff ?? 0), 0);
  const marketTotal = summary.equipments.reduce((s, e) => s + (e.market ?? 0), 0);
  return (
    <>
      <section className="card">
        <h2>Resumo: craftar ou comprar?</h2>
        <table>
          <thead>
            <tr>
              <th>Equipamento</th>
              <th className="num">Custo do craft</th>
              <th className="num">Preço no market</th>
              <th className="num">Economia craftando</th>
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
      </section>

      <ShoppingListCard list={shoppingList(summary)} />
    </>
  );
}

function ShoppingListCard({ list }: { list: ShoppingList }) {
  const [copied, setCopied] = useState(false);
  const empty = !list.buyItems.length && !list.craftResources.length;

  const copy = async () => {
    await navigator.clipboard.writeText(toText(list));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="card shopping">
      <div className="row space-between shopping-head">
        <h2>Lista de compras</h2>
        {!empty && <button onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar lista'}</button>}
      </div>
      <p className="muted">
        Segue a melhor opção de cada equipamento: os que valem <span className="good strong">Craftar</span> entram com os recursos, e os que valem{' '}
        <span className="bad strong">Comprar no market</span> entram como item pronto.
      </p>

      {list.undecided.length > 0 && (
        <div className="message error">
          {list.undecided.length === 1 ? 'Um equipamento ainda não entrou' : `${list.undecided.length} equipamentos ainda não entraram`} na lista porque faltam
          preços: {list.undecided.map((e) => e.name).join(', ')}. Preencha nas abas Preços e Crafts.
        </div>
      )}

      {empty ? (
        <p className="muted small">Nada para comprar ainda. Informe os preços para o sistema decidir entre craftar e comprar.</p>
      ) : (
        <>
          {list.buyItems.length > 0 && (
            <>
              <h3 className="shopping-sub bad">Comprar pronto no market</h3>
              <table>
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th className="num">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {list.buyItems.map((e) => (
                    <tr key={e.key}>
                      <td>
                        <ItemName name={e.name} sourceName={e.sourceName} img={e.img} resolved={e.resolved} />
                      </td>
                      <td className="num">{kamas(e.market)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Subtotal</td>
                    <td className="num">{kamas(list.itemsCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {list.craftResources.length > 0 && (
            <>
              <h3 className="shopping-sub good">Recursos para craftar</h3>
              <table>
                <thead>
                  <tr>
                    <th>Recurso</th>
                    <th className="num">Qtd</th>
                    <th>Como comprar</th>
                    <th className="num">Sobra</th>
                    <th className="num">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {list.craftResources.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <ItemName name={r.name} sourceName={r.sourceName} img={r.img} resolved={r.resolved} />
                      </td>
                      <td className="num">{r.totalQty}</td>
                      <td className="plan">{describePlan(r.plan)}</td>
                      <td className="num">{r.plan.leftover || ''}</td>
                      <td className="num">{kamas(r.plan.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Subtotal</td>
                    <td className="num">{kamas(list.resourcesCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <div className="shopping-total">
            Total a gastar: <b>{kamas(list.total)}</b>
          </div>
        </>
      )}
    </section>
  );
}

function toText(list: ShoppingList): string {
  const lines: string[] = [];
  if (list.buyItems.length) {
    lines.push('COMPRAR NO MARKET');
    for (const e of list.buyItems) lines.push(`- ${e.name}: ${kamas(e.market)}`);
    lines.push('');
  }
  if (list.craftResources.length) {
    lines.push('RECURSOS PARA CRAFTAR');
    for (const r of list.craftResources) lines.push(`- ${r.totalQty}x ${r.name} (${describePlan(r.plan)}): ${kamas(r.plan.cost)}`);
    lines.push('');
  }
  lines.push(`TOTAL: ${kamas(list.total)}`);
  return lines.join('\n');
}
