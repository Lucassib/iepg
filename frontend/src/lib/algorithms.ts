import type { PageEntry } from './search'

/** The algorithms of the thesis, as search entries that open their section of the page Algorithms. */
export const ALGORITHM_ENTRIES: PageEntry[] = [
  ['diagonalize', 'Diagonalize'],
  ['phi', 'φ (phi)'],
  ['strong-realization', 'StrongRealization'],
  ['rooted-seed-realization', 'RootedSeedRealization'],
  ['tower-chain', 'TowerChain'],
  ['fold-to-seed', 'FoldToSeed'],
  ['realize-tree', 'RealizeTree'],
].map(([id, label]) => ({ to: `/algorithms#${id}`, label, tip: 'An algorithm of the thesis: its pseudocode and the Python code that runs it on this site.' }))
