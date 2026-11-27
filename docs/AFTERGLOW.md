# Afterglow

The look of From Birth: warm lilac paper and plum ink by day, deep plum by night, with a peach
"Age up" button at the heart of every life.

## Where it lives

- `css/base.css`: the tokens. Every color in the game is a semantic custom property on `:root`
  (`--paper`, `--card`, `--raised`, `--ink`, `--muted`, `--line`, `--line-soft`, `--accent`,
  `--accent-soft`, `--accent-text`, `--peach`, `--good`, `--warn`, `--bad` and their `-soft` fills).
  Dark values are given twice: under `prefers-color-scheme: dark` (unless the player chose light) and
  under `:root[data-theme="dark"]` (the player chose dark).
- `css/layout.css`: the title screen and the life screen (header, journal, dock, panels).
- `css/components.css`: buttons, navigation rows, meters, journal entries, memory cards, cards and
  rows; an "Afterglow layer" at the end brings the older screen-specific rules into the theme.
- `css/modals.css`: dialogs, scene choices and outcomes.
- `js/theme.js`: Light, Dark or System, kept in `localStorage` under `frombirth.theme`, apart from any
  life. `index.html` applies it before the first paint. Settings → Appearance changes it.
- `js/ui/kit.js`: the From Birth mark, outline icons, `navRow()` and `navGroup()`.
- `js/ui/memories.js`: scrapbook cards for life's big days.

## Type

Fraunces (serif) for headings, names, ages and scenes; Nunito Sans for everything else. Both fall back
to the system fonts the game used before, so it reads the same offline.

## Buttons

| Class | For |
| --- | --- |
| `.btn` | ordinary actions: a soft raised surface |
| `.btn.primary` | the main action of a dialog or card (plum) |
| `.btn.peach` | a major gameplay action (peach), like being born |
| `.btn.danger` | destructive actions, always behind a confirmation |
| `.nav-row` (`navRow()`) | opens another screen: icon, label, chevron |
| `.btn-pair` | opposite choices side by side: Study harder, Slack off |

Disabled buttons fade and turn dashed; any explanation the game gives for why stays beside them.

## Special memories

A memory card is drawn for a milestone the life already records (`player.milestones`, by kind: a
certificate for learning, a ticket for work, a medal for fame, a letter for family, a postcard for
turning points) and for a few journal lines that are firsts in anyone's life (school, a best friend,
graduation, love, a child, an award). At most two a year, and never two of the same picture, so they
stay special. Health milestones are private and never become cards.

## Motion

Stat bars glide to their new values; new journal lines fade up; the age pill glows when a year turns;
panels rise and dialogs settle. Nothing waits on an animation, and `prefers-reduced-motion` turns
them all off.
