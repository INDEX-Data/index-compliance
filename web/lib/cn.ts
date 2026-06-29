// Minimal className joiner — filters falsy values. Keeps the UI primitives
// dependency-free (no clsx/tailwind-merge needed for our controlled variants).
export type ClassValue = string | false | null | undefined

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}
