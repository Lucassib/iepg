import type { Matrix, TreeInfo } from '../api/types'
import { isPositiveRational, isValidRational } from '../lib/exact'
import { defaultMatrix, edgeKey, sortedEdges } from '../lib/tree'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Tex } from './Tex'
import { Tooltip } from './ui/tooltip'

/** One input per diagonal entry and one per edge (the square of the off-diagonal entry). */
export function MatrixEditor({ tree, matrix, onChange }: { tree: TreeInfo; matrix: Matrix; onChange: (m: Matrix) => void }) {
  const edges = sortedEdges(tree)
  const setDiag = (v: number, s: string) => onChange({ ...matrix, diag: { ...matrix.diag, [String(v)]: s } })
  const setW2 = (k: string, s: string) => onChange({ ...matrix, w2: { ...matrix.w2, [k]: s } })
  const invalid = [
    ...Object.entries(matrix.diag)
      .filter(([, s]) => !isValidRational(s))
      .map(([v]) => `m_{${v}${v}}`),
    ...Object.entries(matrix.w2)
      .filter(([, s]) => !isPositiveRational(s))
      .map(([k]) => `m^2_{${k.replace('-', ',')}}`),
  ]
  return (
    <div className="space-y-3 font-sans text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Diagonal entries <Tex tex="m_{vv}" /> (rationals)
          </span>
          <Tooltip content="Sets every diagonal entry to 0 and every squared weight to 1 (the adjacency matrix).">
            <Button variant="ghost" size="sm" onClick={() => onChange(defaultMatrix(tree))}>
              Reset (0 and 1)
            </Button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: tree.n }, (_, v) => (
            <label key={v} className="flex items-center gap-1">
              <span className="mono text-xs text-muted">{v}</span>
              <Tooltip
                content={
                  <>
                    The diagonal entry <Tex tex={`m_{${v},${v}}`} /> of vertex {v}, a rational such as −1/2.
                  </>
                }
              >
                <Input
                  aria-label={`diagonal entry of vertex ${v}`}
                  value={matrix.diag[String(v)] ?? '0'}
                  onChange={(e) => setDiag(v, e.target.value)}
                  aria-invalid={!isValidRational(matrix.diag[String(v)] ?? '0')}
                  className="h-7 w-16 px-1.5 font-mono text-xs"
                />
              </Tooltip>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-muted">
          Squares of the off-diagonal entries <Tex tex="m_{uv}^2" /> (positive rationals)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {edges.map(([u, v]) => {
            const k = edgeKey(u, v)
            return (
              <label key={k} className="flex items-center gap-1">
                <span className="mono text-xs text-muted">
                  {u}–{v}
                </span>
                <Tooltip
                  content={
                    <>
                      The square <Tex tex={`m_{${u},${v}}^2`} /> of the entry of the edge {`{${u}, ${v}}`}, a positive rational; the entry is its positive square root.
                    </>
                  }
                >
                  <Input
                    aria-label={`squared weight of edge ${u}-${v}`}
                    value={matrix.w2[k] ?? '1'}
                    onChange={(e) => setW2(k, e.target.value)}
                    aria-invalid={!isPositiveRational(matrix.w2[k] ?? '1')}
                    className="h-7 w-16 px-1.5 font-mono text-xs"
                  />
                </Tooltip>
              </label>
            )
          })}
        </div>
      </div>
      {invalid.length > 0 && (
        <p className="text-xs text-defective" role="status">
          Not a valid entry:{' '}
          {invalid.map((t, i) => (
            <Tex key={i} tex={t + (i < invalid.length - 1 ? ',\\ ' : '')} />
          ))}
          . Use integers or fractions such as −1/2; edge weights must be positive.
        </p>
      )}
    </div>
  )
}

export function matrixIsValid(m: Matrix): boolean {
  return (
    Object.values(m.diag).every(isValidRational) && Object.values(m.w2).every((s) => isValidRational(s) && !s.trim().startsWith('-') && !/^0+(\/\d+)?$/.test(s.trim()))
  )
}
