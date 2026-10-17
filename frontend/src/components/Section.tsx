import { useEffect, useState, type ReactNode } from 'react'
import { AccordionItem } from './ui/accordion'
import { useReferences } from '../store/references'

/**
 * A collapsible page section that declares the bibliography keys it cites.
 * While open, its keys are listed in the "References on this page" panel.
 */
export function Section({
  id,
  title,
  heading,
  citeKeys = [],
  defaultOpen = true,
  right,
  children,
  className,
}: {
  id: string
  /** plain title, also listed in the references panel */
  title: string
  /** the title as shown, when it carries terms or math (inside the accordion button: use Term focusable={false}) */
  heading?: ReactNode
  citeKeys?: string[]
  defaultOpen?: boolean
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const openSection = useReferences((s) => s.openSection)
  const closeSection = useReferences((s) => s.closeSection)
  const keyList = citeKeys.join('\u0000')

  useEffect(() => {
    if (open) openSection(id, title, keyList ? keyList.split('\u0000') : [])
    else closeSection(id)
    return () => closeSection(id)
  }, [open, id, title, keyList, openSection, closeSection])

  return (
    <AccordionItem title={heading ?? title} open={open} onOpenChange={setOpen} right={right} className={className} sectionId={id}>
      {children}
    </AccordionItem>
  )
}
