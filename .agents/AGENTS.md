# Custom Rules for Veli Logistics Tracker

## Text and Communication Style
- DO NOT use any emojis in responses, implementation plans, walkthroughs, or explanations. Keep all text completely emoji-free and professional.
- Keep all explanations, summaries, and descriptions extremely concise, direct, and token-friendly. Avoid pleasantries, fluff, and unnecessary details.

## Tool and Workflow Constraints
- Avoid unnecessary planning loops for minor modifications or simple, direct changes. Keep the workflow fast, lightweight, and efficient.
- DO NOT run any production packaging builds (e.g., Tauri build, exe packaging) or git push operations unless the user explicitly requests them. Only run validation compilations (like tsc or vite build) when necessary to check for compile correctness.

## Discord Components V2 Raw REST API Architecture Rule
- ALWAYS refer to `docs/COMPONENTS_V2.md` and `discord-components-v2` skill guidelines for all Discord interaction, message, and modal development.
- NEVER use legacy embeds (`embeds`) or top-level text `content` for Discord messages.
- ALWAYS use `flags: 32768` (`1 << 15` or `IS_COMPONENTS_V2`), `Container (type: 17)`, `TextDisplay (type: 10)`, `Section (type: 9)` (with max 1-3 TextDisplay children), `Separator (type: 14)`, `ActionRow (type: 1)`, `Label (type: 18)` for modals, and exact numeric component IDs.
- DO NOT use monolithic builder library syntax (e.g. `ContainerBuilder`, `TextDisplayBuilder`), construct raw JSON payloads for Discord REST API v10 via `fetch`.
