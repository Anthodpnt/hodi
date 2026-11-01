import { Check, Link2, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EmailIcon,
  EmailShareButton,
  FacebookMessengerIcon,
  FacebookMessengerShareButton,
  WhatsappIcon,
  WhatsappShareButton
} from 'react-share'
import { useMedia } from '../../lib/use-media.ts'
import Dialog from '../../ui/Dialog.tsx'
import RoundButton from '../../ui/RoundButton.tsx'
import styles from './ShareMenu.module.css'
import RichText from '../../ui/RichText.tsx'

interface ShareMenuProps {
  // Always the article's own link on its site, never a Hodi link.
  url: string
  title: string
  // What is shared, for the sheet's heading.
  kind?: 'article' | 'video' | 'podcast'
  size?: 34 | 44
  variant?: 'default' | 'glass'
}

// Messenger opens its app on a phone; on a computer its web dialog needs a Facebook app id, which Hodi has not.
const MESSENGER_APP_ID = ''

// Share the original article: by e-mail, WhatsApp, Messenger (phones), or its link copied.
const ShareMenu = ({ url, title, kind = 'article', size = 34, variant = 'default' }: ShareMenuProps) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const phone = useMedia('(pointer: coarse)')

  // The menu under the button closes on a click outside or Escape (the phone's dialog on its own).
  useEffect(() => {
    if (!open || phone) return
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open, phone])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('shareMenu.copyPrompt'), url)
    }
  }

  const heading = t(`shareMenu.heading.${kind}`)
  const options = (
    <div className={styles.options}>
      <button type="button" className={styles.option} role="menuitem" onClick={() => void copy()}>
        <span className={styles.tile}>{copied ? <Check size={20} /> : <Link2 size={20} />}</span>
        {t(copied ? 'shareMenu.copied' : 'shareMenu.copy')}
      </button>
      <EmailShareButton
        url={url}
        subject={title}
        body={`${title}\n\n`}
        resetButtonStyle={false}
        className={styles.option}
        role="menuitem"
      >
        <span className={styles.tile}>
          <EmailIcon size={22} />
        </span>
        {t('shareMenu.email')}
      </EmailShareButton>
      <WhatsappShareButton
        url={url}
        message={title}
        separator={' \n'}
        resetButtonStyle={false}
        className={styles.option}
        role="menuitem"
      >
        <span className={styles.tile}>
          <WhatsappIcon size={22} />
        </span>
        WhatsApp
      </WhatsappShareButton>
      {phone && (
        <FacebookMessengerShareButton
          url={url}
          appId={MESSENGER_APP_ID}
          mobileBehavior="app"
          resetButtonStyle={false}
          className={styles.option}
          role="menuitem"
        >
          <span className={styles.tile}>
            <FacebookMessengerIcon size={22} />
          </span>
          Messenger
        </FacebookMessengerShareButton>
      )}
    </div>
  )

  return (
    <div ref={menu} className={styles.wrap}>
      <RoundButton
        icon={Share}
        label={t('shareMenu.share')}
        size={size}
        variant={open ? 'on' : variant}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      />
      {/* A menu under the button on a computer; on a phone, the app's dialog, as every other one. */}
      {open && !phone && (
        <div ref={panel} className={`${styles.menu} ${styles.popover}`} role="menu" aria-label={heading}>
          <span className={styles.heading}>{heading}</span>
          {options}
        </div>
      )}
      {phone && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={heading}
          intro={<RichText i18nKey="dialogIntro.share" />}
        >
          <div role="menu" aria-label={heading}>
            {options}
          </div>
        </Dialog>
      )}
    </div>
  )
}

export default ShareMenu
