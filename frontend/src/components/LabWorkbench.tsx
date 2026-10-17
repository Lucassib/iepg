import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Matrix, TreeInfo, TreeInput as TreeInputBody } from '../api/types'
import { useParse } from '../api/hooks'
import { defaultMatrix } from '../lib/tree'
import { TreeInput } from './TreeInput'
import { TreeView } from './TreeView'
import { MatrixEditor, matrixIsValid } from './MatrixEditor'
import { ErrorNote } from './ErrorNote'
import { Label, Select } from './ui/input'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'

export type LabState = { input: TreeInputBody; tree: TreeInfo; root: number; matrix: Matrix }

/**
 * Shared inputs of the laboratory pages: a tree (parsed by POST /trees/parse), a root and a matrix.
 * `extra` is rendered next to the run button (the λ input of Diagonalize).
 */
export function LabWorkbench({
  state,
  onState,
  onRun,
  runLabel,
  runTip,
  busy = false,
  extra,
  canRun = true,
  initialInput = null,
  mainRootsOnly = false,
}: {
  state: LabState | null
  onState: (s: LabState | null) => void
  onRun: (s: LabState) => void
  runLabel: string
  /** the tooltip of the run button: what it computes */
  runTip?: ReactNode
  busy?: boolean
  extra?: ReactNode
  canRun?: boolean
  /** parsed once on mount (e.g. a seed opened from the catalog) */
  initialInput?: TreeInputBody | null
  /** only the main roots can be chosen: latent values and bricks are defined for a tree rooted at a main root */
  mainRootsOnly?: boolean
}) {
  const parse = useParse()
  const [showInput, setShowInput] = useState(true)
  const started = useRef(false)

  const submitTree = (input: TreeInputBody) => {
    parse.mutate(input, {
      onSuccess: (tree) => {
        onState({ input, tree, root: tree.main_roots[0] ?? 0, matrix: defaultMatrix(tree) })
        setShowInput(false)
      },
    })
  }

  useEffect(() => {
    if (initialInput && !started.current) {
      started.current = true
      submitTree(initialInput)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInput])

  const valid = state !== null && matrixIsValid(state.matrix)

  return (
    <div className="space-y-4">
      {showInput || !state ? (
        <div className="space-y-2">
          <TreeInput onSubmit={submitTree} busy={parse.isPending} compact submitLabel="Use this tree" />
          {parse.error && <ErrorNote error={parse.error} />}
        </div>
      ) : (
        <Tooltip content="Shows the tree input again; a new tree resets the root and the matrix.">
          <Button variant="outline" size="sm" onClick={() => setShowInput(true)}>
            Change the tree
          </Button>
        </Tooltip>
      )}
      {state && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-md border border-line bg-paper p-2">
            <TreeView tree={state.tree} roots={[state.root]} showIds />
            <p className="mt-1 font-sans text-xs text-muted">
              n = {state.tree.n}, d = {state.tree.diameter}. The root is drawn in red; vertex ids are printed beside the vertices.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="lab-root">Root</Label>
                <Tooltip content="The root of the run: Diagonalize processes the vertices bottom-up toward it. Latent values and bricks are defined for a main root.">
                  <Select id="lab-root" value={state.root} onChange={(e) => onState({ ...state, root: Number(e.target.value) })} className="font-mono">
                    {(mainRootsOnly ? state.tree.main_roots : Array.from({ length: state.tree.n }, (_, v) => v)).map((v) => (
                      <option key={v} value={v}>
                        {v}
                        {state.tree.main_roots.includes(v) ? ' (main root)' : ''}
                      </option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              {extra}
              <Tooltip content={runTip}>
                <Button onClick={() => onRun(state)} disabled={busy || !valid || !canRun}>
                  {busy ? 'Running…' : runLabel}
                </Button>
              </Tooltip>
            </div>
            <MatrixEditor tree={state.tree} matrix={state.matrix} onChange={(matrix) => onState({ ...state, matrix })} />
          </div>
        </div>
      )}
    </div>
  )
}
