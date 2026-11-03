// Cloudflare Pages Function: proxy da DofusDB em produção.
// Em desenvolvimento quem faz esse papel é o proxy do Vite (vite.config.ts).
// Só repassa as consultas que o site usa (itens e receitas), com cache de 1h.
const UPSTREAM = 'https://api.dofusdb.fr';
const ALLOWED = new Set(['items', 'recipes']);

export async function onRequestGet({ request, params }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (parts.length !== 1 || !ALLOWED.has(parts[0])) {
    return new Response('Not found', { status: 404 });
  }
  const url = new URL(request.url);
  const upstream = await fetch(`${UPSTREAM}/${parts[0]}${url.search}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'dofus-craft-calc (Cloudflare Pages)' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  const res = new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' } });
  if (upstream.ok) res.headers.set('Cache-Control', 'public, max-age=3600');
  return res;
}
