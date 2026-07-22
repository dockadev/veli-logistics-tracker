---
name: discord-components-v2
description: Strict guidelines, numeric IDs, TypeScript interfaces, and raw REST API JSON payload standards for Discord Components V2.
---

# Discord Components V2 Architecture & Implementation Guidelines

Always consult `docs/COMPONENTS_V2.md` when building, updating, or managing Discord interactive messages, embeds, or modals. 
This project connects directly to Discord REST API v10 via `fetch` (Cloudflare Workers). DO NOT use builder classes (like `ContainerBuilder` or `TextDisplayBuilder`). Construct raw JSON objects adhering strictly to the Discord Components V2 specification.

## 1. Core Rules & Constraints

- **Message Flag**: Every API request creating or editing a V2 message MUST include `"flags": 32768` (`1 << 15` or `IS_COMPONENTS_V2`).
- **Forbidden Root Fields**: `content`, `embeds`, `polls`, or `stickers` MUST NOT be sent at the root level of the message payload.
- **Embed Card Box Frame**: Wrap inner elements in a `Container` (`type: 17`) with `accent_color` to render the colored card embed box frame.
- **Text Representation**: All text formatting, headers (`##`), lists, badges (``` `badge` ```), and markdown MUST be enclosed inside `TextDisplay` (`type: 10`) components.
- **Section Constraints**: `Section` (`type: 9`) can ONLY contain 1 to 3 `TextDisplay` (`type: 10`) components as children, and can ONLY take a `Button` (`type: 2`) or `Thumbnail` (`type: 11`) as an `accessory`.
- **Immutability**: Once a message is sent with `flags: 32768`, it cannot be reverted back to a v1 legacy message during edits.

## 2. Component Numeric Types Reference Table

| Type ID | Component Name | Usage & Specifications |
| :--- | :--- | :--- |
| `1` | **Action Row** | Layout container holding up to 5 buttons or 1 select menu |
| `2` | **Button** | Interactive button component (`style`: 1-6, `label`, `custom_id`, `emoji`) |
| `9` | **Section** | Combines 1-3 `TextDisplay` components with an `accessory` (Button or Thumbnail) |
| `10` | **Text Display** | Markdown text component (`content` string containing header/list/badges) |
| `11` | **Thumbnail** | Image thumbnail element (accessory inside Section) |
| `12` | **Media Gallery** | Grid layout for images and media (1-10 items) |
| `13` | **File** | Downloadable attachment display (requires `attachment://` protocol) |
| `14` | **Separator** | Visual horizontal divider line (`divider?: boolean`, `spacing?: 1 \| 2`) |
| `17` | **Container** | Colored card container grouping components inside an embed frame (`accent_color`: `0x000000` - `0xFFFFFF`) |
| `18` | **Label** | Wrapper label component for Modal inputs & select menus |

## 3. TypeScript Interfaces

```typescript
export interface DiscordComponentV2Base {
  type: number;
  id?: number;
}

export interface TextDisplay extends DiscordComponentV2Base {
  type: 10;
  content: string;
}

export interface Separator extends DiscordComponentV2Base {
  type: 14;
  divider?: boolean;
  spacing?: 1 | 2;
}

export interface Button extends DiscordComponentV2Base {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5 | 6;
  label?: string;
  custom_id?: string;
  url?: string;
  emoji?: { name: string; id?: string };
  disabled?: boolean;
}

export interface ActionRow extends DiscordComponentV2Base {
  type: 1;
  components: Button[];
}

export interface Section extends DiscordComponentV2Base {
  type: 9;
  components: TextDisplay[]; // 1-3 TextDisplay items only
  accessory?: Button;        // Button or Thumbnail
}

export interface Container extends DiscordComponentV2Base {
  type: 17;
  accent_color?: number;
  spoiler?: boolean;
  components: (TextDisplay | Separator | Section | ActionRow | MediaGallery)[];
}
```

## 4. Standard Message Payload

```json
{
  "flags": 32768,
  "components": [
    {
      "type": 17,
      "accent_color": 3447003,
      "components": [
        {
          "type": 10,
          "content": "## Header Text"
        },
        {
          "type": 14,
          "divider": true,
          "spacing": 1
        },
        {
          "type": 1,
          "components": [
            {
              "type": 2,
              "style": 3,
              "label": "Confirm",
              "custom_id": "btn_confirm"
            }
          ]
        }
      ]
    }
  ]
}
```
