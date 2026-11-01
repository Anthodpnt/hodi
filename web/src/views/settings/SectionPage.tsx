import type { ReactNode } from 'react'
import { useIsPhone } from '../../lib/use-media.ts'
import HelpButton from '../../ui/HelpButton.tsx'
import { HeaderActions, HeaderHelp } from '../MobilePage.tsx'
import styles from './Settings.module.css'

interface SectionPageProps {
  title: string
  intro?: ReactNode
  // The "?" after the title: how the section works.
  help?: { id: string; title: string; body: ReactNode }
  // Beside the title: "7 jours · 30 jours".
  aside?: ReactNode
  // On a phone the title is in the page's header.
  layout: 'desktop' | 'phone'
  children: ReactNode
}

// A settings section: its title and line, then its cards.
// On a tablet the aside goes up beside the page's title; a phone has no room there, so it goes under it,
// full width.
const SectionPage = ({ title, intro, aside, help, layout, children }: SectionPageProps) => {
  const phone = useIsPhone()
  return (
    <div className={layout === 'phone' ? `${styles.page} ${styles.phonePage}` : styles.page}>
      {layout === 'phone' && !phone && aside && <HeaderActions>{aside}</HeaderActions>}
      {layout === 'phone' && help && (
        <HeaderHelp>
          <HelpButton id={help.id} title={help.title} layout="phone">
            {help.body}
          </HelpButton>
        </HeaderHelp>
      )}
      {(layout === 'desktop' || intro) && (
        <div className={styles.header}>
          <div>
            {layout === 'desktop' && (
              <div className={styles.titleRow}>
                <h1 className={`${styles.title} screen-title`}>{title}</h1>
                {help && (
                  <HelpButton id={help.id} title={help.title} layout="desktop">
                    {help.body}
                  </HelpButton>
                )}
              </div>
            )}
            {intro && <p className={styles.intro}>{intro}</p>}
          </div>
          {layout === 'desktop' && aside}
        </div>
      )}
      {layout === 'phone' && phone && aside && <div className={styles.aside}>{aside}</div>}
      {children}
    </div>
  )
}

export default SectionPage
