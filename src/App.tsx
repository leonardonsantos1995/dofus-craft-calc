import { useMemo, useState } from 'react';
import { getCachedItem } from './lib/dofusdb';
import { summarize } from './lib/model';
import { loadJSON, saveJSON } from './lib/storage';
import type { Build, LotPrices, MarketPrice, ServerPrices } from './lib/types';
import { ImportTab } from './components/ImportTab';
import { PricesTab } from './components/PricesTab';
import { CraftsTab } from './components/CraftsTab';
import { SummaryTab } from './components/SummaryTab';

type Tab = 'importar' | 'precos' | 'crafts' | 'resumo';
const SERVERS = ['Rafal', 'Brial', 'Dakal', 'Draconiros', 'Hell Mina', 'Imagiro', 'Kourial', 'Mikhal', 'Ombre', 'Orukam', 'Salar', 'Tal Kasha', 'Tylezia'];
const EMPTY: ServerPrices = { resources: {}, equipments: {} };

export default function App() {
  const [build, setBuildState] = useState<Build | null>(() => loadJSON<Build | null>('dcc.build.v1', null));
  const [server, setServerState] = useState<string>(() => loadJSON('dcc.server', 'Rafal'));
  const [allPrices, setAllPrices] = useState<Record<string, ServerPrices>>(() => loadJSON('dcc.prices.v1', {}));
  const [tab, setTab] = useState<Tab>('importar');
  const [cacheTick, setCacheTick] = useState(0);
  const [exporting, setExporting] = useState(false);

  const prices = allPrices[server] ?? EMPTY;

  const summary = useMemo(
    () => (build ? summarize(build, getCachedItem, prices) : null),
    // cacheTick força recalcular após novas consultas na DofusDB
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [build, prices, cacheTick],
  );

  const setBuild = (b: Build) => {
    setBuildState(b);
    saveJSON('dcc.build.v1', b);
    setCacheTick((t) => t + 1);
  };

  const setServer = (s: string) => {
    setServerState(s);
    saveJSON('dcc.server', s);
  };

  const updatePrices = (fn: (p: ServerPrices) => ServerPrices) => {
    setAllPrices((prev) => {
      const next = { ...prev, [server]: fn(prev[server] ?? EMPTY) };
      saveJSON('dcc.prices.v1', next);
      return next;
    });
  };

  const setLot = (key: string, field: keyof Omit<LotPrices, 'updatedAt'>, value: number | undefined) =>
    updatePrices((p) => ({
      ...p,
      resources: { ...p.resources, [key]: { ...p.resources[key], [field]: value, updatedAt: new Date().toISOString() } },
    }));

  const setMarket = (key: string, value: number | undefined) =>
    updatePrices((p) => ({
      ...p,
      equipments: { ...p.equipments, [key]: { price: value, updatedAt: new Date().toISOString() } as MarketPrice },
    }));

  const exportXlsx = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const { downloadXlsx } = await import('./lib/exportXlsx');
      await downloadXlsx(summary, server);
    } finally {
      setExporting(false);
    }
  };

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: 'importar', label: 'Montar set' },
    { id: 'precos', label: 'Preços', disabled: !summary?.equipments.length },
    { id: 'crafts', label: 'Crafts', disabled: !summary?.equipments.length },
    { id: 'resumo', label: 'Resumo', disabled: !summary?.equipments.length },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <h1>Dofus Craft Calc</h1>
        <div className="topbar-actions">
          <label>
            Servidor{' '}
            <select value={server} onChange={(e) => setServer(e.target.value)}>
              {SERVERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!summary?.equipments.length || exporting} onClick={exportXlsx}>
            {exporting ? 'Gerando…' : 'Exportar Excel'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} disabled={t.disabled} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'importar' && <ImportTab current={build} onImported={setBuild} onContinue={() => setTab('precos')} />}
        {tab === 'precos' && summary && <PricesTab summary={summary} server={server} onChange={setLot} />}
        {tab === 'crafts' && summary && <CraftsTab summary={summary} onMarketChange={setMarket} />}
        {tab === 'resumo' && summary && <SummaryTab summary={summary} />}
      </main>
    </div>
  );
}
