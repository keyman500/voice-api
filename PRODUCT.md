# Product

## Register

product

## Users

Voice agent builders who operate in two modes:

- **Technical builders** — programmers debugging agents, transcripts, and post-call pipelines
- **No-code builders** — operators assembling voice agents with tools like n8n who need outcomes without reading raw payloads

They open call detail to understand what happened on a call, whether it succeeded, and what to fix next.

## Product Purpose

Voice API is a self-hostable voice AI platform with a typed REST API and a developer dashboard. Success means operators can inspect calls, transcripts, and analysis in a control-room UI that stays readable for both engineers and no-code builders — without being locked into a proprietary vendor.

## Brand Personality

Premium, modern, cutting-edge — expressed as an **operator console**: Bricolage Grotesque headings, IBM Plex Mono for eyebrows and IDs, teal signal accents on zinc neutrals, frosted panels with soft depth. Calm confidence over flash.

## Anti-references

- Generic purple SaaS dashboards
- Raw JSON as the primary operator UI
- Hero-metric card grids and decorative glassmorphism
- Inventing a new palette or type stack beside the existing dashboard language

## Design Principles

1. **Match the control-room vocabulary** — reuse frosted panels, inset blocks, `KeyValue`, and `StatusBadge` patterns already on the page.
2. **Human-readable fields over JSON** — surface summary, outcome, sentiment, and lists first; keep raw payloads as fallback, not the default.
3. **Teal for signal, not decoration** — accent status, selection, and conversational cues; keep surfaces restrained.
4. **Readable for no-code, useful for engineers** — prose and badges for operators; IDs and optional structured extras for debuggers.
5. **State before decoration** — pending, processing, ready, and failed must be obvious; motion only when it conveys state.

## Accessibility & Inclusion

- Target WCAG AA contrast for body and UI text
- Respect `prefers-reduced-motion`
- Convey status with text and badges, not color alone
