import { useMemo, useState, type KeyboardEvent } from 'react'
import type { GalleryItem, TreeFormat, TreeInput as TreeInputBody } from '../api/types'
import { useGallery } from '../api/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Input, Label, Select, Textarea } from './ui/input'
import { ErrorNote, Loading } from './ErrorNote'
import { Tooltip } from './ui/tooltip'
import { MathText } from './Tex'
import { cn } from '../lib/cn'

export type InputTab = TreeFormat | 'gallery'

/** `tip`: what the format is, with a one-line example (the tooltip of the tab). */
type FormatMeta = { label: string; hint: string; example: string; rows?: number; tip: string }

export const FORMATS: Record<TreeFormat, FormatMeta> = {
  edges: {
    label: 'Edge list',
    hint: 'One edge per line or separated by commas, labels are integers or strings.',
    example: '0-1, 1-2, 1-3, 3-4, 3-5',
    tip: 'The edges of the tree, one per line or separated by commas; vertex labels are integers or strings. Example: 0-1, 1-2, 1-3, 3-4, 3-5.',
  },
  adjacency: {
    label: 'Adjacency',
    hint: 'One line per vertex: "v: neighbours".',
    example: '0: 1\n1: 0 2 3\n2: 1\n3: 1 4 5\n4: 3\n5: 3',
    rows: 6,
    tip: 'One line per vertex with its neighbours, "v: neighbours". Example: 1: 0 2 3.',
  },
  parents: {
    label: 'Parent array',
    hint: 'Parent of each vertex, the root has parent −1.',
    example: '[-1, 0, 1, 1, 3, 3]',
    tip: 'Entry i is the parent of vertex i, and the root has parent −1. Example: [-1, 0, 1, 1, 3, 3].',
  },
  prufer: {
    label: 'Prüfer',
    hint: 'n − 2 integers in [0, n − 1].',
    example: '[1, 1, 3, 3]',
    tip: 'The Prüfer sequence of a tree on the vertices 0, …, n − 1: n − 2 integers in [0, n − 1]. Example: [1, 1, 3, 3].',
  },
  parentheses: {
    label: 'Parentheses',
    hint: 'Nested parentheses of a rooted tree (Newick without labels).',
    example: '(()(()()))',
    tip: 'A rooted tree as nested parentheses: each pair is a vertex, with the pairs of its children inside (Newick without labels). Example: (()(()())).',
  },
  graph6: {
    label: 'graph6',
    hint: 'graph6 or sparse6 string, as in Sage and networkx.',
    example: 'DQc',
    tip: 'The graph6 or sparse6 string of the tree, as written by nauty, Sage and networkx. Example: DQc.',
  },
  catalog: {
    label: 'Thesis notation',
    hint: 'Catalog names: S6_3, R2xR5, S_9, R4.',
    example: 'R2xR5',
    tip: 'A name of the catalog of the thesis: S6_3 for $S_6^{(3)}$, R2xR5 for $R_2\\odot R_5$, S_9 for $S_9$. Example: R2xR5.',
  },
}

export const FORMAT_ORDER: TreeFormat[] = ['edges', 'adjacency', 'parents', 'prufer', 'parentheses', 'graph6', 'catalog']

export type TreeInputProps = {
  onSubmit: (input: TreeInputBody) => void
  busy?: boolean
  compact?: boolean
  submitLabel?: string
  initial?: { format: InputTab; data: string }
  className?: string
}

/**
 * Tree entry in every accepted format plus the gallery. Emits a TreeInput body; the page decides which endpoint to call.
 * `initial` is read once, on mount: key the component to reset it.
 */
export function TreeInput({ onSubmit, busy = false, compact = false, submitLabel = 'Analyze', initial, className }: TreeInputProps) {
  const [tab, setTab] = useState<InputTab>(initial?.format ?? 'edges')
  const [texts, setTexts] = useState<Record<string, string>>(() => (initial && initial.format !== 'gallery' ? { [initial.format]: initial.data } : {}))
  const [galleryId, setGalleryId] = useState<string>(initial?.format === 'gallery' ? initial.data : '')
  // parameter overrides per gallery family; the defaults come from the API
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({})
  const gallery = useGallery()

  const item: GalleryItem | undefined = useMemo(() => gallery.data?.find((g) => g.id === galleryId) ?? gallery.data?.[0], [gallery.data, galleryId])
  const params = useMemo<Record<string, number>>(
    () => (item ? { ...Object.fromEntries(item.params.map((p) => [p.name, p.default])), ...(overrides[item.id] ?? {}) } : {}),
    [item, overrides],
  )
  const setParam = (name: string, value: number) => {
    if (!item) return
    setOverrides((o) => ({ ...o, [item.id]: { ...(o[item.id] ?? {}), [name]: value } }))
  }

  const text = tab === 'gallery' ? '' : (texts[tab] ?? '')

  const submit = () => {
    if (tab === 'gallery') {
      if (!item) return
      onSubmit({ format: 'gallery', data: item.id, params })
    } else {
      const data = text.trim()
      if (!data) return
      onSubmit({ format: tab, data })
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as InputTab)}>
        <TabsList aria-label="Input format">
          {FORMAT_ORDER.map((f) => (
            <TabsTrigger key={f} value={f} tip={<MathText text={FORMATS[f].tip} />}>
              {FORMATS[f].label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="gallery" tip="Families of trees with parameters: paths, stars, generalized stars, caterpillars, whirls, the tree of Barioli and Fallat, the seeds S_d. Example: Seed S_d with d = 7.">
            Gallery
          </TabsTrigger>
        </TabsList>
        {FORMAT_ORDER.map((f) => (
          <TabsContent key={f} value={f}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-sans text-xs text-muted">{FORMATS[f].hint}</p>
              <Tooltip content={`Fills the box with the example tree: ${FORMATS[f].example.replace(/\n/g, ' ')}`}>
                <Button variant="ghost" size="sm" onClick={() => setTexts((t) => ({ ...t, [f]: FORMATS[f].example }))}>
                  Load example
                </Button>
              </Tooltip>
            </div>
            <Textarea
              aria-label={`Tree in ${FORMATS[f].label} format`}
              rows={compact ? 2 : (FORMATS[f].rows ?? 3)}
              placeholder={FORMATS[f].example}
              value={texts[f] ?? ''}
              onChange={(e) => setTexts((t) => ({ ...t, [f]: e.target.value }))}
              onKeyDown={onKey}
              className="mt-2"
            />
          </TabsContent>
        ))}
        <TabsContent value="gallery">
          {gallery.isLoading && <Loading text="Loading the gallery…" />}
          {gallery.error && <ErrorNote error={gallery.error} />}
          {gallery.data && gallery.data.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <Label htmlFor="gallery-select">Family</Label>
                <Select id="gallery-select" value={item?.id ?? ''} onChange={(e) => setGalleryId(e.target.value)} className="w-full" title="The family of trees; its parameters appear beside.">
                  {gallery.data.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                {item && <p className="font-sans text-xs text-muted">{item.description}</p>}
              </div>
              {item && item.params.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.params.map((p) => (
                    <div key={p.name} className="space-y-1">
                      <Label htmlFor={`gp-${p.name}`}>
                        {p.name} <span className="font-normal">({p.min}–{p.max})</span>
                      </Label>
                      <Tooltip content={`The parameter ${p.name} of the family, an integer from ${p.min} to ${p.max} (default ${p.default}).`}>
                        <Input
                          id={`gp-${p.name}`}
                          type="number"
                          min={p.min}
                          max={p.max}
                          value={params[p.name] ?? p.default}
                          onChange={(e) => setParam(p.name, Number(e.target.value))}
                          onKeyDown={onKey}
                          className="w-24 font-mono"
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {gallery.isSuccess && gallery.data.length === 0 && <p className="font-sans text-sm text-muted">The gallery is empty.</p>}
        </TabsContent>
      </Tabs>
      <div className="flex items-center gap-3">
        <Tooltip content={submitLabel === 'Analyze' ? 'Parses the tree and analyzes it: its seed, the status of the seed, the bounds on q(T).' : 'Parses the tree and loads it with the zero diagonal and unit weights (⌘/Ctrl + Enter).'}>
          <Button onClick={submit} disabled={busy || (tab === 'gallery' ? !item : !text.trim())}>
            {busy ? 'Working…' : submitLabel}
          </Button>
        </Tooltip>
        <span className="font-sans text-xs text-muted">⌘/Ctrl + Enter</span>
      </div>
    </div>
  )
}
