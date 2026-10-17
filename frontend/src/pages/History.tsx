import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBibliography, useSeeds } from '../api/hooks'
import { SeedMatrix } from '../components/SeedGrid'
import { ProportionBars } from '../components/ProportionBars'
import { Tex } from '../components/Tex'
import { SCALE_GRID, TreeView } from '../components/TreeView'
import { Button } from '../components/ui/button'
import { STATUS_TEXT } from '../components/ui/badge'
import { Tooltip } from '../components/ui/tooltip'
import { Term } from '../components/ThesisTips'
import { COLUMNS, STEPS, knownAt, type SeedState } from '../lib/history'
import { cn } from '../lib/cn'
import type { SeedSummary } from '../api/types'

const SEED_STYLE: Record<SeedState, { border: string; text: string; label: string }> = {
  unknown: { border: 'var(--border)', text: 'var(--muted)', label: 'unknown' },
  claimed: { border: 'var(--state-diminimal)', text: 'var(--state-diminimal)', label: 'claimed' },
  diminimal: { border: 'var(--state-diminimal)', text: 'var(--state-diminimal)', label: 'diminimal' },
  defective: { border: 'var(--state-defective)', text: 'var(--state-defective)', label: 'defective' },
}

export function HistoryPage() {
  const [search, setSearch] = useSearchParams()
  const raw = Number(search.get('step'))
  const step = Number.isInteger(raw) && raw >= 1 && raw <= STEPS.length ? raw - 1 : 0
  const go = (i: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, i))
    setSearch({ step: String(k + 1) }, { replace: true })
  }
  const [playing, setPlaying] = useState(false)
  // opened by the tour of the site (?tour=1): the whole story plays in about thirty seconds
  const [fast, setFast] = useState(() => search.get('tour') === '1')
  useEffect(() => {
    if (search.get('tour') === '1') setFast(true)
  }, [search])
  const s = STEPS[step]
  // whether the text of the card runs below its visible part
  const bodyRef = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const measureMore = () => {
    const el = bodyRef.current
    setMore(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = 0
    measureMore()
    const ro = new ResizeObserver(measureMore)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [step])
  const now = useMemo(() => knownAt(step), [step])
  const before = useMemo(() => (step > 0 ? knownAt(step - 1) : null), [step])
  const seeds6 = useSeeds(6)
  const bib = useBibliography(s.cite)
  const seeds7 = useSeeds(7)
  // a seed of diameter 7 picked in the matrix, shown beside it without leaving the page
  const [picked, setPicked] = useState<string | null>(null)
  // the seeds of diameter 7 as known after this step: the 21 of the block R_1, …, R_6, and the other 57
  const known7 = useMemo(
    () =>
      (seeds7.data ?? []).map((sd) => {
        const m = /^R(\d+)xR(\d+)$/.exec(sd.name)
        const inBlock = !!m && Number(m[1]) <= 6 && Number(m[2]) <= 6
        const st = inBlock ? now.seeds7.block : now.seeds7.others
        return { ...sd, status: st === 'claimed' ? 'unknown' : st } as typeof sd
      }),
    [seeds7.data, now.seeds7],
  )

  // Play: one discovery every seven seconds, stopping at the last one
  useEffect(() => {
    if (!playing) return
    if (step >= STEPS.length - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => go(step + 1), fast ? 2500 : 7000)
    return () => window.clearTimeout(t)
    // go is recreated with the search params; the step is what matters
  }, [playing, step, fast])

  // ← and → walk through the history
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (e.key === 'ArrowRight') go(step + 1)
      else if (e.key === 'ArrowLeft') go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const changedSeed = (i: number) => !!before && before.seeds[i] !== now.seeds[i]
  const changedPd = (c: string) => !!before && before.pd[c as keyof typeof now.pd] !== now.pd[c as keyof typeof now.pd]
  const changedCount = (c: string) => !!before && before.counts[c as keyof typeof now.counts] !== now.counts[c as keyof typeof now.counts]
  const changedRd = (c: string) => !!before && before.rd[c as keyof typeof now.rd] !== now.rd[c as keyof typeof now.rd]
  const seedsSorted = useMemo(
    () => [...(seeds6.data ?? [])].sort((a, b) => Number(a.name.split('_')[1]) - Number(b.name.split('_')[1])),
    [seeds6.data],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl">History</h1>
        <p className="font-sans text-sm text-muted">
          How the question of which trees attain <Tex tex="q(T)=d(T)+1" /> evolved, one discovery at a time.
        </p>
      </div>

      <div className="rounded-md border border-line bg-surface px-3 py-2" data-tour="history-timeline" data-history-step={step + 1} data-history-total={STEPS.length}>
        <ol className="flex items-start gap-0 overflow-x-auto" aria-label="Timeline">
          {STEPS.map((t, i) => (
            <li key={i} className="relative flex min-w-[3.6rem] flex-1 flex-col items-center">
              <span aria-hidden className={cn('absolute left-0 right-0 top-[0.6rem] h-px', i === 0 ? 'left-1/2' : '', i === STEPS.length - 1 ? 'right-1/2' : '', 'bg-line')} />
              <Tooltip content={`${t.year}: ${t.title} (${t.who})`}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false)
                    go(i)
                  }}
                  aria-current={i === step ? 'step' : undefined}
                  aria-label={`${t.year}: ${t.title}`}
                  className="relative z-10 h-5 w-5 rounded-full border-2 transition-colors"
                  style={{
                    borderColor: t.ours ? 'var(--copy-a)' : i <= step ? 'var(--text)' : 'var(--border)',
                    background: i === step ? (t.ours ? 'var(--copy-a)' : 'var(--text)') : 'var(--bg)',
                  }}
                />
              </Tooltip>
              <span
                className={cn('mt-1 font-mono text-[0.68rem]', i === step && 'font-semibold')}
                style={{ color: t.ours ? 'var(--copy-a)' : i === step ? 'var(--text)' : 'var(--muted)' }}
              >
                {t.year}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,clamp(20rem,24vw,23rem))_minmax(0,1fr)]">
        <article className="flex flex-col rounded-md border border-line bg-surface p-4 lg:sticky lg:top-16 lg:h-[min(calc(100vh-12rem),40rem)]" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-2xl font-semibold" style={{ color: s.ours ? 'var(--copy-a)' : 'var(--text)' }}>
              {s.year}
            </span>
            <span className="font-sans text-xs text-muted">
              {step + 1} of {STEPS.length}
            </span>
          </div>
          <h2 className="mt-1 font-serif text-xl font-semibold leading-snug">{s.title}</h2>
          <p className="mt-1 font-sans text-sm text-muted">
            {s.who}
            {s.ours && <span className="ml-2 whitespace-nowrap rounded border border-[var(--copy-a)] px-1.5 py-0.5 text-xs text-[var(--copy-a)]">our work</span>}
            {s.status && <span className="ml-2 whitespace-nowrap rounded border border-line px-1.5 py-0.5 text-xs">{s.status}</span>}
          </p>
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={bodyRef} onScroll={measureMore} className="min-h-0 overflow-y-auto">
          <div className="prose mt-2 max-w-none space-y-2 text-[0.94rem]">{s.body}</div>
          {(s.cite.length > 0 || s.reference) && (
            <div className="mt-3 space-y-1 border-t border-line pt-2 font-sans text-xs text-muted">
              {s.cite.map((k) => {
                const e = bib.data?.find((x) => x.key === k)
                return <p key={k}>{e ? e.formatted : k}</p>
              })}
              {s.reference && <p>{s.reference}</p>}
            </div>
          )}
          </div>
          {more && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-[var(--surface)] to-transparent">
              <span className="rounded bg-surface px-1.5 font-sans text-[0.7rem] text-muted">scroll for more ↓</span>
            </div>
          )}
          </div>
          <div className="sticky bottom-0 -mx-4 mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-2 lg:static lg:mx-0 lg:px-0 lg:pb-0 lg:pt-3">
            <Button size="sm" variant="outline" onClick={() => go(step - 1)} disabled={step === 0}>
              Back
            </Button>
            <Button
              size="sm"
              variant={playing ? 'default' : 'outline'}
              aria-pressed={playing}
              data-tour="history-play"
              className="min-w-[4.75rem]"
              onClick={() => {
                if (!playing && step === STEPS.length - 1) go(0)
                setPlaying((p) => !p)
              }}
            >
              {playing ? 'Pause' : step === STEPS.length - 1 ? 'Replay' : 'Play'}
            </Button>
            <Button size="sm" onClick={() => go(step + 1)} disabled={step === STEPS.length - 1}>
              Next
            </Button>
            <span className="font-sans text-[0.7rem] text-muted">arrow keys move · our works in blue</span>
          </div>
        </article>

        <section data-section="history-known" className="min-w-0 space-y-3 rounded-md border border-line bg-surface p-4" aria-label="What was known">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold">What was known</h2>
            <p className="font-sans text-xs text-muted">
              For every tree, <Tex tex="q(T)\geq d(T)+1" />. A ring marks what changed in this step.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse font-sans text-sm">
              <thead>
                <tr>
                  <th className="w-10 py-0.5 text-left text-xs font-normal text-muted" />
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="py-0.5 text-center text-xs font-semibold text-muted">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <th className="whitespace-nowrap py-0.5 pr-2 text-left font-sans text-xs font-normal text-muted">
                    <Tex tex="s_d" className="text-ink" />
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-0.5 text-center">
                      <Cell value={now.counts[c.key] ?? '?'} changed={changedCount(c.key)} />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-line">
                  <th className="whitespace-nowrap py-0.5 pr-2 text-left font-sans text-xs font-normal text-muted">
                    <Tex tex="r_d" className="text-ink" />
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-0.5 text-center">
                      <Cell value={now.rd[c.key]} changed={changedRd(c.key)} />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-line">
                  <th className="whitespace-nowrap py-0.5 pr-2 text-left font-sans text-xs font-normal text-muted">
                    <Tex tex="p_d" className="text-ink" />
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-0.5 text-center">
                      <Cell value={now.pd[c.key]} changed={changedPd(c.key)} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-1 font-sans text-xs text-muted">
              <Tex tex="s_d" /> is the number of <Term k="seed">seeds</Term> of diameter <Tex tex="d" />, <Tex tex="r_d" /> the number of{' '}
              <Term k="diminimal seed">diminimal seeds</Term>, and <Tex tex="p_d=r_d/s_d" /> their proportion.
            </p>
          </div>
          <div className={cn('grid items-start gap-4', now.grid === 'd7' ? 'xl:grid-cols-[22rem_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]')}>
          <div className="min-w-0">
          {now.grid === 'd7' ? (
            <div>
              <h3 className="font-serif text-base font-semibold">
                The 78 seeds <Tex tex="R_i\odot R_j" /> of diameter 7
              </h3>
              <p className="mb-1 font-sans text-xs text-muted">
                The rooted seed <Tex tex="R_i" /> comes from the seed <Tex tex="S_6^{(i)}" /> of diameter 6, so the six diminimal seeds of diameter 6 give{' '}
                <Tex tex="R_1,\ldots,R_6" />.
              </p>
              {seeds7.data && (
                <SeedMatrix
                  seeds={known7}
                  cell={20}
                  selected={picked}
                  onSelect={(name) => setPicked((p) => (p === name ? null : name))}
                  hint="Click a cell to see the seed."
                />
              )}
            </div>
          ) : (
            <div>
              <h3 className="mb-1 font-serif text-base font-semibold">The twelve seeds of diameter 6</h3>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {seedsSorted.map((sd, k) => {
                  const i = k + 1
                  const st = now.seeds[i]
                  const style = SEED_STYLE[st]
                  return (
                    <div
                      key={sd.name}
                      className={cn('rounded-md border-2 bg-paper p-1 transition-colors duration-500', changedSeed(i) && 'ring-2 ring-[var(--note)] ring-offset-1')}
                      style={{ borderColor: style.border, borderStyle: st === 'claimed' ? 'dashed' : 'solid' }}
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <Tex tex={sd.label} className="font-serif text-xs" />
                        <span className="font-sans text-[0.62rem]" style={{ color: style.text }}>
                          {style.label}
                        </span>
                      </div>
                      <TreeView tree={sd.tree} scale={SCALE_GRID * 0.55} alt={`${sd.name}, ${st === 'claimed' ? 'claimed diminimal' : style.label}`} />
                    </div>
                  )
                })}
              </div>
              <p className="mt-1 font-sans text-xs text-muted">Dashed: claimed diminimal, not proved.</p>
            </div>
          )}
          </div>
          <div className="min-w-0 space-y-3">
            <ProportionBars pd={now.pd} changed={(c) => changedPd(c)} />
            {now.grid === 'd7' && <PickedSeed seed={known7.find((sd) => sd.name === picked) ?? null} onClose={() => setPicked(null)} />}
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/** The seed picked in the matrix, with its status as known in the current step. */
function PickedSeed({ seed, onClose }: { seed: SeedSummary | null; onClose: () => void }) {
  if (!seed)
    return (
      <p className="rounded-md border border-dashed border-line p-3 text-center font-sans text-xs text-muted">Click a cell of the matrix to see its seed here.</p>
    )
  const color = `var(--state-${seed.status})`
  return (
    <div className="rounded-md border-2 bg-paper p-2" style={{ borderColor: color }}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Tex tex={seed.label} className="font-serif text-sm" />
        <span className="flex items-center gap-2">
          <span className="font-sans text-xs" style={{ color }}>
            {STATUS_TEXT[seed.status]}
          </span>
          <button type="button" onClick={onClose} aria-label="Close the seed" className="rounded px-1 font-sans text-sm leading-none text-muted hover:text-ink">
            ×
          </button>
        </span>
      </div>
      <TreeView tree={seed.tree} scale={SCALE_GRID * 0.75} alt={`${seed.name}, ${STATUS_TEXT[seed.status]}`} />
      <p className="px-0.5 font-sans text-[0.7rem] text-muted">
        n = {seed.tree.n} ·{' '}
        <a href={`/trees/d7?seed=${encodeURIComponent(seed.name)}`} target="_blank" rel="noopener" className="underline decoration-dotted underline-offset-2 hover:text-ink">
          its page, in a new tab ↗
        </a>
      </p>
    </div>
  )
}

function Cell({ value, changed }: { value: string; changed: boolean }) {
  return (
    <span
      className={cn(
        'inline-block min-w-[3rem] whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-xs transition-colors duration-500',
        value === '?' || value === '' ? 'text-muted' : 'text-ink',
        changed && 'bg-[var(--note)]/15 ring-2 ring-[var(--note)]',
      )}
    >
      {value}
    </span>
  )
}
