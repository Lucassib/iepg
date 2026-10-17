import { Link } from 'react-router-dom'
import { useMeta } from '../../api/hooks'

export function Footer() {
  const meta = useMeta()
  return (
    <footer className="border-t border-line px-4 py-3 font-sans text-xs text-muted">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-1">
        <span>Sibemberg, L. S. PhD thesis, UFRGS, 2026</span>
        <span aria-hidden>·</span>
        <Link to="/about#ai" className="underline decoration-line underline-offset-2 hover:decoration-ink">
          AI use declaration
        </Link>
        {meta.data && (
          <span className="ml-auto mono">
            api {meta.data.version} · thesis {meta.data.thesis_version} · catalog {meta.data.catalog_hash.slice(0, 8)}
          </span>
        )}
      </div>
    </footer>
  )
}
