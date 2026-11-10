export const strings = {
  en: {
    loading: "Loading..."
  },
  es: {
    loading: "Cargando..."
  }
} as const;

export type Locale = keyof typeof strings;
export type StringKey = keyof typeof strings["en"];

export function getString(locale: Locale, key: StringKey): string {
  const lang = strings[locale] ? locale : "en";
  return strings[lang][key];
}
