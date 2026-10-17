/** TeX label of a catalog seed name: S6_3 → S_6^{(3)}, R2xR5 → R_2 \odot R_5, S_9 → S_9, R3 → R_3. */
export function seedLabelTex(name: string | null | undefined): string | null {
  if (!name) return null
  let m = /^S(\d+)_(\d+)$/.exec(name)
  if (m) return `S_{${m[1]}}^{(${m[2]})}`
  m = /^R(\d+)xR(\d+)$/.exec(name)
  if (m) return `R_{${m[1]}}\\odot R_{${m[2]}}`
  m = /^S_(\d+)$/.exec(name)
  if (m) return `S_{${m[1]}}`
  m = /^R(\d+)$/.exec(name)
  if (m) return `R_{${m[1]}}`
  return null
}
