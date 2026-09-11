## PortalNav
- Source: `site/index.html` function `shell`
- Category: layout
- Description: Top bar — Halcyon kicker, page title, hash nav, sign out
- Extractable props: title (string), sub (string), activeItem (workspace|insights|admin), showAccess (boolean)
- Hardcoded: Halcyon kicker, ghost button styles, gold tokens

## CapacityPill
- Source: `site/index.html` `.pill.on` / `.pill.off`
- Category: basic
- Description: Live capacity status
- Extractable props: connected (boolean), count (number)
- Hardcoded: copy “Capacity connected” / “offline”
