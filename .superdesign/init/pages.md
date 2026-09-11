# Page dependency trees

All hashes render from `site/index.html` (inline CSS + JS). No component imports.

## #/workspace
Entry: `site/index.html` `renderWorkspace` / `paint`
- `shell()` header + nav
- capacity `.pill`
- optional environment `<select>`
- `.desk` → `.roster` `.agent-box` + add-role form
- `.room` → `.bubbles` `.bubble` + `.composer`

## #/insights
Entry: `renderHome`
- `shell()`
- optional sample `.banner`
- `.kpis` `.card`
- `.charts` SVG + intent mix
- `.insights` `.insight` cards

## #/admin
Entry: `renderAdmin`
- `shell()` title Access
- capacity + default-model pills
- `.admin-grid` People / boxes / forms
