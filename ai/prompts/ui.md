# DalTime — UI Guidance

Visual design system and frontend best-practice rules for the DalTime shift-scheduling web app.

**Design tone:** Minimal, modern, calm, professional. Prioritize clarity, readability, and low cognitive load.

---

## Brand & Color System

### Primary Palette

| Token | Role | HEX | Tailwind Custom Token | Usage |
|-------|------|-----|----------------------|-------|
| **Primary** | Main brand, primary buttons, active nav links | `#1E3A5F` | `bg-primary` / `text-primary` | Primary CTAs, active states, navbar brand. **Not** for large background fills. |
| **Secondary** | Secondary actions, highlights | `#5A7FA5` | `bg-secondary` / `text-secondary` | Secondary buttons, hover accents, selected table rows. **Not** for body text. |
| **Tertiary** | Accent, badges, subtle highlights | `#A8C8E8` | `bg-tertiary` / `text-tertiary` | Info badges, progress indicators, subtle callouts. **Not** for primary actions. |

### Neutral Grayscale

| Token | HEX | Tailwind Equivalent | Usage |
|-------|-----|---------------------|-------|
| `neutral-50` | `#F8F9FA` | `bg-neutral-50` | Page background, card backgrounds |
| `neutral-100` | `#F1F3F5` | `bg-neutral-100` | Alternate table rows, subtle dividers |
| `neutral-200` | `#DEE2E6` | `border-neutral-200` | Borders, input outlines |
| `neutral-300` | `#CED4DA` | `text-neutral-300` | Disabled states, placeholder text |
| `neutral-500` | `#6C757D` | `text-neutral-500` | Secondary text, captions |
| `neutral-700` | `#495057` | `text-neutral-700` | Body text |
| `neutral-900` | `#212529` | `text-neutral-900` | Headings, high-emphasis text |

### Semantic Colors

| Token | HEX | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Success** | `#198754` | `text-green-700` / `bg-green-700` | Confirmed shifts, active status, save confirmations |
| **Warning** | `#FFC107` | `text-yellow-400` / `bg-yellow-400` | Pending approvals, schedule conflicts |
| **Error** | `#DC3545` | `text-red-600` / `bg-red-600` | Validation errors, failed actions, destructive buttons |
| **Info** | `#0DCAF0` | `text-cyan-400` / `bg-cyan-400` | Informational banners, tips |

### Color Rules

- Never use raw HEX values in templates — always use Tailwind utility classes.
- All color pairings must meet **WCAG AA** contrast ratio (4.5:1 for normal text, 3:1 for large text).
- Semantic colors are for status communication only — never use `bg-green-700` as a decorative background.

### Dark Mode Considerations

- Dark mode is not yet implemented. Primary palette was chosen to work on both light and dark backgrounds.
- Test all status badges and semantic colors against dark backgrounds before shipping.

---

## UI Style Guidelines

### Visual Personality

- **Spacing:** Use Tailwind's spacing scale consistently (`p-3`, `mb-4`, `gap-3`). Default content padding is `p-4` on desktop, `p-3` on mobile.
- **Border radius:** Use `rounded-lg` on cards, modals, and inputs. Badges use `rounded-full`.
- **Shadows:** Use `shadow-sm` for cards and dropdowns. Never use `shadow-lg` — keep elevation subtle.
- **Typography:** Use the system font stack (Tailwind default). Headings use `font-semibold`. Body text uses `text-neutral-700`.
- **Layout:** Maximum content width of `1200px` centered. Use Tailwind's flex/grid utilities for page layout (`flex`, `grid`, `gap-*`, `max-w-*`, `mx-auto`, `px-4`).

### Buttons

Always use `<app-button>` from `@common-daltime`. Never write raw `<button class="btn ...">` for action buttons.

```html
<app-button variant="primary" size="lg" [fullWidth]="true" [loading]="saving()" testId="save-btn" (clicked)="save()">
  Save
</app-button>
```

| Variant | Style | When to Use |
|---------|-------|-------------|
| `primary` | Dark filled | Main page action (Create, Save, Submit, Sign In) |
| `secondary` | Outline | Cancel, dismiss, back navigation |
| `danger` | Red filled | Destructive confirms (Delete, Disable) |
| `danger-outline` | Red outline | Destructive in tables/cards, Retry |
| `primary-outline` | Dark outline | Secondary positive actions (Edit) |

| Size | When to Use |
|------|-------------|
| `sm` | Table row actions, compact UI |
| `md` | Modal footers, page actions |
| `lg` | Auth pages (Sign In, Reset Password) |

Other inputs: `loading` (shows spinner + disables), `disabled`, `fullWidth` (`w-full`), `type` (`button` or `submit`), `testId`.

Rules:
- One primary button per view section. If two actions compete, one must be secondary.
- Use `[loading]` instead of manually adding spinners — it handles the spinner and disabled state.
- All buttons require `testId`.
- Exceptions (keep as native `<button>`): `btn-close`, `navbar-toggler`, input-group addons (Show/Hide), and `<a>` tags styled as buttons.

### Cards and Panels

```html
<div class="shadow-sm rounded-lg border-0">
  <div class="p-4">
    <!-- content -->
  </div>
</div>
```

- Use `shadow-sm rounded-lg` for the default card style.
- Card headers use `font-semibold` text — no wrapper element just for styling.
- Group related cards with `flex flex-col gap-3` or the `app-card-list` shared component.

### Forms and Inputs

- Use Tailwind utility classes for form styling — no Bootstrap form classes.
- Labels are always visible — never use placeholder-only inputs.
- Validation messages appear below the input with `text-red-600 text-sm mt-1`.
- Group related fields with `mb-3`. Form sections separated by `mb-4`.
- Use reactive forms or signal-based forms — never `ngModel`.
- All inputs require `data-testid`.

### Tables

- Use the `app-data-table` shared component for all tabular data.
- Style with Tailwind: `hover:bg-neutral-50`, `align-middle`.
- Alternate row striping via `bg-neutral-100`.
- Keep columns to 5-6 max on desktop. Use `app-card-list` on mobile breakpoints for complex data.
- Action columns are right-aligned with `text-right`.

### Status Badges

- Use the `app-status-badge` shared component with a `colorMap` input.
- Style with Tailwind: `rounded-full px-2 py-0.5 text-sm` + semantic background (`bg-green-700`, `bg-yellow-400`, `bg-red-600`, `text-neutral-500`).
- Text inside badges must be short (1-2 words): "Active", "Pending", "Inactive".

### Interactive States

| State | Style |
|-------|-------|
| Hover | Slight opacity or background shift via `hover:opacity-90` / `hover:bg-neutral-50`. |
| Focus | Tailwind's default focus ring (`focus:ring`). Never remove `:focus-visible` styles. |
| Active | `aria-current` or a Tailwind active variant on nav links. Primary color underline or background. |
| Disabled | Reduced opacity (`opacity-60`). Cursor `cursor-not-allowed`. |

---

## Angular Best Practices

These extend the rules in `frontend-rules.md`:

- **Standalone components only** — no NgModules.
- **Signals everywhere** — use `signal()`, `computed()`, `input()`, `output()` for all state and component communication. No `BehaviorSubject` for component state.
- **OnPush change detection** on every component (`ChangeDetectionStrategy.OnPush`).
- **Smart vs presentational separation:**
  - Smart components (pages/containers) live in `features/<role>/`. They inject services, manage state, and handle routing.
  - Presentational components live in `shared/components/`. They receive data via `input()` and emit events via `output()`. No service injection.
- **No business logic in templates** — move conditionals and transformations into `computed()` signals.
- **Services for data access** — HTTP calls and shared state live in `services/`. Components never call `HttpClient` directly.
- **Strict typing** — no `any`. All API responses have corresponding models in `core/models/`.
- **Composition over inheritance** — prefer injecting shared services or composing shared components over extending base classes.
- **Zoneless** — this project runs without Zone.js. Never use `fakeAsync`/`tick` in tests.
- **`trackBy` in all `@for` loops** — required for performance with OnPush.
- **`@defer` for lazy loading** heavy feature components.

---

## Tailwind Best Practices

DalTime uses **Tailwind CSS** for all styling. No Bootstrap. No custom CSS.

### CSS File Inventory

There are exactly two CSS files in this project — do not create any others:

| File | Purpose |
|------|---------|
| `frontend/src/styles.css` | Tailwind directives + `:root` brand color variables only |
| `frontend/src/debug.css` | `.dt-debug` red-border rule for visual troubleshooting |

### Rules

- **Tailwind utility classes only** — use Tailwind for every layout and style need (`flex`, `gap-3`, `p-4`, `text-center`, `rounded-lg`).
- **No inline styles** — always use Tailwind classes.
- **No component CSS** — do not create `.css` files per component or add `<style>` blocks.
- **No `@layer components` or global classes** — the only allowed content in `styles.css` is the Tailwind directives and the `:root` color variable block. Never add component classes, resets, or global rules there.
- **Color tokens live in `tailwind.config.js`** — use the generated Tailwind classes (`bg-dt-primary`, `text-dt-secondary`, `border-dt-neutral-200`, etc.) in templates. The `--dt-*` CSS variables in `styles.css` exist only for contexts where a CSS custom property is required (SVGs, third-party widget theming).
- **Consistent spacing** — use Tailwind's default spacing scale. Don't invent arbitrary values.
- **Responsive design** — use Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`). Mobile-first.
- **Layout** — use `flex`, `grid`, `gap-*`, `max-w-*`, `mx-auto`, `px-4` for page and component layout.
- **Keep class lists readable** — if an element has more than 8-10 utility classes, consider extracting a reusable shared component instead of adding a CSS class.
- **No `!important`** — the only permitted `!important` is inside `debug.css`.

---

## OOP & Code Organization

- **Separation of concerns:** Components handle presentation. Services handle data. Models define shapes. Guards handle access.
- **Reusable and testable:** Every component and service should be unit-testable in isolation with mocked dependencies.
- **Modular features:** Each role (`web-admin`, `org-admin`, `manager`, `employee`) is a self-contained feature folder. Cross-feature code goes in `shared/` or `core/`.
- **Interfaces over classes for models** — models in `core/models/` are interfaces only (no business logic). Parsing helpers and defaults are acceptable.
- **Avoid tight coupling** — feature components should not import from other feature folders. Shared logic goes in `shared/` or `services/`.
- **Small, focused components** — if a component file exceeds ~150 lines, consider extracting a child component.

---

## Shared Component Strategy

Shared components live at: `frontend/src/app/shared/components/`

All shared components are re-exported from `shared/components/index.ts` and available via the `@common-daltime` path alias:

```typescript
import { DataTableComponent, StatusBadgeComponent, type ColumnDef } from '@common-daltime';
```

Always use `@common-daltime` instead of relative paths when importing shared components.

### Rules

1. **Always check for an existing shared component before creating a new one.** Current inventory:
   - `ButtonComponent` — unified button with variant, size, loading, disabled, fullWidth, and testId inputs
   - `LoadingSpinnerComponent` — full-page or inline loading indicator
   - `ErrorAlertComponent` — dismissible error message display
   - `EmptyStateComponent` — placeholder for empty lists/tables (title + description)
   - `PageHeaderComponent` — page title with optional action button
   - `DataTableComponent` — generic typed table with column definitions and trackBy
   - `CardListComponent` — generic typed card grid with custom template
   - `ConfirmationModalComponent` — accessible modal with confirm/cancel, focus trapping, and loading state
   - `StatusBadgeComponent` — colored pill badge driven by a status-to-class color map
   - `SearchBarComponent` — debounced search input with clear button

2. **Shared components must be:**
   - Abstract enough to reuse across features (no role-specific logic)
   - Strict enough to prevent misuse (required inputs, typed generics)
   - Fully accessible (keyboard navigation, ARIA attributes, focus management)

3. **API design:**
   - Use `input()` / `input.required()` for configuration
   - Use `output()` for events
   - Use generics (`<T>`) for data-driven components (see `DataTableComponent`, `CardListComponent`)
   - Use `TemplateRef` inputs for custom rendering (see `CardListComponent.cardTemplate`)

4. **No feature-specific logic** inside shared components. If a component needs role-aware behavior, the parent smart component handles it and passes data down.

5. **Every shared component gets:**
   - Its own folder under `shared/components/`
   - An export in `shared/components/index.ts`
   - `ChangeDetectionStrategy.OnPush`
   - `class="dt-debug"` on the root element (required for visual debug tooling)
   - `data-testid` on interactive elements
   - A unit test file

### Good Candidates for Future Shared Components

| Component | Purpose |
|-----------|---------|
| **FormFieldComponent** | Wraps label + input + validation message for consistent form layout |
| **ToastComponent** | Non-blocking success/error notifications |
| **PaginationComponent** | Page controls for large data sets |
| **AvatarComponent** | User initials or image display |
| **SkeletonLoaderComponent** | Placeholder shimmer while data loads |

---

## Visual Debug Helper

**Every shared component and layout component (navbar, footer) must include `class="dt-debug"` on its root element.** This is a hard requirement — not optional.

The `.dt-debug` class is defined in `frontend/src/debug.css` (the only CSS file in the project). It applies a red border when uncommented.

### How to Use

1. Open `frontend/src/debug.css`
2. The rule is already present — just uncomment the declarations:
   ```css
   .dt-debug {
     border: 3px solid red !important;
     padding: 3px !important;
   }
   ```
3. Every shared component will now have a visible red border, making it easy to verify they are used on every page
4. Comment the declarations back out when done testing

### Components with `.dt-debug`

- ButtonComponent, LoadingSpinner, ErrorAlert, EmptyState, PageHeader
- DataTable, CardList, ConfirmationModal
- StatusBadge, SearchBar
- Navbar, Footer