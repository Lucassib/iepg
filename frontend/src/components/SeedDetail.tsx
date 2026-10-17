import { Link } from 'react-router-dom'
import { useSeed } from '../api/hooks'
import { TreeView } from './TreeView'
import { Tex, MathText } from './Tex'
import { CertificatePanel } from './CertificatePanel'
import { MatrixView } from './MatrixView'
import { SpectrumBar, NumList } from './SpectrumBar'
import { CiteChips } from './CiteChip'
import { ErrorNote, Loading } from './ErrorNote'
import { buttonClass } from './ui/button'
import { StatusBadge } from './ui/badge'
import { SymbolTip, Term } from './ThesisTips'

/** Detail of a catalog seed: tree, status, certificate, brick matrix and spectrum, history and references. */
export function SeedDetail({ name }: { name: string }) {
  const q = useSeed(name)
  if (q.isLoading) return <Loading text={`Loading ${name}…`} />
  if (q.error) return <ErrorNote error={q.error} />
  const s = q.data
  if (!s) return null
  const brick = s.certificate.brick
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={s.status} />
        <span className="font-sans text-xs text-muted">
          n = {s.tree.n}, d = {s.tree.diameter} · <span className="mono">{s.name}</span>
        </span>
        {s.rooted_seed && (
          <span className="font-sans text-xs text-muted">
            · <Term k="rooted seed">rooted seed</Term> <Tex tex={s.rooted_seed} />
          </span>
        )}
        {s.pair && (
          <span className="font-sans text-xs text-muted">
            · pair ({s.pair[0]}, {s.pair[1]})
          </span>
        )}
      </div>
      <div className="rounded-md border border-line bg-paper p-2">
        <TreeView tree={s.tree} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass('outline', 'sm')} to={`/tree/${encodeURIComponent(s.canonical)}`}>
          Analyze this tree
        </Link>
        <Link className={buttonClass('outline', 'sm')} to={`/lab/latent?catalog=${encodeURIComponent(s.name)}`}>
          Open in the lab
        </Link>
        <Link className={buttonClass('outline', 'sm')} to={`/lab/diagonalize?catalog=${encodeURIComponent(s.name)}`}>
          Diagonalize
        </Link>
      </div>
      <CertificatePanel certificate={s.certificate} status={s.status}>
        {brick && (
          <div className="space-y-3 rounded-md border border-line bg-paper p-3">
            <h4 className="font-serif text-base font-semibold">
              <Term k="brick">Brick</Term> rooted at {brick.root}
              {brick.other_main_root !== undefined && (
                <>
                  {' '}
                  (other <Term k="main root">main root</Term> {brick.other_main_root})
                </>
              )}
            </h4>
            <MatrixView matrix={brick.matrix} tree={s.tree} root={brick.root} />
            <SpectrumBar values={brick.dspec} latent={brick.latent} confined={brick.confined} showList />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-sans text-sm">
              <dt>
                <SymbolTip s="Δ(M)">
                  <Tex tex="\Delta(M)" />
                </SymbolTip>
              </dt>
              <dd>
                <NumList values={brick.latent} hollow />
              </dd>
              <dt>
                <SymbolTip s="Δ_c(M)">
                  <Tex tex="\Delta_c(M)" />
                </SymbolTip>
              </dt>
              <dd>
                <NumList values={brick.confined} hollow />
              </dd>
            </dl>
          </div>
        )}
      </CertificatePanel>
      {s.history && (
        <div>
          <h4 className="mb-1 font-serif text-base font-semibold">History</h4>
          <p className="prose text-[0.98rem]">
            <MathText text={s.history} />
          </p>
        </div>
      )}
      {s.references.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 font-sans text-sm">
          <span className="text-muted">References:</span> <CiteChips keys={s.references} />
        </div>
      )}
    </div>
  )
}
