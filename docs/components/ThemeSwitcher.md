# ThemeSwitcher Component

The `ThemeSwitcher` component provides light and dark mode support with optional color themes. It now includes:

- **Keyboard shortcut**: press `Alt + T` to toggle between light and dark modes.
- **Accessible controls**: the toggle button includes ARIA attributes and localized labels.
- **Localization**: strings are sourced from `src/lib/strings.ts` and respect the current locale via `useLocale`.
- **Loading state**: a fallback message is shown until the component mounts to avoid hydration issues.

## Usage

```tsx
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';

export default function Page() {
  return <ThemeSwitcher />;
}
```

Ensure your application is wrapped with `ThemeProvider` (for theme management) and optionally `LocalizationProvider` to change locales.
