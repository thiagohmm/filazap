# Correção: botão de filtro "Finalizado" cortado na sidebar de atendimento

## Problema

Na tela de atendimento (`src/app/dashboard/atendimento/page.tsx`), a linha de filtros
(`.filters`) da sidebar exibe 6 botões: Todos, Aguardando, Retorno, Em atendimento,
Aguardando cliente, Finalizado. O último botão "Finalizado" é cortado na borda direita.

**Causa:** em `src/app/globals.css:301`:

```css
.filters { display: flex; gap: 5px; padding: 10px 12px; overflow-x: auto; border-bottom: 1px solid var(--border); scrollbar-width: none; }
```

- A sidebar tem largura entre 240px e 480px (resize handle, `leftWidth` em `page.tsx`).
- A soma dos 6 pills ultrapassa a largura disponível na maioria dos tamanhos.
- `overflow-x: auto` + `scrollbar-width: none` esconde a barra de rolagem, então o
  conteúdo excedente fica inacessível e "Finalizado" aparece cortado sem sinal visual.

## Correção

Arquivo: `src/app/globals.css`, linha 301.

Permitir que os pills quebrem linha em vez de rolar horizontalmente:

```css
.filters { display: flex; flex-wrap: wrap; gap: 5px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
```

- Remover `overflow-x: auto` e `scrollbar-width: none`.
- Adicionar `flex-wrap: wrap` — os filtros que não couberem descem para a segunda linha,
  garantindo que "Finalizado" sempre fique visível em qualquer largura da sidebar.

Nenhuma mudança em `page.tsx` ou em outros seletores é necessária. O layout da sidebar
usa `flex-direction: column` com `overflow: hidden` e a `queue-list` tem `flex: 1`,
então uma linha extra nos filtros apenas reduz a altura da lista, sem quebrar o layout.

## Validação

1. `npm run dev` e abrir `/dashboard/atendimento`.
2. Verificar que os 6 filtros ficam visíveis (possivelmente em 2 linhas) e que o botão
   "Finalizado" não é mais cortado.
3. Arrastar o resize handle da sidebar para 240px e 480px e confirmar que "Finalizado"
   permanece visível.
4. Testar em viewport ≤ 760px (sidebar empilhada, `max-height: 390px`) e confirmar que
   os filtros continuam acessíveis.
5. Verificar visualmente que os contadores e a lista de fila seguem funcionando.

## Observações

- Alternativa descartada: manter rolagem horizontal com scrollbar visível — degradaria
  a usabilidade (mais um gesto para achar o filtro) e foge do padrão compacto do painel.
- Alternativa descartada: reduzir padding/fonte dos pills — frágil e voltaria a quebrar
  em larguras menores (240px).
