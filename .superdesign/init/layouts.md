# Layouts — `site/index.html`

## Login / gate

`loginView` — centered `min-height: 100vh` grid. Kicker “Halcyon”, h1, muted line, gold “Open hosted login”.

## App shell (`shell`)

```
header.bar
  left: kicker Halcyon, h1 title, muted subtitle
  right.nav: ghost links Workspace, Insights, Access (admin), Sign out
inner content in .wrap or .wrap.wide
```

Source: `site/index.html` `shell()` ~673–698.

## Workspace desk

`.desk` two columns: `.roster` aside + `.room` (`.bubbles` + `.composer`).

## Access admin-grid

Three columns: People | sandbox cards | New connection / Invite.
