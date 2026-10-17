import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { FoldStep } from '../api/types'
import { TreeView } from './TreeView'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'

/**
 * Plays the fold steps in reverse: from the seed (last step) back to the input tree (steps[0]),
 * one duplicated branch at a time. The branch added at each stage is drawn dashed and ringed.
 */
export function UnfoldingPlayer({ steps }: { steps: FoldStep[] }) {
  const last = steps.length - 1
  // position p: 0 = seed (steps[last]), last = the tree (steps[0])
  const [p, setP] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Autoplay: one duplication every 900 ms. The parent remounts the player (key) when the steps change.
  useEffect(() => {
    if (!playing || p >= last) return
    const t = window.setTimeout(() => {
      const n = Math.min(last, p + 1)
      setP(n)
      if (n >= last) setPlaying(false)
    }, 900)
    return () => window.clearTimeout(t)
  }, [playing, p, last])

  const idx = last - p
  const step = steps[idx]
  const { dashed, added, twin } = useMemo(() => {
    if (p === 0) return { dashed: [] as [number, number][], added: [] as number[], twin: [] as number[] }
    const branch = new Set(step.removed_branch)
    const dashed = step.tree.edges.filter(([u, v]) => branch.has(u) || branch.has(v))
    return { dashed, added: step.removed_branch, twin: step.isomorphic_to }
  }, [p, step])

  const go = (k: number) => setP(Math.max(0, Math.min(last, k)))
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(p + 1)
    else if (e.key === 'ArrowLeft') go(p - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(last)
    else if (e.key === ' ') setPlaying((x) => !x)
    else return
    e.preventDefault()
  }

  if (steps.length === 0) return null

  return (
    <div className="space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-md" tabIndex={0} onKeyDown={onKey} aria-label="Unfolding player. Arrow keys step, space plays.">
      <div className="rounded-md border border-line bg-paper p-2">
        <TreeView tree={step.tree} dashedEdges={dashed} highlight={added} secondary={twin} alt={`Unfolding stage ${p} of ${last}: ${step.tree.canonical}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
        <Tooltip content="Removes the last duplicated branch, one step back toward the seed (←).">
          <Button variant="outline" size="sm" onClick={() => go(p - 1)} disabled={p === 0} aria-label="Previous duplication">
            ◀
          </Button>
        </Tooltip>
        <Tooltip
          content={
            playing
              ? 'Stops the animation (space).'
              : 'Rebuilds the tree from its seed, one diameter-preserving 1-CBD every 0.9 s; the new branch is dashed and ringed, the branch it copies has a dashed ring (space).'
          }
        >
          <Button variant="outline" size="sm" onClick={() => setPlaying((x) => !x)} disabled={last === 0} aria-pressed={playing}>
            {playing ? 'Pause' : p >= last ? 'Replay' : 'Play unfolding'}
          </Button>
        </Tooltip>
        <Tooltip content="Duplicates the next branch, one step toward the tree (→).">
          <Button variant="outline" size="sm" onClick={() => go(p + 1)} disabled={p >= last} aria-label="Next duplication">
            ▶
          </Button>
        </Tooltip>
        <span className="text-muted">
          {p === 0 ? 'seed' : p === last ? 'the tree' : `${p} of ${last} duplications`}
          {p > 0 && ` · branch added at vertex ${step.at_vertex}, isomorphic to the ringed branch`}
        </span>
      </div>
      {last > 0 && (
        <Tooltip content="Drag from the seed (left) to the tree (right), one duplication per position.">
          <input type="range" min={0} max={last} value={p} onChange={(e) => go(Number(e.target.value))} aria-label="Duplication index" />
        </Tooltip>
      )}
    </div>
  )
}
