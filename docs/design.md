# Design

PM-AVN follows the element61 house style used on the Way of Working and AI Lab sites. The reference screens are on the design canvas (direction 6).

## Tokens

All colours live as CSS variables in `src/app/globals.css` (and `prototype/style.css`). Use the variables, never raw hex in components.

| Role | Light | Use |
|---|---|---|
| Orange | `#F26412` | Step 1, primary buttons, page titles, active navigation |
| Amber | `#D07C00` | Step 2, "in progress", items waiting for review |
| Berry | `#9E1F55` | Step 3, "in review", late dates, risks |
| Plum | `#2D1B4E` | Step 4, "done" |
| Page | `#F8F9FB` | Background |
| Ink / muted | `#1B2133` / `#5B6475` | Text |

Each journey colour has three companions: `-t` for small text (passes 4.5:1 contrast), `-s` a soft fill and `-l` a border. Brand orange and amber are too light for small text on white; use `--orange-t` and `--amber-t` there.

Dark mode redefines the same variables. It follows the system setting until someone uses the moon button, which is remembered per browser.

## Type

- Nunito (headings, numbers in circles) and Nunito Sans (everything else), from Google Fonts.
- Page titles: thin, upper case, orange (`h1`). One per page.
- A bold welcome line and a short paragraph may follow the title.
- Small upper-case labels (`.eyebrow`) only above a section that groups several cards or steps.

## Patterns

- **Top bar:** logo, product name, centred navigation with a soft orange pill for the current page, then the theme button and one orange call to action.
- **Numbered steps:** four circles in the journey colours joined by a line. Use them only for a real sequence (Plan, Meet, Deliver, Report).
- **Cards:** white, 14 px radius, border tinted in the colour of the step they belong to, heading in that colour with its number.
- **Rows:** icon, label, meta text on the right, arrow. The whole row is the link.
- **Tip banner:** orange soft fill with a bulb icon, one sentence and one action.
- **Status colours:** to do grey, in progress amber, in review berry, done plum. Keep these the same on boards, lists and timelines.

## Rules

- Line icons only, no emoji.
- Sentence case everywhere except page titles and eyebrows.
- Do not show a control that does nothing. The language switch (EN, NL, FR) from the reference screens comes back when translations exist.
- The logo in `public/element61-logo.png` is cut from a screenshot. Replace it with the official file when available.
