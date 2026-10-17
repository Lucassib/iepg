import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { TreeInput as TreeInputBody } from '../api/types'
import { useDiagonalize, useLatent } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { LabWorkbench, type LabState } from '../components/LabWorkbench'
import { DiagonalizePlayer, Pseudocode } from '../components/DiagonalizePlayer'
import { LatentPanel } from '../components/LatentPanel'
import { ErrorNote } from '../components/ErrorNote'
import { Input, Label } from '../components/ui/input'
import { isValidRational } from '../lib/exact'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip, Term } from '../components/ThesisTips'
import { ThesisRef } from '../components/ThesisRef'

function useInitialInput(): TreeInputBody | null {
  const [search] = useSearchParams()
  return useMemo(() => {
    const c = search.get('catalog')
    if (c) return { format: 'catalog', data: c }
    const canonical = search.get('canonical')
    if (canonical) return { canonical }
    return null
  }, [search])
}

export function LabDiagonalizePage() {
  const initial = useInitialInput()
  const [state, setState] = useState<LabState | null>(null)
  const [lam, setLam] = useState('0')
  const run = useDiagonalize()
  const ran = run.data && run.variables ? run.variables : null

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Diagonalize step by step</h1>
      <Section id="diag-statement" title="The algorithm" defaultOpen={false}>
        <div className="grid gap-4 md:grid-cols-2">
          <p className="prose">
            Given <Tex tex="M\in\mathcal S(T)" /> rooted at <Tex tex="r" /> and a real <Tex tex="\lambda" />, <span className="mono">Diagonalize(M, −λ)</span> processes
            the vertices <Term k="bottom-up">bottom-up</Term> and assigns a value{' '}
            <SymbolTip s="d̂_v">
              <Tex tex="\hat d_v" />
            </SymbolTip>{' '}
            to each vertex when it is processed (its <Term k="temporary value">temporary value</Term>); the <Term k="final value">final values</Term>{' '}
            <SymbolTip s="d_v">
              <Tex tex="d_v" />
            </SymbolTip>{' '}
            may differ from <Tex tex="\hat d_v" /> only at the child selected at line 7, which receives 2. The number of zeros among the final values is the multiplicity of <Tex tex="\lambda" /> as an
            eigenvalue of <Tex tex="M" />, and the positive and negative values count the eigenvalues greater and smaller than <Tex tex="\lambda" /> (Sylvester). The
            vertices with <Tex tex="\hat d_v=0" /> are the temporary zeros of <Tex tex="\lambda" />, and{' '}
            <SymbolTip s="Z(M)">
              <Tex tex="\mathcal Z(M)" />
            </SymbolTip>{' '}
            is the set of values with a temporary zero, the <Term k="set of temporary zeros">set of temporary zeros</Term>.
          </p>
          <Pseudocode line={null} />
        </div>
      </Section>
      <Section id="diag-workbench" title="Workbench">
        <LabWorkbench
          state={state}
          onState={(s) => {
            setState(s)
            run.reset()
          }}
          initialInput={initial}
          runLabel="Run Diagonalize"
          runTip="Runs Diagonalize(M, −λ) from the chosen root and opens the step-by-step player: the zeros among the final values count the multiplicity of λ."
          busy={run.isPending}
          canRun={isValidRational(lam)}
          extra={
            <div className="space-y-1">
              <Label htmlFor="lam">
                <Tex tex="\lambda" /> (rational)
              </Label>
              <Tooltip content="The real λ tested, as a rational: the run counts the eigenvalues of M equal to, greater than and smaller than λ.">
                <Input id="lam" value={lam} onChange={(e) => setLam(e.target.value)} aria-invalid={!isValidRational(lam)} className="w-24 font-mono" />
              </Tooltip>
            </div>
          }
          onRun={(s) => run.mutate({ tree: s.input, root: s.root, matrix: s.matrix, lam })}
        />
        {run.error && <ErrorNote error={run.error} className="mt-3" />}
      </Section>
      {run.data && ran && state && (
        <Section id="diag-player" title={`Diagonalize(M, −λ) with λ = ${ran.lam}`}>
          <DiagonalizePlayer key={run.submittedAt} result={run.data} tree={state.tree} root={ran.root} matrix={ran.matrix} lam={ran.lam} />
        </Section>
      )}
    </div>
  )
}

export function LabLatentPage() {
  const initial = useInitialInput()
  const [state, setState] = useState<LabState | null>(null)
  const run = useLatent()
  const ran = run.data && run.variables ? run.variables : null

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Latent values and bricks</h1>
      <Section id="latent-statement" title="Definitions" defaultOpen={false}>
        <p className="prose">
          For <Tex tex="M\in\mathcal S(T)" /> rooted at a <Term k="main root">main root</Term>,{' '}
          <SymbolTip s="Z(M)">
            <Tex tex="\mathcal Z(M)" />
          </SymbolTip>{' '}
          is the set of reals with a temporary zero in <span className="mono">Diagonalize</span>, the <Term k="latent values">latent values</Term> are{' '}
          <SymbolTip s="Δ(M)">
            <Tex tex="\Delta(M)=\mathcal Z(M)\setminus\mathrm{DSpec}(M)" />
          </SymbolTip>
          , and the <Term k="confined">confined</Term> latent values{' '}
          <SymbolTip s="Δ_c(M)">
            <Tex tex="\Delta_c(M)" />
          </SymbolTip>{' '}
          are those whose temporary zeros appear only at main roots. The matrix is a <Term k="brick">brick</Term> when{' '}
          <SymbolTip s="q(M)">
            <Tex tex="q(M)=d(T)+1" />
          </SymbolTip>{' '}
          and every latent value is confined; a seed with a brick generates only <Term k="diminimal">diminimal</Term> trees (<ThesisRef label="thm:brick-diminimal" />).
          The bound{' '}
          <SymbolTip s="c(M)">
            <Tex tex="|\mathcal Z(M)|-|\Delta_c(M)|" />
          </SymbolTip>{' '}
          is the bound of <ThesisRef label="prop:latent-bound" />.
        </p>
      </Section>
      <Section id="latent-workbench" title="Workbench">
        <LabWorkbench
          state={state}
          onState={(s) => {
            setState(s)
            run.reset()
          }}
          initialInput={initial}
          mainRootsOnly
          runLabel="Compute latent values"
          runTip="Computes DSpec(M), the set of temporary zeros 𝒵(M), the latent values Δ(M) and the confined ones Δ_c(M) for the tree rooted at the chosen main root, and decides whether M is a brick."
          busy={run.isPending}
          onRun={(s) => run.mutate({ tree: s.input, root: s.root, matrix: s.matrix })}
        />
        {run.error && <ErrorNote error={run.error} className="mt-3" />}
      </Section>
      {run.data && ran && state && (
        <Section id="latent-result" title="Result">
          <LatentPanel result={run.data} tree={state.tree} root={ran.root} />
        </Section>
      )}
    </div>
  )
}
