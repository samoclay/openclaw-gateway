# Halcyon portal + Host

## Product
Isolated private AI for SMBs. Hosted portal: Workspace (crew chat), Insights (usage, not prompts), Access (grant sandboxes, live hosts). Halcyon Host is a developer installer (Mac/Windows): hostname, Halcyon ID, Ollama/Gateway start-stop. Clients chat in the portal, not the Host app.

## Pages
- Login, Workspace desk, Insights KPIs, Access (people + sandboxes + live hosts)
- Host: identity (hostname + hostId), status grid, grouped actions

## Brand
Black `#000`, gold `#f6c453`, cream text `#f5f2ea`, muted `#b5afa1`, raised `#0b0b0e`. System sans. Light gold radial wash. Pill buttons. No serif, no purple/neon, no generic SaaS blue. Wordmark text “Halcyon” (no invented logo mark). Do not name models, GPUs, or cloud internals on portal screens.

## Motion
Subtle gold glow on primary hover. Workspace sun/saturn spinner when an agent is running.

## Constraints
Static `site/index.html` (no bundler). Native Host stays SwiftUI / WinUI. Isolation: no other customer’s data. Capacity: N live hosts listed as hostname + hostId.
