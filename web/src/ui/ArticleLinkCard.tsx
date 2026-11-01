import { ExternalLink } from 'lucide-react'
import type { MouseEvent } from 'react'
import { fadeIn } from '../lib/fade-in.ts'
import styles from './ArticleLinkCard.module.css'
import Chip from './Chip.tsx'
import ReadingTime from './ReadingTime.tsx'
import SourceAvatar from './SourceAvatar.tsx'

interface ArticleLinkCardProps {
  title: string
  href: string
  sourceId: string
  sourceName: string
  image?: string | null
  minutes?: number | null
  // Not readable in Hodi: marked "sur le site" (it opens on its summary and the way to the site).
  external?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  // A key of the keyboard shortcuts (data-shortcut).
  shortcut?: string
}

// Another article, under the one being read ("Aussi couvert par", "Article suivant"): its title on two
// lines at most, where it comes from and how long it reads, its picture beside.
const ArticleLinkCard = ({
  title,
  href,
  sourceId,
  sourceName,
  image,
  minutes,
  external = false,
  onClick,
  shortcut
}: ArticleLinkCardProps) => (
  <a className={styles.card} href={href} data-shortcut={shortcut} onClick={onClick}>
    <span className={styles.text}>
      <span className={styles.title}>{title}</span>
      <span className={styles.meta}>
        <SourceAvatar sourceId={sourceId} sourceName={sourceName} size={18} />
        <span className={styles.source}>{sourceName}</span>
        {external ? (
          <Chip>
            <ExternalLink size={12} aria-hidden="true" />
            SUR LE SITE
          </Chip>
        ) : (
          minutes != null && <ReadingTime minutes={minutes} />
        )}
      </span>
    </span>
    {image && <img {...fadeIn(styles.image)} src={image} alt="" loading="lazy" decoding="async" />}
  </a>
)

export default ArticleLinkCard
