import { useEffect, useRef, useState, type ReactNode } from 'react';
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
type Source = 'paste' | 'search';
type Dialog = { kind: 'import' } | { kind: 'clear' } | { kind: 'delete'; name: string } | null;

const SOURCE_KEY = 'dofus-craft-calc:import-source';

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
  const [setMsg, setSetMsg] = useState<Msg>(null);
  const [saved, setSaved] = useState<SavedSet[]>(listSavedSets);
  const [, forceRender] = useState(0);
  const [text, setText] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const [source, setSource] = useState<Source>(() => (localStorage.getItem(SOURCE_KEY) as Source) || 'paste');
  const [dialog, setDialog] = useState<Dialog>(null);
  const firstRun = useRef(true);

  const pieces = entries.reduce((n, e) => n + e.count, 0);

  const chooseSource = (s: Source) => {
    setSource(s);
    setMessage(null);
    localStorage.setItem(SOURCE_KEY, s);
  };

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

  // Fecha a modal com Esc
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDialog(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

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
      setSetMsg({ kind: 'error', text: 'Dê um nome ao set para salvar.' });
      return;
    }
    saveSet(name, entries);
    setSaved(listSavedSets());
    setSetMsg({ kind: 'ok', text: `Set “${name}” salvo.` });
  };

  const load = (s: SavedSet) => {
    setSetName(s.name);
    setEntries(s.entries);
    setMessage(null);
    setSetMsg({ kind: 'ok', text: `Set “${s.name}” carregado.` });
  };

  const clearSet = () => {
    setDialog(null);
    setEntries([]);
    setSetName('');
    setSetMsg(null);
  };

  const confirmDelete = (name: string) => {
    setDialog(null);
    deleteSet(name);
    setSaved(listSavedSets());
  };

  const requestImport = () => {
    if (entries.length > 0) setDialog({ kind: 'import' });
    else importFromText('replace');
  };

  const importFromText = async (mode: 'replace' | 'append') => {
    setDialog(null);
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
      if (mode === 'replace') {
        if (title) setSetName(title);
        setEntries(found);
      } else {
        if (title && !setName.trim()) setSetName(title);
        setEntries((prev) => {
          const merged = prev.map((e) => ({ ...e }));
          for (const f of found) {
            const same = merged.find((m) => m.id === f.id);
            if (same) same.count += f.count;
            else merged.push(f);
          }
          return merged;
        });
      }
      setText('');
      setSetMsg(null);
      setMessage({
        kind: missing.length ? 'error' : 'ok',
        text:
          (mode === 'replace'
            ? `${found.length} equipamentos adicionados ao set.`
            : `${found.length} equipamentos somados à lista existente.`) +
          ' Confira a lista ao lado e remova (✕) os que não for craftar.' +
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
      <div className="builder">
        {/* 1. Adicionar */}
        <section className="card builder-add">
          <h2 className="step-title">
            <span className="step-num">1</span> Adicione os equipamentos
          </h2>

          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={source === 'paste'} className={source === 'paste' ? 'active' : ''} onClick={() => chooseSource('paste')}>
              Colar do DofusBook
            </button>
            <button role="tab" aria-selected={source === 'search'} className={source === 'search' ? 'active' : ''} onClick={() => chooseSource('search')}>
              Buscar item por nome
            </button>
          </div>

          {source === 'paste' ? (
            <div className="add-panel">
              <ol className="steps">
                <li>
                  No DofusBook, abra o set e clique no ícone de martelo (<b>Craft Details for This build</b>).
                </li>
                <li>
                  Com a janela de craft aberta, aperte <b>Ctrl+A</b> e depois <b>Ctrl+C</b>.
                </li>
                <li>
                  Cole no campo abaixo (<b>Ctrl+V</b>) e clique em <b>Adicionar ao set</b>.
                </li>
              </ol>
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui o texto copiado do DofusBook…"
                spellCheck={false}
              />
              <div className="row space-between">
                <label className="muted small">
                  Idioma do texto{' '}
                  <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} title="Usado só se o idioma não for detectado sozinho">
                    {LANGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <span className="hint"> (detectado sozinho)</span>
                </label>
                <button className="primary" disabled={!!busy || !text.trim()} onClick={requestImport}>
                  Adicionar ao set
                </button>
              </div>
            </div>
          ) : (
            <div className="add-panel">
              <p className="muted">Digite o nome em português (com ou sem acento) e escolha na lista. Só aparecem itens que têm receita.</p>
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
              <p className="muted small">Use ↑ ↓ e Enter para escolher pelo teclado. Clicar de novo no mesmo item aumenta a quantidade.</p>
            </div>
          )}

          {busy && <p className="muted busy">{busy}</p>}
          {message && <div className={`message ${message.kind}`}>{message.text}</div>}
        </section>

        {/* 2. Revisar */}
        <section className="card builder-set">
          <div className="row space-between set-head">
            <h2 className="step-title">
              <span className="step-num">2</span> Seu set
            </h2>
            {entries.length > 0 && (
              <span className="muted small">
                {entries.length} {entries.length === 1 ? 'equipamento' : 'equipamentos'} · {pieces} {pieces === 1 ? 'peça' : 'peças'}
              </span>
            )}
          </div>

          <label className="field">
            <span className="muted small">Nome do set</span>
            <input className="name-input" value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Ex.: Sacrieur 130 água" />
          </label>

          {entries.length > 0 ? (
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
                    <span className="qty" title="Quantidade">
                      <button onClick={() => changeCount(e.id, -1)} disabled={e.count <= 1} aria-label="Diminuir">
                        −
                      </button>
                      <b>{e.count}</b>
                      <button onClick={() => changeCount(e.id, +1)} aria-label="Aumentar">
                        +
                      </button>
                    </span>
                    <button className="remove" onClick={() => remove(e.id)} aria-label="Remover" title="Remover do set">
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              <p>Nenhum equipamento ainda.</p>
              <p className="muted small">Cole o craft do DofusBook ou busque os itens pelo nome no passo 1.</p>
            </div>
          )}

          {setMsg && <div className={`message ${setMsg.kind}`}>{setMsg.text}</div>}

          <div className="set-footer">
            <div className="row">
              <button disabled={!entries.length} onClick={doSave} title="Guarda o set neste navegador para usar depois">
                Salvar set
              </button>
              <button disabled={!entries.length} onClick={() => setDialog({ kind: 'clear' })}>
                Limpar
              </button>
            </div>
            <button className="primary big" disabled={!current?.equipments.length || !!busy} onClick={onContinue}>
              Ver preços →
            </button>
          </div>
        </section>
      </div>

      {/* Sets salvos */}
      <section className="card saved">
        <h3>Sets salvos</h3>
        {saved.length > 0 ? (
          <ul>
            {saved.map((s) => (
              <li key={s.name}>
                <div className="saved-info">
                  <b>{s.name}</b>
                  <span className="muted small">
                    {s.entries.length} itens · salvo em {new Date(s.savedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <button onClick={() => load(s)}>Abrir</button>
                <button className="remove" aria-label={`Excluir ${s.name}`} title="Excluir" onClick={() => setDialog({ kind: 'delete', name: s.name })}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nenhum set salvo. Use “Salvar set” para guardar um set e abrir depois.</p>
        )}
      </section>

      {dialog?.kind === 'import' && (
        <Modal title="Já existem itens no set" onClose={() => setDialog(null)}>
          <p className="muted">
            O set atual tem {entries.length} {entries.length === 1 ? 'equipamento' : 'equipamentos'}. O que deseja fazer com os itens colados?
          </p>
          <div className="modal-actions">
            <button onClick={() => setDialog(null)}>Cancelar</button>
            <button onClick={() => importFromText('replace')}>Limpar e substituir</button>
            <button className="primary" autoFocus onClick={() => importFromText('append')}>
              Adicionar à lista
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'clear' && (
        <Modal title="Limpar o set?" onClose={() => setDialog(null)}>
          <p className="muted">Todos os {entries.length} equipamentos da lista serão removidos. Sets salvos não são afetados.</p>
          <div className="modal-actions">
            <button onClick={() => setDialog(null)}>Cancelar</button>
            <button className="danger" autoFocus onClick={clearSet}>
              Limpar
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <Modal title="Excluir set salvo?" onClose={() => setDialog(null)}>
          <p className="muted">O set “{dialog.name}” será excluído permanentemente.</p>
          <div className="modal-actions">
            <button onClick={() => setDialog(null)}>Cancelar</button>
            <button className="danger" autoFocus onClick={() => confirmDelete(dialog.name)}>
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
