# Campus Desk Design System

## Design read

An independent student productivity workspace for classmates. The interface should feel calm, practical, slightly editorial, and recognisably made for school life rather than imitating a corporate SaaS dashboard.

Design dials: **variance 6/10**, **motion 2/10**, **density 4/10**. Keep the existing forest, cream, and lime identity. Prioritise clarity and usefulness; let the overview page have personality while keeping planner forms and tools straightforward.

## Design tokens

### Dark mode, the default
- Page background: `#151B16`
- Surface: `#202820`
- Subtle surface: `#29392B`
- Primary text: `#E7EADF`
- Muted text: `#A2AA9B`
- Borders: `#3A4537`
- Accent: `#C6E47C`

### Light mode
- Page background: `#F3F0E7`
- Surface: `#FBFAF5`
- Primary text: `#202921`
- Muted text: `#73796E`
- Borders: `#DEDED2`
- Accent: `#C6E47C`

These are the product's own tokens. Do not pull in an unrelated brand's complete palette or use color as the only indicator of state.

## Typography

Use the existing system sans-serif stack for instructions, forms, metadata, and most interface text. Reserve the restrained serif treatment for high-level editorial headings and selected overview labels. Keep body copy readable, use balanced heading wraps, and use tabular numerals for timers and result values.

## Layout and components

- Keep a clear single-column reading order within pages.
- Use responsive CSS Grid with `minmax(0, 1fr)` and content-driven columns instead of viewport-specific fixed widths.
- The overview hero may use an offset two-part composition on larger screens, then becomes one column on phones.
- Tool cards should be independent work surfaces, not nested cards. Inputs must shrink to the card width; the timer should scale smoothly.
- Keep the task list, primary navigation, theme controls, and creator credits visually consistent.
- Keep the six mobile destinations in one bottom-navigation row, with safe-area padding and labels that remain legible at narrow widths.

## Interaction

- Primary action: lime accent with dark text.
- Secondary action: theme-aware surface with a visible border.
- Hover and focus states should be more distinct than the resting state.
- Every icon-only action needs an accessible name.
- Navigation communicates the current page with `aria-current="page"`.
- Destructive actions retain confirmation.
- Respect `prefers-reduced-motion`; never make essential information depend on animation.

## Accessibility and responsive behavior

- Include a keyboard skip link to the main content.
- Use semantic landmarks, valid nesting, visible focus, labels, and inline live feedback.
- Keep dark and light surfaces, native controls, and the browser theme-color in sync.
- Avoid horizontal page overflow. Test at the 375px mobile viewport and the 1280px desktop viewport, then inspect narrow intermediate widths.
- Use the actual available width as the layout input. Never depend on device brand or aspect ratio alone.

## Anti-patterns

Avoid duplicating information to fill space, oversized rounded containers around every section, tiny low-contrast labels, ornamental controls with no behavior, unbounded transitions, and arbitrary color overrides that bypass the theme tokens.

## Review checklist

- [ ] The dashboard summary appears once.
- [ ] Dark and light themes keep text, controls, and surfaces in sync.
- [ ] The six-item mobile navigation fits without causing horizontal page scrolling.
- [ ] Forms and tools remain usable at phone and desktop widths.
- [ ] Keyboard focus and skip navigation are visible.
- [ ] Reduced-motion preferences are respected.
- [ ] Existing planner, resource, timer, countdown, marks, and AI workflows still function.
