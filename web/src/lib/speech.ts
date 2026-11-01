import { type RefObject, useEffect, useRef, useState } from 'react'
import type { Language } from '../api.ts'

// loading is kept for a voice that takes time to start; the browser's voices start at once.
export type SpeechState = 'idle' | 'loading' | 'playing' | 'paused'

// Blocks read one by one: each is highlighted while it is spoken.
const BLOCKS = 'p, h2, h3, h4, li, blockquote'
// Marks the block being read, for the reader's styles.
export const SPEAKING_ATTRIBUTE = 'data-speaking'

const VOICE_LANGS: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' }

const isSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

// The voices downloaded in the system settings ("Premium", "Améliorée") read best: picked first.
const QUALITY = /premium|enhanced|améliorée|natural|neural/i

const pickVoice = (voices: SpeechSynthesisVoice[], voiceLang: string) => {
  const matching = voices.filter(candidate => candidate.lang.replace('_', '-').startsWith(voiceLang))
  return (
    matching.find(candidate => QUALITY.test(candidate.name)) ??
    matching.find(candidate => candidate.localService) ??
    matching[0]
  )
}

// Safari plays speech on the ringer's channel: with the iPhone on silent, nothing is heard.
// Asking for the media channel (iOS 17+) lets it play like a video.
const askPlaybackChannel = () => {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'playback'
}

// Given back once the voice stops.
const releasePlaybackChannel = () => {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'auto'
}

// Kept until spoken: some browsers lose the events of an utterance nothing refers to any more.
let queued: SpeechSynthesisUtterance[] = []

// The browser's own voices read the article (free, offline, nothing leaves the device).
// The block being read is marked.
export const useSpeech = (content: RefObject<HTMLElement | null>, lang: Language) => {
  const [state, setState] = useState<SpeechState>('idle')
  const supported = isSupported()
  // Bumped by every stop: the end of a voice stopped since is ignored.
  const session = useRef(0)

  const clearHighlight = () => {
    content.current?.querySelectorAll(`[${SPEAKING_ATTRIBUTE}]`).forEach(block => {
      block.removeAttribute(SPEAKING_ATTRIBUTE)
    })
  }

  const mark = (block: HTMLElement) => {
    clearHighlight()
    block.setAttribute(SPEAKING_ATTRIBUTE, '')
    block.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const silence = () => {
    if (isSupported()) window.speechSynthesis.cancel()
    queued = []
    releasePlaybackChannel()
  }

  // Leaving the article stops the voice.
  useEffect(
    () => () => {
      session.current++
      silence()
    },
    []
  )

  const stop = () => {
    session.current++
    silence()
    clearHighlight()
    setState('idle')
  }

  const blocksOf = () => {
    const root = content.current
    if (!root) return []
    return [...root.querySelectorAll<HTMLElement>(BLOCKS)].filter(
      // A list item holding paragraphs is read through them.
      block => block.textContent?.trim() && !block.querySelector(BLOCKS)
    )
  }

  const play = () => {
    const blocks = blocksOf()
    if (blocks.length === 0 || !isSupported()) return
    askPlaybackChannel()

    const current = ++session.current
    const synth = window.speechSynthesis
    const voiceLang = VOICE_LANGS[lang]
    const voice = pickVoice(synth.getVoices(), voiceLang)

    // On iOS, a speak() right after cancel() is dropped: only cancel what is really playing.
    if (synth.speaking || synth.pending) synth.cancel()
    queued = []

    // Queued all at once: iOS may refuse to start a voice outside the tap that asked for it.
    blocks.forEach((block, index) => {
      const utterance = new SpeechSynthesisUtterance(block.textContent?.trim() ?? '')
      utterance.lang = voiceLang
      if (voice) utterance.voice = voice
      queued.push(utterance)

      utterance.onstart = () => mark(block)

      if (index === blocks.length - 1) {
        utterance.onend = () => {
          if (current !== session.current) return
          queued = []
          clearHighlight()
          releasePlaybackChannel()
          setState('idle')
        }
      }

      synth.speak(utterance)
    })

    setState('playing')
  }

  const toggle = () => {
    if (state === 'idle') {
      play()
    } else if (state === 'playing') {
      window.speechSynthesis.pause()
      setState('paused')
    } else if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('playing')
    } else {
      stop()
    }
  }

  return { supported, state, toggle, stop }
}
