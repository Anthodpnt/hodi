// A YouTube video's length, which its feed doesn't give: read once from its page, then kept.

export type FetchVideoDuration = (videoId: string) => Promise<number | null>

const VIDEO_ID = /^[\w-]{11}$/
const MAX_PAGE_BYTES = 4 * 1024 * 1024

// The player's data ("lengthSeconds":"754"), or the page's microdata (<meta itemprop="duration" content="PT12M34S">).
export const parseVideoDuration = (html: string): number | null => {
  const length = /"lengthSeconds":"(\d+)"/.exec(html)
  if (length) return Number(length[1]) || null

  const iso = /itemprop="duration" content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/.exec(html)
  if (!iso) return null
  const [, hours = '0', minutes = '0', seconds = '0'] = iso
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) || null
}

// The consent cookie skips the cookie wall YouTube shows in Europe; nothing else is sent.
export const createFetchVideoDuration =
  ({ timeoutMs = 8000 } = {}): FetchVideoDuration =>
  async videoId => {
    if (!VIDEO_ID.test(videoId)) return null

    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept-Language': 'fr-BE,fr;q=0.9,en;q=0.8',
        Cookie: 'SOCS=CAI'
      },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = (await response.text()).slice(0, MAX_PAGE_BYTES)
    const seconds = parseVideoDuration(text)
    // Logged by the caller: a consent or "not a bot" page shows here as another address or a small page.
    if (seconds === null) throw new Error(`no length in ${response.url} (${text.length} characters)`)
    return seconds
  }
