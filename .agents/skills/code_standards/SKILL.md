---
name: code-standards
description: Project coding guidelines, patterns, and quality requirements for Veli Logistics Tracker.
---

# Code Standards and Development Guidelines

This skill defines the coding standards, patterns, and quality requirements for the Veli Logistics Tracker codebase. Always adhere to these rules when modifying or creating new features.

## 1. React & TypeScript Standards
- **Functional Components:** Always write components as functional components (`React.FC<Props>`).
- **Performance Optimization:** Wrap components in `React.memo` to prevent unnecessary re-renders. Always define `Component.displayName` explicitly.
- **Hook Optimization:** Use `useMemo` for calculations (such as search filtering, sorting, and pagination logic) and `useCallback` for callbacks passed to child components.
- **Explicit Prop Types:** Always define strict TypeScript interfaces/types for component props instead of using `any`.

## 2. Internationalization (i18n)
- **Localize All UI Text:** Do not hardcode user-facing strings in TSX files. Use the `useLanguage` hook and access values via `t('translation_key')`.
- **Localization Files:** When adding new keys, update all supported dictionaries in `src/i18n/` (`tr.ts`, `en.ts`, `de.ts`, `ru.ts`, `ptBR.ts`).
- **Translation Safety:** Use translation key castings (`t('some_key' as TranslationKey)`) where dynamic keys are required.

## 3. Styling & CSS Audit Rules
All CSS files must pass the local audit checklist validated by `audit-css.cjs`. Follow these restrictions:
- **CSS Variables:** Never use hardcoded HEX, RGB, RGBA, HSL, or color names. Always use the predefined CSS variables from `@import './base/_variables.css'`.
- **Performance (Layout Thrashing):** Do not transition or animate layout-affecting properties (e.g., `width`, `height`, `margin`, `padding`, `top`, `bottom`, `left`, `right`, `border`, `font-size`). Use `transform` or `opacity` for transitions/animations.
- **External Resources:** Do not load external resources using `url(...)` in CSS unless they are from Google Fonts.
- **Keylogger Patterns:** Never target value attributes in input selectors (e.g., `input[value*="..."]`).
- **Token Alignment:** Ensure selectors used in CSS files exactly match the class names/IDs declared in your TSX files. Unused selectors will trigger audit failures.

## 4. Database & Synchronization Patterns
- **Supabase as Primary DB:** Use `dbService.ts` for all database interactions. Supabase is the primary, required database backend.
- **Offline Bypass Mode Disabled:** The offline/local storage database bypass mode has been completely disabled and removed. Standard users must authenticate via Supabase.
- **Authentication Mapping:** Users authenticate using virtual emails formatted as `${username.toLowerCase()}@pars-logistics.local` with real-time role/status synchronization.
- **Local Storage Limitations:** Local storage is reserved only for local settings (themes, language selection `foxhole_depot_lang`, and cached session markers), not for the active depot database or supply requests.

## 5. Development Restraints
- Keep all explanations and code extremely concise.
- DO NOT use emojis in code comments, commit messages, or plans.
- Prefer inline checks and verified edits over temporary scratch scripts.
