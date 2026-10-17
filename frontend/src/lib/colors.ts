/**
 * Colors of the copies in a composition (lateral / interior copy, the copies of a tower level, the bags of a
 * threshold graph). Only the two neutral accent tokens --copy-a and --copy-b and mixtures of them with the text and
 * background colors: never the root red, never a status color.
 */
const PALETTE = [
  'var(--copy-a)',
  'var(--copy-b)',
  'color-mix(in srgb, var(--copy-a) 55%, var(--text))',
  'color-mix(in srgb, var(--copy-b) 55%, var(--bg))',
  'color-mix(in srgb, var(--copy-a) 50%, var(--bg))',
  'color-mix(in srgb, var(--copy-b) 60%, var(--text))',
]

export const COPY_A = PALETTE[0]
export const COPY_B = PALETTE[1]

/** The i-th copy color (cycles through six shades). */
export function copyColor(i: number): string {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]
}

/** A light fill for a vertex disc or a box drawn in color c. */
export function tint(c: string, percent = 22): string {
  return `color-mix(in srgb, ${c} ${percent}%, var(--bg))`
}
