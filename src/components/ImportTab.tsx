import { useEffect, useRef, useState } from 'react';
import { detectCraftLang, parseCraftText } from '../lib/parser';
import { getCachedById, lookupCraftableByName, lookupIds, searchCraftable, type SearchResult } from '../lib/dofusdb';
import { buildFromEntries, deleteSet, listSavedSets, saveSet, type SavedSet, type SetEntry } from '../lib/setBuilder';
import type { Build, Lang } from '../lib/types';
import { ItemName } from './common';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'Inglês' },
  { id: 'fr', label: 'Francês' },
  { id: 'es', label: 'Espanhol' },
  { id: 'pt', label: 'Português' },
  { id: 'de', label: 'Alemão' },
];

type Msg = { kind: 'ok' | 'error'; text: string } | null;

interface Props {
  current: Build | null;
  onImported: (b: Build) => void;
  onContinue: () => void;
}

export function ImportTab({ current, onImported, onContinue }: Props) {
  const [entries, setEntries] = useState<SetEntry[]>(current?.entries ?? []);
  const [setName, setSetName] = useState(current?.setName ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  const [saved, setSaved] = useState<SavedSet[]>(listSavedSets);
  const [, forceRender] = useState(0);
  const [text, setText] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const firstRun = useRef(true);

  // Garante nomes/ícones dos itens escolhidos (ex.: ao reabrir o site)
  useEffect(() => {
    const missing = entries.map((e) => e.id).filter((id) => getCachedById(id) === undefined);
    if (missing.length) lookupIds(missing).then(() => forceRender((n) => n + 1));
  }, [entries]);

  // Busca com atraso enquanto digita
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchCraftable(q, ctrl.signal);
        setResults(r);
        setActive(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setMessage({ kind: 'error', text: `Falha na busca: ${(e as Error).message}` });
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Recalcula o set sempre que a lista muda
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const build = await buildFromEntries(setName, entries, (m) => !cancelled && setBusy(m));
        if (!cancelled) onImported(build);
      } catch (e) {
        if (!cancelled) setMessage({ kind: 'error', text: `Falha ao buscar receitas: ${(e as Error).message}` });
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const add = (item: SearchResult) => {
    setEntries((prev) => {
      const found = prev.find((e) => e.id === item.id);
      return found ? prev.map((e) => (e.id === item.id ? { ...e, count: e.count + 1 } : e)) : [...prev, { id: item.id, count: 1 }];
    });
    setQuery('');
    setResults([]);
    setOpen(false);
    setMessage(null);
  };

  const changeCount = (id: number, delta: number) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, count: Math.max(1, e.count + delta) } : e)));
  const remove = (id: number) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      add(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const doSave = () => {
    const name = setName.trim();
    if (!name) {
      setMessage({ kind: 'error', text: 'Dê um nome ao set para salvar.' });
      return;
    }
    saveSet(name, entries);
    setSaved(listSavedSets());
    setMessage({ kind: 'ok', text: `Set “${name}” salvo.` });
  };

  const load = (s: SavedSet) => {
    setSetName(s.name);
    setEntries(s.entries);
    setMessage({ kind: 'ok', text: `Set “${s.name}” carregado.` });
  };

  const importFromText = async () => {
    const parsed = parseCraftText(text);
    if (!parsed.length) {
      setMessage({ kind: 'error', text: 'Não encontrei equipamentos no texto. Abra “Craft Details for This build” no DofusBook, aperte Ctrl+A e Ctrl+C e cole aqui.' });
      return;
    }
    const textLang = detectCraftLang(text) ?? lang;
    setBusy('Procurando os equipamentos na DofusDB…');
    try {
      const infos = await Promise.all(parsed.map((e) => lookupCraftableByName(textLang, e.sourceName)));
      const found: SetEntry[] = [];
      const missing: string[] = [];
      for (const [k, e] of parsed.entries()) {
        const info = infos[k];
        if (!info) {
          missing.push(e.sourceName);
          continue;
        }
        const prev = found.find((f) => f.id === info.id);
        if (prev) prev.count++;
        else found.push({ id: info.id, count: 1 });
      }
      if (!found.length) {
        setMessage({ kind: 'error', text: `Nenhum equipamento foi encontrado na DofusDB (${missing.join(', ')}).` });
        return;
      }
      const title = text.match(/^\s*CRAFT\s*:\s*(.+?)\s*$/im)?.[1];
      if (title) setSetName(title);
      setEntries(found);
      setText('');
      setMessage({
        kind: missing.length ? 'error' : 'ok',
        text:
          `${found.length} equipamentos adicionados ao set. Remova (✕) os que não for craftar.` +
          (missing.length ? ` Não encontrei na DofusDB: ${missing.join(', ')}.` : ''),
      });
    } catch (e) {
      setMessage({ kind: 'error', text: `Falha ao consultar a DofusDB: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="card">
        <div className="row space-between">
          <h2>Montar set</h2>
          <button className="primary" disabled={!current?.equipments.length || !!busy} onClick={onContinue}>
            Ver preços →
          </button>
        </div>
        <p className="muted">Digite o nome de um equipamento (em português, com ou sem acento) e escolha na lista. Só aparecem itens que têm receita.</p>

        <div className="search">
          <input
            className="url-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Ex.: chapéu do papamute, anel ancestral, machado zoth…"
            autoFocus
          />
          {searching && <span className="search-spinner muted small">buscando…</span>}
          {open && query.trim().length >= 2 && (
            <ul className="search-results">
              {results.length === 0 && !searching && <li className="muted">Nenhum item craftável encontrado.</li>}
              {results.map((r, i) => (
                <li key={r.id} className={i === active ? 'active' : ''} onMouseDown={() => add(r)} onMouseEnter={() => setActive(i)}>
                  <ItemName name={r.names.pt ?? `Item ${r.id}`} sourceName={r.names.pt ?? ''} img={r.img} />
                  <span className="muted small">
                    {r.typeName ?? ''} · nível {r.level ?? '?'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {busy && <p className="muted">{busy}</p>}
        {message && <div className={`message ${message.kind}`}>{message.text}</div>}

        {entries.length > 0 && (
          <ul className="set-list">
            {entries.map((e) => {
              const info = getCachedById(e.id);
              const eq = current?.equipments.find((x) => x.id === e.id);
              return (
                <li key={e.id}>
                  <ItemName name={info?.names.pt ?? `Item ${e.id}`} sourceName={info?.names.pt ?? ''} img={info?.img} />
                  <span className={eq && eq.resources.length === 0 ? 'warn small' : 'muted small'}>
                    {info?.level ? `nível ${info.level}` : ''}
                    {eq ? (eq.resources.length ? ` · ${eq.resources.length} recursos` : ' · sem receita') : ''}
                  </span>
                  <span className="qty">
                    <button onClick={() => changeCount(e.id, -1)} disabled={e.count <= 1} aria-label="Diminuir">−</button>
                    <b>{e.count}</b>
                    <button onClick={() => changeCount(e.id, +1)} aria-label="Aumentar">+</button>
                  </span>
                  <button className="remove" onClick={() => remove(e.id)} aria-label="Remover">✕</button>
                </li>
              );
            })}
          </ul>
        )}
        {entries.length === 0 && <p className="muted small">Nenhum equipamento ainda.</p>}

        <div className="row save-row">
          <input className="name-input" value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Nome do set (ex.: Sacrieur 130 água)" />
          <button disabled={!entries.length} onClick={doSave}>
            Salvar set
          </button>
          {entries.length > 0 && (
            <button
              onClick={() => {
                setEntries([]);
                setSetName('');
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {saved.length > 0 && (
          <div className="saved">
            <h3>Sets salvos</h3>
            <ul>
              {saved.map((s) => (
                <li key={s.name}>
                  <button className="link-btn" onClick={() => load(s)}>
                    {s.name}
                  </button>
                  <span className="muted small">
                    {s.entries.length} itens · {new Date(s.savedAt).toLocaleDateString('pt-BR')}
                  </span>
                  <button
                    className="remove"
                    aria-label={`Excluir ${s.name}`}
                    onClick={() => {
                      deleteSet(s.name);
                      setSaved(listSavedSets());
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="alt-import">
          <summary>Importar do DofusBook (copiar e colar)</summary>
          <ol className="steps">
            <li>No DofusBook, abra o set e clique no ícone de martelo (<b>Craft Details for This build</b>).</li>
            <li>Com a janela de craft aberta, aperte <b>Ctrl+A</b> e <b>Ctrl+C</b>.</li>
            <li>Cole aqui (Ctrl+V) e clique em <b>Adicionar ao set</b>. O idioma é detectado sozinho.</li>
          </ol>
          <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ancestral Ring\n\t5 Dark Treechnid Amber\n…'} spellCheck={false} />
          <div className="row">
            <label>
              Idioma (se não detectar){' '}
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={!!busy || !text.trim()} onClick={importFromText}>
              Adicionar ao set
            </button>
          </div>
        </details>
      </section>
    </>
  );
}
