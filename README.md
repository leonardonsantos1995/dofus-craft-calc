# Dofus Craft Calc

Calcula quanto custa craftar os equipamentos de um set do DofusBook, comparando com o preço de comprar pronto no market.

## Como rodar

Precisa do Node.js 18 ou mais novo.

```bash
npm install
npm run dev
```

O site abre em http://localhost:5173.

No Windows, também dá para dar dois cliques em `iniciar.bat`: ele instala as dependências na primeira vez e sobe o site.

## Como usar

1. **Montar set:** digite o nome de cada equipamento (em português, com ou sem acento) e escolha na lista; ajuste a quantidade (ex.: dois anéis iguais). As receitas, os nomes em português e os ícones vêm da [DofusDB](https://dofusdb.fr). Dá para salvar o set com um nome e carregá-lo depois.
   - Também dá para colar o texto da tela *Craft Details for This build* do DofusBook.
2. **Preços:** informe o preço total do lote de 1, 10 e 100 de cada recurso, como aparece no market. O site escolhe a combinação de lotes mais barata (inclusive arredondar para cima quando compensa) e mostra a sobra.
3. **Crafts:** custo de cada equipamento e o campo do preço no market, com o veredito *Craftar* ou *Comprar no market*.
4. **Resumo:** visão geral do set e quanto se economiza comprando os recursos de todos os equipamentos juntos.
5. **Exportar Excel:** gera o `.xlsx` com as 3 abas e fórmulas vivas.

Os preços ficam salvos no navegador (localStorage), separados por servidor, e são reaproveitados em outros sets.

## Estrutura

```
src/
  lib/
    setBuilder.ts  montador de set: receitas da DofusDB e sets salvos
    parser.ts      texto colado da tela de craft -> equipamentos e recursos
    dofusdb.ts     busca por nome, receitas, nomes em PT e ícones na DofusDB (com cache)
    purchase.ts    melhor combinação de lotes 1/10/100
    model.ts       monta as visões de Preços, Crafts e Resumo
    exportXlsx.ts  gera a planilha com fórmulas (ExcelJS)
  components/      abas da interface
tests/             testes (npm test)
```

## Observações

- A DofusDB é acessada pelo proxy do Vite (`/dofusdb`), então o site precisa rodar com `npm run dev` ou `npm run preview`. Para hospedar em outro lugar, configure um proxy equivalente ou a variável `VITE_DOFUSDB_URL`.
- O import pelo link do DofusBook não é usado: o DofusBook bloqueia (Cloudflare) acesso automatizado à API dele.
- Os preços do market não são buscados automaticamente: a Ankama não tem API pública do HDV.

## Próximos passos

- Salvar vários sets.

## Deploy (Cloudflare Pages + GitLab)

O site é publicado no Cloudflare Pages, conectado ao repositório no GitLab: cada push na branch `main` gera um deploy novo.

Configuração do projeto no Cloudflare Pages:

| Campo | Valor |
|---|---|
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | definido em `.nvmrc` (20) |

Em produção, as chamadas para `/dofusdb/*` são atendidas pela Pages Function em `functions/dofusdb/[[path]].js` (no desenvolvimento, pelo proxy do Vite). Ela só repassa `items` e `recipes`, com cache de 1 hora. Os preços e sets salvos ficam no navegador de cada usuário (localStorage).
