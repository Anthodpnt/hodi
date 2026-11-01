import { ArrowLeftRight, EyeOff, ExternalLink, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type SourceStatus,
  TOPICS_CHANGED,
  type TopicInfo,
  UnauthorizedError,
  getSources,
  removeSource,
  setSourceTopics
} from '../../../api.ts'
import { askToConfirm } from '../../../lib/confirm.ts'
import { shortAgo } from '../../../lib/format.ts'
import { getLanguage } from '../../../lib/i18n.ts'
import { updatePreferences, usePreferences } from '../../../lib/preferences.ts'
import { useMyRequests } from '../../../lib/my-requests.ts'
import { isYoung, useProfiles } from '../../../lib/profiles.ts'
import { sourceState, useSourceEngagement, useSourceStatuses } from '../../../lib/settings-data.ts'
import { showError, showSaved } from '../../../lib/toast.ts'
import { useTourStep } from '../../../lib/tour.ts'
import { foldText } from '../../../lib/word-match.ts'
import Accordion, { AccordionGroup } from '../../../ui/Accordion.tsx'
import Button from '../../../ui/Button.tsx'
import Chip from '../../../ui/Chip.tsx'
import DaySeparator from '../../../ui/DaySeparator.tsx'
import Dialog from '../../../ui/Dialog.tsx'
import DialogActions from '../../../ui/DialogActions.tsx'
import FilterChip from '../../../ui/FilterChip.tsx'
import RoundButton from '../../../ui/RoundButton.tsx'
import SourceAvatar from '../../../ui/SourceAvatar.tsx'
import StatusLine from '../../../ui/StatusLine.tsx'
import TextField from '../../../ui/TextField.tsx'
import Toggle from '../../../ui/Toggle.tsx'
import TopicCapsule from '../../../ui/TopicCapsule.tsx'
import RichText from '../../../ui/RichText.tsx'
import SectionPage from '../SectionPage.tsx'
import RowsSkeleton from '../SettingsSkeleton.tsx'
import styles from '../Settings.module.css'
import AddSourceDialog, { type AddSourceRequest } from './AddSourceDialog.tsx'
import AskSourceDialog from './AskSourceDialog.tsx'
import sourceStyles from './SourcesSection.module.css'
import TopicField from './TopicField.tsx'
import LanguageChip from '../../../ui/LanguageChip.tsx'

type Filter = 'all' | 'low' | 'error' | 'hidden'

type GroupId = 'requests' | 'mine' | 'channels' | 'household' | 'base'

const FILTERS: Filter[] = ['all', 'low', 'error', 'hidden']

interface SourcesSectionProps {
  topics: TopicInfo[]
  layout: 'desktop' | 'phone'
  onUnauthorized: () => void
}

// Every feed as a card, in folding groups: the profile's own sites and channels, the household's, the base ones. One button adds a
// source (by link or with the AI); the filters find the little-read, the failing and the hidden ones.
const SourcesSection = ({ topics, layout, onUnauthorized }: SourcesSectionProps) => {
  const { t } = useTranslation()
  const { value: sources, failed, replace } = useSourceStatuses(onUnauthorized)
  const { value: engagement } = useSourceEngagement(onUnauthorized)
  const preferences = usePreferences()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // One topic's sources only, in every group (Mes sources, Mes chaînes…): a long list is easier to go through.
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [adding, setAdding] = useState<AddSourceRequest | null>(null)
  const household = useProfiles({ onError: () => {} })
  const current = household?.current
  const me = household?.profiles.find(profile => profile.id === current)
  const admin = me?.role === 'admin'
  // A young profile reads the sources its parents gave it: it adds, changes and removes none. A teen asks for one.
  const young = me ? isYoung(me) : false
  const teen = me?.kind === 'teen'
  const requests = useMyRequests(teen)
  const [asking, setAsking] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  // The source whose topics are being changed, and the ones picked so far.
  const [editing, setEditing] = useState<{ id: string; name: string; topicIds: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  // All closed as the page opens: the groups' titles and counts are its summary. During the tour, the sites stay
  // open on its "add" card.
  const touring = useTourStep() !== null
  const [opened, setOpened] = useState<GroupId[]>(touring ? ['mine'] : [])
  // The sources shown or hidden since the page or an accordion opened, with their state before: they keep their
  // place until then, so a card does not jump away from the toggle just used.
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const toggle = (id: GroupId) => {
    if (!opened.includes(id)) setHeld({})
    setOpened(ids => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id]))
  }

  const reload = () =>
    getSources()
      .then(replace)
      .catch((error: unknown) => {
        if (error instanceof UnauthorizedError) onUnauthorized()
      })

  const remove = ({ id, name }: SourceStatus) =>
    askToConfirm({
      title: t('confirm.deleteSource.title'),
      message: <RichText i18nKey="confirm.deleteSource.message" values={{ name }} />,
      label: t('confirm.deleteSource.button'),
      onConfirm: () => {
        setRemoving(id)
        void removeSource(id)
          .then(async () => {
            window.dispatchEvent(new Event(TOPICS_CHANGED))
            await reload()
            showSaved(t('sources.deleted', { name }))
          })
          .catch((error: unknown) => {
            if (error instanceof UnauthorizedError) onUnauthorized()
            else showError(t('sources.deleteFailed'))
          })
          .finally(() => setRemoving(null))
      }
    })

  // "Peu ouvertes": hides a group's ones at once, after a question.
  const hideLow = (list: SourceStatus[]) =>
    askToConfirm({
      ...(list.length > 1
        ? {
            title: t('confirm.hideSources.title', { count: list.length }),
            message: <RichText i18nKey="confirm.hideSources.message" values={{ count: list.length }} />,
            label: t('confirm.hideSources.button', { count: list.length })
          }
        : {
            title: t('confirm.hideSource.title'),
            message: <RichText i18nKey="confirm.hideSource.message" values={{ name: list[0]?.name ?? '' }} />,
            label: t('confirm.hideSource.button')
          }),
      onConfirm: () => {
        updatePreferences({
          hiddenSources: [...new Set([...preferences.hiddenSources, ...list.map(source => source.id)])]
        })
        showSaved(t('sources.hidden', { count: list.length }))
      }
    })

  const added = () => {
    // A replacement: the little-read source steps aside for the new one.
    if (adding?.replacing) {
      updatePreferences({ hiddenSources: [...preferences.hiddenSources, adding.replacing.id] }, { quiet: true })
      showSaved(t('sources.replaced', { name: adding.replacing.name }))
      setAdding(null)
    } else {
      showSaved(t('sources.added'))
    }
    void reload()
  }

  const topicsOf = (sourceId: string) => topics.filter(topic => topic.sources.some(source => source.id === sourceId))

  const saveTopics = () => {
    if (!editing || editing.topicIds.length === 0) return
    setSaving(true)
    setSourceTopics(editing.id, editing.topicIds)
      .then(() => {
        window.dispatchEvent(new Event(TOPICS_CHANGED))
        setEditing(null)
        showSaved(t('sources.topicsSaved'))
      })
      .catch((error: unknown) => {
        if (error instanceof UnauthorizedError) onUnauthorized()
        else showError(t('sources.topicsFailed'))
      })
      .finally(() => setSaving(false))
  }
  const hidden = (id: string) => preferences.hiddenSources.includes(id)
  const lowOf = (id: string) => {
    const row = engagement?.sources.find(candidate => candidate.id === id)
    return row?.low && !hidden(id) ? row : null
  }
  const matches: Record<Filter, (source: SourceStatus) => boolean> = {
    all: () => true,
    low: source => lowOf(source.id) !== null,
    error: source => sourceState(source) === 'error' && !hidden(source.id),
    hidden: source => hidden(source.id)
  }
  const counts = sources && {
    all: sources.length,
    low: sources.filter(matches.low).length,
    error: sources.filter(matches.error).length,
    hidden: sources.filter(matches.hidden).length
  }
  const chosen = filter !== 'all' && counts?.[filter] === 0 ? 'all' : filter
  // The topics with at least one source, in the topics' order.
  const filterTopics = topics.filter(topic => topic.sources.length > 0)
  const chosenTopic = filterTopics.some(topic => topic.id === topicFilter) ? topicFilter : null
  const wanted = foldText(search.trim())
  const shown = (sources ?? []).filter(
    source =>
      matches[chosen](source) &&
      (!chosenTopic || topicsOf(source.id).some(topic => topic.id === chosenTopic)) &&
      (!wanted ||
        foldText(
          `${source.name} ${topicsOf(source.id)
            .map(topic => topic.label)
            .join(' ')}`
        ).includes(wanted))
  )
  // A group's sources under a separator per topic, as Le fil's days: each under its first topic (the one filtered
  // on, if any), in the topics'
  // order, then those without one (channels) by kind, by name with the hidden ones last. An empty group keeps one
  // section for its "add" card.
  const byTopic = (list: SourceStatus[]) => {
    const sections: { id: string; label: string; sources: SourceStatus[] }[] = []
    for (const source of list) {
      const tagged = topicsOf(source.id)
      const topic = tagged.find(candidate => candidate.id === chosenTopic) ?? tagged[0]
      const id = topic?.id ?? source.kind
      const section = sections.find(candidate => candidate.id === id)
      if (section) section.sources.push(source)
      else sections.push({ id, label: topic?.label ?? t(`sources.kinds.${source.kind}`), sources: [source] })
    }
    const rank = (id: string) => {
      const index = topics.findIndex(topic => topic.id === id)
      return index === -1 ? topics.length : index
    }
    sections.sort((a, b) => rank(a.id) - rank(b.id))
    const placedOff = (id: string) => held[id] ?? hidden(id)
    sections.forEach(section =>
      section.sources.sort(
        (a, b) => Number(placedOff(a.id)) - Number(placedOff(b.id)) || a.name.localeCompare(b.name, getLanguage())
      )
    )
    return sections.length > 0 ? sections : [{ id: 'empty', label: '', sources: [] }]
  }
  const own = (source: SourceStatus) => source.addedBy !== undefined && source.addedBy === current
  const groups: { id: GroupId; title: string; sources: SourceStatus[]; add?: { label: string; hint: string } }[] = [
    {
      id: 'mine',
      title: t('sources.groups.mine'),
      sources: shown.filter(source => own(source) && source.kind === 'article'),
      add: { label: t('settings.addSource.title'), hint: t('sources.addHint') }
    },
    {
      id: 'channels',
      title: t('sources.groups.channels'),
      sources: shown.filter(source => own(source) && source.kind !== 'article'),
      add: { label: t('sources.addChannel'), hint: t('sources.addChannelHint') }
    },
    {
      id: 'household',
      title: young ? t('requests.byParents') : t('sources.groups.household'),
      sources: shown.filter(source => source.addedBy !== undefined && source.addedBy !== current)
    },
    { id: 'base', title: t('sources.groups.base'), sources: shown.filter(source => source.addedBy === undefined) }
  ]
  // Browsing everything: the profile's own groups stay, with their "add" card (a computer's; a phone has the
  // button at the top of the page), and each opens on demand. A filter or a search opens every group it finds.
  const browsing = chosen === 'all' && !chosenTopic && !wanted
  // A new filter or search opens every group once; each can be closed after. Back to everything, the groups
  // open before come back.
  const query = browsing ? '' : `${chosen}\n${chosenTopic ?? ''}\n${wanted}`
  const [openedFor, setOpenedFor] = useState({ query, before: opened })
  if (openedFor.query !== query) {
    setOpenedFor({ query, before: openedFor.query ? openedFor.before : opened })
    setOpened(query ? ['mine', 'channels', 'household', 'base'] : openedFor.before)
  }
  // A topic picked alone is a place to manage it: its "add" cards stay, and they open on it.
  const addCard = chosen === 'all' && !wanted && layout === 'desktop' && !young

  const addButton = young ? (
    teen && (
      <Button look="primary" icon={Plus} onClick={() => setAsking(true)} data-tour="ask-source">
        {t('requests.ask')}
      </Button>
    )
  ) : (
    <Button
      look="primary"
      icon={Plus}
      data-tour="add-source"
      onClick={() => setAdding({ topicId: chosenTopic, replacing: null })}
    >
      {t('settings.addSource.title')}
    </Button>
  )

  const card = (source: SourceStatus) => {
    const state = sourceState(source)
    const sourceTopics = topicsOf(source.id)
    const mine = admin || (source.addedBy !== undefined && source.addedBy === current)
    const off = hidden(source.id)
    const low = lowOf(source.id)
    const ago = shortAgo(source.fetchedAt)
    const status = off
      ? t('sources.status.hidden')
      : state === 'idle'
        ? t('sources.status.idle')
        : state === 'error'
          ? `${t('sources.status.error')}${ago ? ` · ${ago}` : ''}`
          : `${ago} · ${t('count.article', { count: source.itemCount })}`
    const addedBy =
      source.addedBy === undefined || source.addedBy === current
        ? null
        : (household?.profiles.find(profile => profile.id === source.addedBy)?.name ?? t('sources.deletedProfile'))

    return (
      <li key={source.id} className={`${sourceStyles.source} ${off ? sourceStyles.offCard : ''}`}>
        <div className={sourceStyles.head}>
          <span className={off ? styles.dim : undefined}>
            <SourceAvatar sourceId={source.id} sourceName={source.name} size={44} />
          </span>
          <span className={sourceStyles.identity}>
            <span className={`${styles.rowLabel} ${sourceStyles.name} ${off ? sourceStyles.offName : ''}`}>
              {source.name}
            </span>
            <span
              className={`${sourceStyles.status} ${sourceStyles[off ? 'off' : state]}`}
              title={state === 'error' && source.error ? t('sources.errorTitle', { error: source.error }) : undefined}
            >
              <span className={sourceStyles.dot} aria-hidden="true" />
              {status.toUpperCase()}
            </span>
          </span>
        </div>
        <div className={sourceStyles.tags}>
          {sourceTopics.length > 0 ? (
            sourceTopics.map(topic => (
              <TopicCapsule key={topic.id} topicId={topic.id} label={topic.label} href={null} />
            ))
          ) : (
            <Chip size="capsule">{t(`sources.kinds.${source.kind}`)}</Chip>
          )}
          <LanguageChip lang={source.lang} size="capsule" />
          {addedBy && (
            <Chip label={t('sources.addedBy', { name: addedBy })} size="capsule">
              {t('sources.by', { name: addedBy })}
            </Chip>
          )}
          {low && (
            <Chip
              tone="warning"
              size="capsule"
              title={t(source.kind === 'article' ? 'sources.lowArticles' : 'sources.lowVideos', {
                count: low.articles,
                read: low.read,
                days: engagement?.days ?? 30
              })}
            >
              {t('sources.low')}
            </Chip>
          )}
        </div>
        <div className={sourceStyles.foot}>
          <span className={sourceStyles.actions}>
            {low && !young && (
              <RoundButton
                icon={ArrowLeftRight}
                label={t('settings.addSource.replace', { name: source.name })}
                title={t('settings.addSource.replace', { name: source.name })}
                onClick={() =>
                  setAdding({ topicId: sourceTopics[0]?.id ?? null, replacing: { id: source.id, name: source.name } })
                }
              />
            )}
            {mine && source.kind === 'article' && sourceTopics.length > 0 && (
              <RoundButton
                icon={Tags}
                label={t('sources.changeTopicsOf', { name: source.name })}
                title={t('sources.changeTopics')}
                onClick={() =>
                  setEditing({ id: source.id, name: source.name, topicIds: sourceTopics.map(topic => topic.id) })
                }
              />
            )}
            <RoundButton
              icon={ExternalLink}
              label={t('addSource.seeSite', { name: source.name })}
              title={t('sources.seeSite')}
              href={source.site}
              external
            />
            {mine && source.addedBy !== undefined && (
              <RoundButton
                icon={Trash2}
                variant="danger"
                label={t('sources.deleteFor', { name: source.name })}
                title={t('profileForm.delete')}
                disabled={removing === source.id}
                onClick={() => remove(source)}
              />
            )}
          </span>
          <Toggle
            label={t('settings.themes.show', { name: source.name })}
            checked={!off}
            onChange={show => {
              setHeld(states => (source.id in states ? states : { ...states, [source.id]: off }))
              updatePreferences({
                hiddenSources: show
                  ? preferences.hiddenSources.filter(other => other !== source.id)
                  : [...preferences.hiddenSources, source.id]
              })
            }}
          />
        </div>
      </li>
    )
  }

  return (
    <SectionPage
      title={t('settings.nav.sources')}
      intro={sources ? t('sources.intro', { count: sources.length }) : t('sources.introLoading')}
      layout={layout}
      help={
        young
          ? { id: 'sources-young', title: t('requests.helpTitle'), body: <p>{t('requests.helpBody')}</p> }
          : {
              id: 'sources',
              title: t('sources.helpTitle'),
              body: (
                <>
                  <p>{t('sources.help')}</p>
                  <p>
                    {t(layout === 'desktop' ? 'sources.helpLowDesktop' : 'sources.helpLow', {
                      days: engagement?.days ?? 30
                    })}
                  </p>
                </>
              )
            }
      }
    >
      {layout === 'phone' && <div className={sourceStyles.phoneAdd}>{addButton}</div>}

      <TextField
        icon={Search}
        type="search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('sources.search')}
        aria-label={t('sources.searchLabel')}
      />

      {counts && (
        <div className={`${sourceStyles.filters} no-scrollbar edge-fade`} role="group" aria-label={t('sources.filter')}>
          {FILTERS.map(key => (
            <FilterChip
              key={key}
              selected={chosen === key}
              count={counts[key]}
              disabled={counts[key] === 0}
              onClick={() => setFilter(chosen === key ? 'all' : key)}
            >
              {t(`sources.filters.${key}`)}
            </FilterChip>
          ))}
        </div>
      )}

      {sources && filterTopics.length > 1 && (
        <div
          className={`${sourceStyles.filters} no-scrollbar edge-fade`}
          role="group"
          aria-label={t('sources.filterTopic')}
        >
          <FilterChip selected={chosenTopic === null} onClick={() => setTopicFilter(null)}>
            {t('sources.allTopics')}
          </FilterChip>
          {filterTopics.map(topic => (
            <TopicCapsule
              key={topic.id}
              topicId={topic.id}
              label={topic.label}
              size="filter"
              selected={chosenTopic === topic.id}
              onClick={() => setTopicFilter(chosenTopic === topic.id ? null : topic.id)}
            />
          ))}
        </div>
      )}

      {failed ? (
        <StatusLine tone="error">{t('sources.loadFailed')}</StatusLine>
      ) : !sources ? (
        <RowsSkeleton rows={4} lead="none" hint={false} end="round" />
      ) : shown.length === 0 && !browsing ? (
        <StatusLine tone="info">{t('sources.noMatch')}</StatusLine>
      ) : (
        <AccordionGroup>
          {/* A teen's requests, waiting for its parents; on a computer its "ask" card is there too. */}
          {teen && browsing && (
            <Accordion
              title={t('requests.mine')}
              count={requests?.length ?? 0}
              tour="requests"
              open={opened.includes('requests')}
              onToggle={() => toggle('requests')}
            >
              <ul className={`${sourceStyles.grid} ${sourceStyles.sameRows}`}>
                {layout === 'desktop' && (
                  <li>
                    <button
                      type="button"
                      className={sourceStyles.addCard}
                      onClick={() => setAsking(true)}
                      data-tour="ask-source"
                    >
                      <span className={sourceStyles.head}>
                        <span className={sourceStyles.addMark} aria-hidden="true">
                          <Plus size={18} />
                        </span>
                        <span className={`${styles.rowLabel} ${sourceStyles.name}`}>{t('requests.ask')}</span>
                      </span>
                      <span className={`${sourceStyles.foot} ${styles.rowHint}`}>{t('requests.askHint')}</span>
                    </button>
                  </li>
                )}
                {(requests ?? []).map(request => (
                  <li key={request.id} className={sourceStyles.source}>
                    <div className={sourceStyles.head}>
                      <SourceAvatar sourceId="" sourceName={request.source.name} size={44} />
                      <span className={sourceStyles.identity}>
                        <span className={`${styles.rowLabel} ${sourceStyles.name}`}>{request.source.name}</span>
                        <span className={`${sourceStyles.status} ${sourceStyles.idle}`}>
                          <span className={sourceStyles.dot} aria-hidden="true" />
                          {(request.source.domains[0] ?? new URL(request.source.url).hostname).toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <div className={sourceStyles.tags}>
                      <Chip tone="warning" size="capsule" label={t('requests.pendingLabel')}>
                        {t('requests.pending').toUpperCase()}
                      </Chip>
                    </div>
                  </li>
                ))}
              </ul>
            </Accordion>
          )}
          {groups.map(
            group =>
              (group.sources.length > 0 || (group.add && addCard)) && (
                <Accordion
                  key={group.id}
                  title={group.title}
                  count={group.sources.length}
                  open={opened.includes(group.id)}
                  onToggle={() => toggle(group.id)}
                  action={
                    chosen === 'low' &&
                    group.sources.length > 0 && (
                      <Button look="danger" compact icon={EyeOff} onClick={() => hideLow(group.sources)}>
                        {t('sources.hideAll')}
                      </Button>
                    )
                  }
                >
                  {/* Sites: one "add" card per topic, which opens on it; a row above for any other topic. Channels,
                      or no site yet: one card for them all. */}
                  {group.id === 'mine' && addCard && !chosenTopic && group.sources.length > 0 && (
                    <button
                      type="button"
                      className={sourceStyles.addRow}
                      data-tour="add-source"
                      onClick={() => setAdding({ topicId: chosenTopic, replacing: null })}
                    >
                      <Plus size={16} aria-hidden="true" />
                      {t(group.sources.length > 0 ? 'sources.addOther' : 'settings.addSource.title')}
                    </button>
                  )}
                  {byTopic(group.sources).map((section, index, sections) => {
                    // No site yet: the card opens on the topic filtered on, if any.
                    const empty = section.id === 'empty'
                    const topic = topics.find(candidate => candidate.id === (empty ? chosenTopic : section.id))
                    const add =
                      group.add && addCard && (group.id === 'mine' && !empty ? topic : index === 0) ? group.add : null
                    return (
                      <div key={section.id}>
                        {sections.length > 1 && (
                          <DaySeparator
                            label={section.label}
                            count={section.sources.length}
                            unit="source"
                            first={index === 0}
                          />
                        )}
                        <ul className={sourceStyles.grid}>
                          {add && (
                            <li>
                              <button
                                type="button"
                                className={sourceStyles.addCard}
                                data-tour={group.id === 'mine' && empty ? 'add-source' : undefined}
                                aria-label={
                                  topic ? t('sources.addIn', { label: add.label, topic: topic.label }) : add.label
                                }
                                onClick={() => setAdding({ topicId: topic?.id ?? null, replacing: null })}
                              >
                                <span className={sourceStyles.head}>
                                  <span className={sourceStyles.addMark} aria-hidden="true">
                                    <Plus size={18} />
                                  </span>
                                  <span className={`${styles.rowLabel} ${sourceStyles.name}`}>{add.label}</span>
                                </span>
                                {topic && (
                                  <span className={sourceStyles.tags}>
                                    <TopicCapsule topicId={topic.id} label={topic.label} href={null} />
                                  </span>
                                )}
                                <span className={`${sourceStyles.foot} ${styles.rowHint}`}>{add.hint}</span>
                              </button>
                            </li>
                          )}
                          {section.sources.map(card)}
                        </ul>
                      </div>
                    )
                  })}
                </Accordion>
              )
          )}
        </AccordionGroup>
      )}

      {/* Changing a source's topics happens in a dialog, as every action in Réglages. */}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? t('sources.topicsOf', { name: editing.name }) : ''}
        intro={editing && <RichText i18nKey="dialogIntro.sourceTopics" values={{ name: editing.name }} />}
      >
        {editing && (
          <>
            <TopicField
              topics={topics}
              selected={editing.topicIds}
              onChange={topicIds => setEditing({ ...editing, topicIds })}
              label={t('sources.topicsOf', { name: editing.name })}
            />
            <DialogActions>
              <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button look="primary" busy={saving} disabled={editing.topicIds.length === 0} onClick={saveTopics}>
                {t('common.save')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <AskSourceDialog open={asking} onClose={() => setAsking(false)} />

      <AddSourceDialog
        topics={topics}
        request={adding}
        onClose={() => setAdding(null)}
        onAdded={added}
        onUnauthorized={onUnauthorized}
      />
    </SectionPage>
  )
}

export default SourcesSection
