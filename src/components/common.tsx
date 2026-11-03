import { useEffect, useState } from 'react';

const fmt = new Intl.NumberFormat('pt-BR');

export function kamas(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return fmt.format(Math.round(v));
}

/** Campo numérico de kamas: aceita "1.234", "1 234" ou "1234". Vazio = sem preço. */
export function PriceInput({ value, onChange, placeholder }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string }) {
  const [text, setText] = useState(value === undefined ? '' : fmt.format(value));

  useEffect(() => {
    setText(value === undefined ? '' : fmt.format(value));
  }, [value]);

  const commit = () => {
    const digits = text.replace(/[^\d]/g, '');
    const v = digits === '' ? undefined : parseInt(digits, 10);
    if (v !== value) onChange(v);
    else setText(v === undefined ? '' : fmt.format(v));
  };

  return (
    <input
      className="price-input"
      inputMode="numeric"
      value={text}
      placeholder={placeholder ?? '—'}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function ItemName({ name, sourceName, img, resolved }: { name: string; sourceName: string; img?: string; resolved?: boolean }) {
  return (
    <span className="item-name">
      {img ? <img src={img} alt="" loading="lazy" /> : <span className="img-placeholder" />}
      <span>
        {name}
        {resolved === false && (
          <span className="warn" title="Não encontrado na DofusDB — mantido o nome original">
            {' '}
            ⚠
          </span>
        )}
        {name !== sourceName && <small>{sourceName}</small>}
      </span>
    </span>
  );
}

export function daysAgo(iso?: string): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}
