# Design System — Personal Console

## Tokens base (`src/styles/app.css`)
- **Color**: `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--border`, `--primary`, `--primary-contrast`, `--danger|warning|success|info` + `*-bg`.
- **Tipografía**: `--font-sans`, `--fs-1..--fs-5`, `--lh`, `--fw-regular|medium|semibold`.
- **Radio**: `--r-1..--r-4`.
- **Sombra**: `--shadow-1..--shadow-3`.
- **Spacing**: `--s-1..--s-6`.
- **Motion**: `--t-fast`, `--t-med`, `--ease`.

## Primitivas UI
- **Botones**: `.btn`, variantes `.btn--primary|secondary|ghost|danger`, tamaños `.btn--sm`.
- **Icon buttons**: `.icon-btn` (44x44 mínimo).
- **Inputs**: estilos consistentes para `input/select/textarea` con focus ring visible.
- **Badges/Pills**: `.badge`, variantes de estado/riesgo (`.badge--status-*`, `.badge--risk-*`).
- **Cards**: `.card` para contenedores de superficie.
- **Callout**: `.help-hint` para guías contextuales.

## Reglas de uso
1. No agregar colores hardcodeados en componentes; usar tokens.
2. Toda acción debe usar `.btn` o `.icon-btn`.
3. Nuevos paneles deben partir de `.card`.
4. Spacing en múltiplos de `--s-*`.
5. Mantener contraste y `focus-visible` en todos los controles.
