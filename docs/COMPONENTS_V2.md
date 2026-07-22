# Discord Components V2 Raw REST API Specification

This project uses raw Discord REST API v10 via `fetch` (Cloudflare Workers). We DO NOT use monolithic builder libraries (like `discord.js` or `discord.py`). All payloads MUST be raw JSON objects adhering strictly to the Discord Components V2 specification below.

## 1. Core Layout Rules

- **Single Button Beside Header/Text**: Use a `Section` (`type: 9`) with an `accessory` `Button` (`type: 2`). This places the button directly on the right side of the header/text on the same line!
- **Multiple Buttons under Text**: Use a `TextDisplay` (`type: 10`) followed by an `ActionRow` (`type: 1`) containing up to 5 buttons. `Section` accessory accepts ONLY 1 single component (Button or Thumbnail), multiple buttons cannot be placed in a Section accessory.
- **Card Embed Frame (Container)**: Wrap all inner sections and components inside a `Container` (`type: 17`) with `accent_color` (e.g. `0xF0A020`, `0x3498DB`, `0x57F287`, `0xED4245`).
- **Separator Placement Rule**: Put `{ type: 14, divider: true, spacing: 1 }` between logical blocks. NEVER put `Separator` inside a `Section`'s `components` array (Section accepts ONLY `TextDisplay`). Put `Separator` directly at the top level of `Container`'s `components` list.

## 2. Core Rules & Constraints

- **Message Flag**: Every API request creating or editing a V2 message MUST include `"flags": 32768` (`1 << 15` or `IS_COMPONENTS_V2`).
- **Forbidden Root Fields**: `content`, `embeds`, `polls`, or `stickers` MUST NOT be sent at the root level of the message payload.
- **Text Representation**: All text formatting, headers (`##`), lists, badges (``` `badge` ```), and markdown MUST be enclosed inside `TextDisplay` (`type: 10`) components.
- **Limits**: Maximum 40 components per message. Once `flags: 32768` is set, it cannot be removed during edits.

## 3. Component Numeric Types Reference Table

| Type ID | Component Name | Usage & Specifications |
| :--- | :--- | :--- |
| `1` | **Action Row** | Layout container holding up to 5 buttons or 1 select menu |
| `2` | **Button** | Interactive button component (`style`: 1-6, `label`, `custom_id`, `emoji`) |
| `9` | **Section** | Combines 1-3 `TextDisplay` components with a single `accessory` (Button or Thumbnail) on the right |
| `10` | **Text Display** | Markdown text component (`content` string containing header/list/badges) |
| `11` | **Thumbnail** | Image thumbnail element (accessory inside Section) |
| `12` | **Media Gallery** | Grid layout for images and media (1-10 items) |
| `13` | **File** | Downloadable attachment display (requires `attachment://` protocol) |
| `14` | **Separator** | Visual horizontal divider line (`divider?: boolean`, `spacing?: 1 \| 2`) at top level of Container |
| `17` | **Container** | Colored card container grouping components inside an embed frame (`accent_color`: `0x000000` - `0xFFFFFF`) |

## 4. TypeScript Interface Definitions

```typescript
export interface DiscordComponentV2Base {
  type: number;
  id?: number;
}

export interface TextDisplay extends DiscordComponentV2Base {
  type: 10;
  content: string; // Markdown supported
}

export interface Separator extends DiscordComponentV2Base {
  type: 14;
  divider?: boolean; // Default true
  spacing?: 1 | 2;   // 1: small, 2: large
}

export interface Button extends DiscordComponentV2Base {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5 | 6; // 1:Primary, 2:Secondary, 3:Success, 4:Danger, 5:Link, 6:Premium
  label?: string;
  custom_id?: string; // Required unless style is Link/Premium
  url?: string;        // Required for style: 5 (Link)
  emoji?: { name: string; id?: string };
  disabled?: boolean;
}

export interface ActionRow extends DiscordComponentV2Base {
  type: 1;
  components: Button[]; // Or single select menu
}

export interface Section extends DiscordComponentV2Base {
  type: 9;
  components: TextDisplay[]; // Max 1 to 3 TextDisplay items only
  accessory?: Button;        // Single Button or Thumbnail on the right
}

export interface Container extends DiscordComponentV2Base {
  type: 17;
  accent_color?: number; // Integer color (e.g. 0x3498DB or 3447003)
  spoiler?: boolean;
  components: (TextDisplay | Separator | Section | ActionRow | MediaGallery)[];
}
```

## 5. Complete Standard Container JSON Payload Example

```json
{
  "flags": 32768,
  "components": [
    {
      "type": 17,
      "accent_color": 15769632,
      "components": [
        { "type": 10, "content": "## Order #279 - `0%`" },
        { "type": 10, "content": "👤 **Opened by:**\n• @Sorena (`SBR`)" },
        { "type": 14, "divider": true, "spacing": 1 },
        {
          "type": 9,
          "components": [
            { "type": 10, "content": "📍 **Location & Stockpile:**\n• Location: Scarlethold\n• Stockpile name: `Public`" }
          ],
          "accessory": {
            "type": 2,
            "style": 2,
            "custom_id": "update_destination",
            "label": "Update destination"
          }
        },
        { "type": 14, "divider": true, "spacing": 1 },
        {
          "type": 9,
          "components": [
            { "type": 10, "content": "🌐 **Status:**\n• New 🟠" }
          ],
          "accessory": {
            "type": 2,
            "style": 2,
            "custom_id": "update_priority",
            "label": "Update priority"
          }
        },
        { "type": 14, "divider": true, "spacing": 1 },
        { "type": 10, "content": "📋 **Current list (delivered/requested):**\n1. `0/30` crates 🔫 *68mm*" },
        {
          "type": 1,
          "components": [
            { "type": 2, "style": 2, "custom_id": "update_list", "label": "Update list" },
            { "type": 2, "style": 2, "custom_id": "partial_delivery", "label": "Partial delivery" }
          ]
        },
        { "type": 14, "divider": true, "spacing": 1 },
        { "type": 10, "content": "⚙️ **I'm working on it!**\n*List is empty*" },
        {
          "type": 1,
          "components": [
            { "type": 2, "style": 2, "custom_id": "working_on_it", "label": "I'm working on it!" }
          ]
        },
        { "type": 14, "divider": true, "spacing": 1 },
        {
          "type": 1,
          "components": [
            { "type": 2, "style": 3, "custom_id": "delivered", "label": "Delivered" },
            { "type": 2, "style": 2, "custom_id": "on_delivery", "label": "On delivery" },
            { "type": 2, "style": 4, "custom_id": "cancel_order", "label": "Cancel" },
            { "type": 2, "style": 2, "custom_id": "settings", "label": "Settings" }
          ]
        }
      ]
    }
  ]
}
```
