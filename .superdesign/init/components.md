# Shared UI primitives — hosted SPA

Single file: `site/index.html`. No React components. CSS classes are the primitives.

## Button `.accent`

Gold pill primary. Background `#f6c453`, text `#1a1206`, font-weight 600, radius 999px, padding 0.55rem 1rem. Hover glow `--glow-gold`.

## Button `.ghost`

Transparent, muted text, 1px `--line-strong` border, same pill radius.

## Card `.card`

Background `--raised`, border `--line`, radius 14px, padding 1rem 1.1rem.

## Pill `.pill` / `.on` / `.off`

Tiny status chip. `.on` accent border/text. `.off` danger.

## Field `.field`

Label 0.75rem muted. Input/select: bg black, border `--line`, radius 8px.

## Banner `.banner`

Gold-tinted raised panel, radius 12px.

## Agent box `.agent-box`

Roster row: raised, radius 14px, selected accent border. Includes `.sun` spinner.

## Bubble `.bubble`

Black fill, 12px radius, uppercase muted header.

## User row `.user-row`

Full-width list button, selected accent border.
