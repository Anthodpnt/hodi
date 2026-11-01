import { toast } from 'sonner'
import { t } from './i18n.ts'

// Short messages over the app (Sonner): what failed, what was done and can be undone, what waits for the
// network, and that a setting reached the server.

const DURATION_MS = 4000
// Long enough to reach the button.
const ACTION_DURATION_MS = 6000
// A setting kept: read in a glance.
const SAVED_DURATION_MS = 2000

interface ToastAction {
  label: string
  onClick: () => void
}

// Something done, with "Annuler" when it can be.
export const showDone = (message: string, undo?: () => void) =>
  toast.success(message, {
    duration: undo ? ACTION_DURATION_MS : DURATION_MS,
    action: undo ? { label: t('common.cancel'), onClick: undo } : undefined
  })

// A setting the server has kept. One of a kind: ten switches flipped in a row show one message.
export const showSaved = (message = t('toast.saved')) =>
  toast.success(message, { id: 'saved', duration: SAVED_DURATION_MS })

// Something failed: what to do next goes in the message, or in the button. `id` keeps one of a kind.
export const showError = (message: string, action?: ToastAction, id?: string) =>
  toast.error(message, { id, duration: action ? ACTION_DURATION_MS : DURATION_MS, action })

// Neither done nor failed: the server's voice is missing, the device is offline.
export const showInfo = (message: string, id?: string) => toast.info(message, { id, duration: DURATION_MS })
