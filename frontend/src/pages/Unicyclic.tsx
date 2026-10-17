import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { UnicyclicResponse } from '../api/types'
import { api } from '../api/client'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { CiteChip } from '../components/CiteChip'
import { UnicyclicResult } from '../components/UnicyclicResult'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'
import type { Edge } from '../lib/graph'
import { encode, fromEdges } from '../lib/growGraph'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip, Term } from '../components/ThesisTips'

type Build = { kind: 'cycle'; n: number } | { kind: 'tadpole'; k: number; n: number } | { kind: 'sunlet'; n: number; l: number }

/** A cycle is sent as its edge list; tadpoles and sunlets couple a gallery path with C_k (at one or at every cycle vertex). */
function build(b: Build): Promise<UnicyclicResponse> {
  if (b.kind === 'cycle') {
    const edges: Edge[] = Array.from({ length: b.n }, (_, i) => {
      const j = (i + 1) % b.n
      return (i < j ? [i, j] : [j, i]) as Edge
    })
    return api.unicyclic({ n: b.n, edges })
  }
  if (b.kind === 'tadpole') return api.couple({ tree: { format: 'gallery', data: 'path', params: { n: b.n + 1 } }, attach: 0, k: b.k, mode: 'one' })
  return api.couple({ tree: { format: 'gallery', data: 'path', params: { n: b.l + 1 } }, attach: 0, k: b.n, mode: 'all' })
}

function IntField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  tip,
}: {
  id: string
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  tip: string
}) {
  const n = Number(value)
  const ok = Number.isInteger(n) && n >= min && n <= max
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}{' '}
        <span className="text-muted">
          ({min}–{max})
        </span>
      </Label>
      <Tooltip content={`${tip} An integer from ${min} to ${max}.`}>
        <Input id={id} type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!ok} className="w-24 font-mono" />
      </Tooltip>
    </div>
  )
}

const inRange = (v: string, min: number, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max
}

export function UnicyclicPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Build['kind']>('tadpole')
  const [cycleN, setCycleN] = useState('6')
  const [tadK, setTadK] = useState('4')
  const [tadN, setTadN] = useState('3')
  const [sunN, setSunN] = useState('5')
  const [sunL, setSunL] = useState('2')
  // the cycle and a path of ℓ more vertices at each of its n vertices, within the 200 vertices of the backend
  const sunOk = inRange(sunN, 3, 40) && inRange(sunL, 1, 39) && Number(sunN) * (Number(sunL) + 1) <= 200
  const [req, setReq] = useState<Build | null>({ kind: 'tadpole', k: 4, n: 3 })
  const q = useQuery({ queryKey: ['unicyclic-build', req], queryFn: () => build(req!), enabled: req !== null })

  const edit = () => {
    if (!q.data) return
    navigate(`/analyze?${encode(fromEdges(q.data.graph.n, q.data.graph.edges)).toString()}`)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Unicyclic graphs</h1>
      <Section id="unicyclic-results" title="Published results" citeKeys={['ahmadi2013', 'barrett2017generalizations', 'braga2025short', 'allem2025sunlet']}>
        <ul className="prose list-disc space-y-1.5 pl-5">
          <li>
            If two vertices of a connected graph <Tex tex="G" /> are at <Term k="distance">distance</Term> <Tex tex="d" /> and the path of length <Tex tex="d" /> between
            them is unique, then{' '}
            <SymbolTip s="q(G)">
              <Tex tex="q(G)\geq d+1" />
            </SymbolTip>
            . For the cycle,{' '}
            <Tex tex="q(C_n)=\lceil n/2\rceil" /> <CiteChip citeKey="ahmadi2013" />.
          </li>
          <li>
            If <Tex tex="G" /> has <Tex tex="n" /> vertices and contains a cycle of length <Tex tex="k" />, then <Tex tex="q(G)\leq n-\lfloor k/2\rfloor" />{' '}
            <CiteChip citeKey="barrett2017generalizations" />.
          </li>
          <li>
            The <Tex tex="(k,n)" />-tadpole, the cycle <Tex tex="C_k" /> with a path of <Tex tex="n" /> vertices attached at one of its vertices, has{' '}
            <Tex tex="q=n+\lceil k/2\rceil" /> when <Tex tex="3\leq k<2n" />, and the <Tex tex="(2n,n)" />-tadpole has <Tex tex="q=2n" />{' '}
            <CiteChip citeKey="braga2025short" />.
          </li>
          <li>
            The sunlet <Tex tex="S_n^\ell" />, the cycle <Tex tex="C_n" /> with a path <Tex tex="P_\ell" /> attached at each of its vertices, has{' '}
            <Tex tex="q(S_n^\ell)=n/2+2\ell" /> when <Tex tex="n\equiv0\pmod 4" /> and <Tex tex="q(S_n^\ell)=n/2+2\ell+1" /> when <Tex tex="n\equiv2\pmod 4" />, for{' '}
            <Tex tex="n\geq4" /> and <Tex tex="\ell\geq1" /> <CiteChip citeKey="allem2025sunlet" />.
          </li>
        </ul>
        <p className="prose mt-2">When the general lower and upper bounds coincide, the value is exact.</p>
      </Section>

      <Section id="unicyclic-builders" title="Quick builders">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Build['kind'])}>
          <TabsList>
            <TabsTrigger value="cycle" tip="The cycle C_n on n vertices.">
              Cycle
            </TabsTrigger>
            <TabsTrigger value="tadpole" tip="The (k, n)-tadpole: the cycle C_k with a path of n vertices attached at one of its vertices.">
              Tadpole
            </TabsTrigger>
            <TabsTrigger value="sunlet" tip="The sunlet S_n^ℓ: the cycle C_n with a path P_ℓ attached at each of its vertices.">
              Sunlet
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cycle">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (inRange(cycleN, 3, 40)) setReq({ kind: 'cycle', n: Number(cycleN) })
              }}
            >
              <IntField id="u-cycle-n" label={<Tex tex="n" />} value={cycleN} onChange={setCycleN} min={3} max={40} tip="The number n of vertices of the cycle." />
              <Tooltip content="Builds the cycle and lists the published bounds on q(G); for the cycle q(C_n) = ⌈n/2⌉.">
                <Button type="submit" disabled={!inRange(cycleN, 3, 40)}>
                  Build <Tex tex={`C_{${inRange(cycleN, 3, 40) ? cycleN : 'n'}}`} />
                </Button>
              </Tooltip>
            </form>
          </TabsContent>
          <TabsContent value="tadpole">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (inRange(tadK, 3, 40) && inRange(tadN, 1, 39)) setReq({ kind: 'tadpole', k: Number(tadK), n: Number(tadN) })
              }}
            >
              <IntField id="u-tad-k" label={<>cycle length <Tex tex="k" /></>} value={tadK} onChange={setTadK} min={3} max={40} tip="The length k of the cycle." />
              <IntField id="u-tad-n" label={<>path vertices <Tex tex="n" /></>} value={tadN} onChange={setTadN} min={1} max={39} tip="The number n of vertices of the attached path." />
              <Tooltip content="Builds the (k, n)-tadpole and lists the published bounds on q(G).">
                <Button type="submit" disabled={!inRange(tadK, 3, 40) || !inRange(tadN, 1, 39)}>
                  Build the tadpole
                </Button>
              </Tooltip>
            </form>
          </TabsContent>
          <TabsContent value="sunlet">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (sunOk) setReq({ kind: 'sunlet', n: Number(sunN), l: Number(sunL) })
              }}
            >
              <IntField id="u-sun-n" label={<>cycle length <Tex tex="n" /></>} value={sunN} onChange={setSunN} min={3} max={40} tip="The length n of the cycle." />
              <IntField id="u-sun-l" label={<>path length <Tex tex="\ell" /></>} value={sunL} onChange={setSunL} min={1} max={39} tip="The number ℓ of vertices of each attached path P_ℓ." />
              <Tooltip content="Builds the sunlet and lists the published bounds on q(G).">
                <Button type="submit" disabled={!sunOk}>
                  Build the sunlet
                </Button>
              </Tooltip>
              {inRange(sunN, 3, 40) && inRange(sunL, 1, 39) && !sunOk && (
                <p className="basis-full font-sans text-xs text-defective">
                  The sunlet would have {Number(sunN) * (Number(sunL) + 1)} vertices; this version handles at most 200.
                </p>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </Section>

      {req && (
        <Section
          id="unicyclic-result"
          title="Result"
          citeKeys={q.data?.references ?? []}
          right={
            q.data && (
              <Tooltip content="Opens this graph in the drawing of Analyze a tree, where leaves can be hung on any vertex.">
                <Button size="sm" variant="outline" onClick={edit}>
                  Edit the drawing
                </Button>
              </Tooltip>
            )
          }
        >
          {q.isLoading && <Loading />}
          {q.error && <ErrorNote error={q.error} />}
          {q.data && <UnicyclicResult result={q.data} />}
        </Section>
      )}
    </div>
  )
}
