import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sheet } from './ui/dialog'
import { SeedDetail } from './SeedDetail'
import { Tex } from './Tex'
import { seedLabelTex } from '../lib/seedLabel'

/** The `?seed=NAME` search parameter selects the seed shown in the detail sheet. */
export function useSeedParam(): [string | null, (name: string | null) => void] {
  const [search, setSearch] = useSearchParams()
  const name = search.get('seed')
  const set = useCallback(
    (n: string | null) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (n) next.set('seed', n)
          else next.delete('seed')
          return next
        },
        { replace: false },
      )
    },
    [setSearch],
  )
  return [name, set]
}

export function SeedSheet({ name, onClose }: { name: string | null; onClose: () => void }) {
  return (
    <Sheet
      open={name !== null}
      onOpenChange={(o) => !o && onClose()}
      title={
        name ? (
          <>
            Seed {seedLabelTex(name) ? <Tex tex={seedLabelTex(name)!} /> : <span className="mono">{name}</span>}
          </>
        ) : (
          'Seed'
        )
      }
      description="Catalog entry with certificate"
    >
      {name && <SeedDetail name={name} />}
    </Sheet>
  )
}
