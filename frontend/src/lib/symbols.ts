/**
 * The symbols explained by SymbolTip. The meaning comes, in this order of preference, from a sentence of the thesis
 * quoted word for word (`quote`, when neither the glossary nor the notation table has the symbol), from the glossary
 * (`glossary`, the thesis text), from the notation table (`notation`, matched by symbol), or from a short text for the
 * symbols that belong to the cited literature (`text`).
 */
export type SymbolSpec = {
  /** TeX of the symbol, the title of the tooltip */
  tex: string
  /** `symbol` of the row of GET /notation */
  notation?: string
  /** key of GET /glossary */
  glossary?: string
  /** a sentence of the thesis, verbatim; its reference is the `ref` of a glossary entry or the number of a label */
  quote?: { text: string; refFromGlossary?: string; refLabel?: string; refPrefix?: string }
  /** a text that is not a thesis statement (a symbol of the cited literature), with its source */
  text?: string
  source?: string
}

export const SYMBOLS = {
  'q(M)': { tex: 'q(M)', notation: 'q(M)' },
  'q(T)': { tex: 'q(T)', notation: 'q(G)' },
  'q(G)': { tex: 'q(G)', notation: 'q(G)' },
  'DSpec(M)': {
    tex: '\\DSpec(M)',
    quote: { text: 'The set of distinct eigenvalues of $M$ is denoted by $\\DSpec(M)$.', refFromGlossary: 'spectrum' },
  },
  'Spec(M)': { tex: '\\Spec(M)', glossary: 'spectrum' },
  'Z(M)': { tex: '\\mathcal Z(M)', glossary: 'set of temporary zeros' },
  'Δ(M)': { tex: '\\Delta(M)', glossary: 'latent values' },
  'Δ_c(M)': { tex: '\\Delta_c(M)', glossary: 'confined' },
  'c(M)': { tex: '|\\mathcal Z(M)|-|\\Delta_c(M)|', notation: '|\\mathcal Z(M)|-|\\Delta_c(M)|' },
  'd(T)': { tex: 'd(T)', notation: 'd(T)' },
  'd(G)': {
    tex: 'd(G)',
    text: 'The diameter of a connected graph $G$, the largest distance between two of its vertices.',
    source: 'the thesis, Chapter 3',
  },
  λ: { tex: '\\lambda', notation: '\\texttt{Diagonalize}' },
  'γ_L': {
    tex: '\\gamma_L',
    quote: { text: 'The recursion is driven by the quantities $\\gamma_L=\\lambda_1-\\lambda_0$ and $\\gamma_R=\\lambda_{2k}-\\lambda_{2k-1}$.', refLabel: 'sec:bricks' },
  },
  'γ_R': {
    tex: '\\gamma_R',
    quote: { text: 'The recursion is driven by the quantities $\\gamma_L=\\lambda_1-\\lambda_0$ and $\\gamma_R=\\lambda_{2k}-\\lambda_{2k-1}$.', refLabel: 'sec:bricks' },
  },
  'μ₊': { tex: '\\mu_+', glossary: 'lateral' },
  'μ₋': { tex: '\\mu_-', glossary: 'lateral' },
  φ: {
    tex: '(M,v)=\\varphi((M_0,x),(M_1,y),\\lambda)',
    quote: {
      text: "In the remaining case, $M_0\\in\\mathcal{A}_n$ and $M_1\\in\\mathcal{A}_m$ are associated with a tree $T_0$ of order $n$ rooted at $w_x$ and a tree $T_1$ of order $m$ rooted at $w_y$, and the algorithm outputs the root $v=x$ and a matrix $M\\in\\mathcal S(T_0\\odot T_1')$, where $T_1'$ is the $n$-shifted replica of $T_1$. The matrix $M$ is obtained by joining the roots $w_x$ and $w_{n+y}$ by an edge whose weight is computed from two applications of Diagonalize.",
      refLabel: 'sec:bricks',
      refPrefix: 'Algorithm φ, ',
    },
  },
  S_d: { tex: 'S_d', notation: 'S_d' },
  R_i: { tex: 'R_i', notation: 'R_1,\\ldots,R_6' },
  ρ_k: { tex: '\\rho_k', notation: '\\rho_k' },
  s_d: { tex: 's_d', notation: 's_d' },
  p_d: { tex: 'p_d', notation: 'p_d' },
  'C(d)': { tex: 'C(d)', notation: 'C(d)' },
  'd̂_v': { tex: '\\hat d_v', glossary: 'temporary value' },
  d_v: { tex: 'd_v', glossary: 'temporary value' },
} satisfies Record<string, SymbolSpec>

export type SymbolKey = keyof typeof SYMBOLS

/** Symbols of the notation table are compared without spaces. */
export function sameSymbol(a: string, b: string): boolean {
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
}
