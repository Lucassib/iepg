import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import { useAlgorithms, useMeta } from '../api/hooks'
import type { PseudoLine, PythonSource } from '../api/types'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { Tex } from '../components/Tex'
import { ThesisChip } from '../components/ThesisBadges'
import { cn } from '../lib/cn'

hljs.registerLanguage('python', python)

/**
 * The algorithms of the thesis, each with the pseudocode as the thesis writes it, read from its LaTeX sources, next to
 * the Python functions that run it on this site, read from the running code. Neither side is copied by hand.
 */
export function AlgorithmsPage() {
  const q = useAlgorithms()
  const meta = useMeta()
  const location = useLocation()
  const navigate = useNavigate()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // the open tab is the address: /algorithms#tower-chain, so the search, links and the back button lead to it;
  // the computations of the site share one tab, and #latent opens that tab at that computation
  const hash = decodeURIComponent(location.hash.slice(1))
  const tabs = useMemo(() => (q.data ? [...q.data.thesis.map((a) => ({ id: a.id, name: a.name })), { id: OTHER, name: 'Other computations' }] : []), [q.data])
  const siteIds = useMemo(() => new Set(q.data?.site.map((a) => a.id) ?? []), [q.data])
  const current = siteIds.has(hash) ? OTHER : tabs.some((t) => t.id === hash) ? hash : (tabs[0]?.id ?? '')

  useEffect(() => {
    if (siteIds.has(hash)) document.getElementById(hash)?.scrollIntoView({ block: 'start' })
  }, [hash, siteIds])

  const open = (id: string, focus = false) => {
    navigate({ hash: id }, { replace: false })
    if (focus) tabRefs.current[id]?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === current)
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
    if (to === null) return
    e.preventDefault()
    open(tabs[(to + tabs.length) % tabs.length].id, true)
  }

  if (q.isPending) return <Loading />
  if (q.error) return <ErrorNote error={q.error} />
  const { thesis, site, repository, commit } = q.data
  const a = thesis.find((x) => x.id === current)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl">Algorithms</h1>
        <p className="max-w-[60rem] font-sans text-sm text-muted">
          Each algorithm as the thesis{meta.data ? ` of ${meta.data.thesis_version}` : ''} writes it, next to the Python code that runs it on this site, both
          read from their sources, in exact arithmetic.{' '}
          <a href={`${repository}/tree/${commit}`} target="_blank" rel="noopener" className="underline decoration-line underline-offset-2 hover:decoration-ink">
            Source code{commit !== 'main' ? ` at ${commit.slice(0, 7)}` : ''} ↗
          </a>
        </p>
      </div>

      <div role="tablist" aria-label="Algorithms" onKeyDown={onKey} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => {
          const on = t.id === current
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls="algorithm-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => open(t.id)}
              className={cn(
                '-mb-px shrink-0 whitespace-nowrap rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition-colors',
                t.id === OTHER ? 'font-sans' : 'font-mono',
                on ? 'border-line bg-surface font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.name}
            </button>
          )
        })}
      </div>

      <div id="algorithm-panel" role="tabpanel" aria-labelledby={`tab-${current}`}>
        {a ? (
          <section key={a.id} data-section={`algorithm-${a.id}`} className="space-y-3 rounded-md border border-line bg-surface p-4">
            <Heading name={a.name} where={a.where} about={a.about} lab={a.lab} />
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Panel title="In the thesis" note={a.where ?? undefined}>
                {a.lines.length ? <Pseudocode lines={a.lines} /> : <p className="p-3 font-sans text-sm text-muted">Not found in the thesis that is read.</p>}
              </Panel>
              <PythonTabs srcs={a.python} />
            </div>
          </section>
        ) : (
          <div className="space-y-3">
            <p className="prose max-w-[52rem]">These are not algorithms with a name in the thesis, but each of them computes what a result of the thesis states.</p>
            {site.map((c) => (
              <section key={c.id} id={c.id} className="scroll-mt-20 space-y-3 rounded-md border border-line bg-surface p-4">
                <Heading name={c.name} about={c.about} lab={c.lab} plainName />
                <div className="flex flex-wrap gap-1.5">
                  {c.thesis.map((t) => (
                    <ThesisChip key={t} refText={t} />
                  ))}
                </div>
                {c.python.map((p) => (
                  <PythonPanel key={p.name} src={p} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** The tab that holds the computations of the site that are not named algorithms of the thesis. */
const OTHER = 'other-computations'

/** The height of a code panel: on wide screens the open algorithm fits in the window. */
const FIT = 'max-h-[34rem] xl:max-h-[max(18rem,calc(100vh-26.5rem))]'

function Heading({ name, where, about, lab, plainName }: { name: string; where?: string | null; about: string; lab: { to: string; label: string } | null; plainName?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={cn('text-xl font-semibold', plainName ? 'font-serif' : 'font-mono')}>{name}</h2>
        {where && <ThesisChip refText={where} />}
        {lab && (
          <Link to={lab.to} className="ml-auto font-sans text-sm underline decoration-line underline-offset-2 hover:decoration-ink">
            {lab.label} →
          </Link>
        )}
      </div>
      <p className="prose">
        <WithMath text={about} />
      </p>
    </div>
  )
}

/** Plain text with $…$ for math. */
function WithMath({ text }: { text: string }) {
  return (
    <>
      {text.split(/\$(.*?)\$/).map((piece, i) => (i % 2 ? <Tex key={i} tex={piece} /> : <span key={i}>{piece}</span>))}
    </>
  )
}

function Panel({ title, note, right, children }: { title: React.ReactNode; note?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-line px-3 py-1.5 font-sans text-xs text-muted">
        <span className="font-semibold text-ink">{title}</span>
        {note && <span>{note}</span>}
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  )
}

/** The tabbing block of the thesis: line numbers, indentation, bold keywords and math. */
function Pseudocode({ lines }: { lines: PseudoLine[] }) {
  return (
    <div className={cn('overflow-auto p-3 font-mono text-[0.8rem] leading-relaxed', FIT)}>
      {lines.map((l, i) =>
        l.kind === 'blank' ? (
          <div key={i} className="h-2" />
        ) : (
          <div key={i} className={cn('grid grid-cols-[1.75rem_minmax(0,1fr)]', l.kind === 'head' && 'text-muted', l.kind === 'title' && 'font-semibold')}>
            <span className="select-none pr-2 text-right text-muted">{l.n ?? ''}</span>
            <span style={{ paddingLeft: `${l.indent * 1.25}rem` }}>
              {l.parts.map((p, j) =>
                p.t === 'math' ? (
                  <Tex key={j} tex={p.v} />
                ) : p.t === 'kw' ? (
                  <b key={j}>{p.v}</b>
                ) : p.t === 'pad' ? (
                  <span key={j} className="invisible">
                    {p.v}
                  </span>
                ) : (
                  <span key={j}>{p.v}</span>
                ),
              )}
            </span>
          </div>
        ),
      )}
    </div>
  )
}

/** The Python of an algorithm; when it takes more than one function, a small tab for each, in the header of the panel. */
function PythonTabs({ srcs }: { srcs: PythonSource[] }) {
  const [i, setI] = useState(0)
  if (srcs.length === 1) return <PythonPanel src={srcs[0]} />
  const tabs = (
    <span role="tablist" aria-label="Python functions" className="ml-1 inline-flex gap-1 align-baseline">
      {srcs.map((p, k) => (
        <button
          key={p.name}
          type="button"
          role="tab"
          aria-selected={k === i}
          onClick={() => setI(k)}
          className={cn('rounded border px-1.5 font-mono', k === i ? 'border-ink text-ink' : 'border-line text-muted hover:text-ink')}
        >
          {p.name}
        </button>
      ))}
    </span>
  )
  return <PythonPanel src={srcs[i]} tabs={tabs} />
}

/** A Python function of the running code, with its file, its lines and a link to them on GitHub. */
function PythonPanel({ src, tabs }: { src: PythonSource; tabs?: React.ReactNode }) {
  const html = useMemo(() => hljs.highlight(src.code, { language: 'python' }).value, [src.code])
  const numbers = useMemo(() => Array.from({ length: src.end - src.start + 1 }, (_, i) => String(src.start + i)).join('\n'), [src.start, src.end])
  return (
    <Panel
      title={
        <>
          In this site{tabs}
        </>
      }
      note={`${src.path}, lines ${src.start}–${src.end}`}
      right={
        <a href={src.url} target="_blank" rel="noopener" className="underline decoration-line underline-offset-2 hover:decoration-ink">
          GitHub ↗
        </a>
      }
    >
      <div className={cn('code-python flex overflow-auto font-mono text-[0.75rem] leading-[1.15rem]', FIT)}>
        <pre aria-hidden className="sticky left-0 select-none border-r border-line bg-paper py-3 pl-3 pr-2 text-right text-muted">
          {numbers}
        </pre>
        <pre className="py-3 pl-3 pr-3">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </Panel>
  )
}
