import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The named sizes from the type scale (tailwind.config.ts fontSize, DESIGN.md
 * section 4). tailwind-merge does not read the Tailwind config, so without this
 * list it takes `text-label` for a colour and drops it beside `text-subtle`.
 */
export const TYPE_SCALE_TOKENS = ["display", "h1", "h2", "h3", "h4", "lead", "body", "ui", "label", "code"] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_SCALE_TOKENS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
