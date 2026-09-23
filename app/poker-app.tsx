'use client';
// Full navigation resets the browser-local room view when entering or leaving a room.
/* oxlint-disable next/no-html-link-for-pages */
import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import {
  ArrowRight,
  Plus,
  Users,
  SlidersHorizontal,
  X,
  Eye,
  RotateCcw,
  Check,
  List,
  Copy,
  Crown,
  ChevronRight,
  Diamond,
} from 'lucide-react';
import type { Room } from '../server/game';
import { LanguageSelector, useLanguage } from './language';
import { errorText, type MessageKey } from '../lib/i18n';
import {
  DECKS,
  DEFAULT_SETTINGS,
  estimateValues,
  getDeck,
  CUSTOM_DECK_START,
  isValidCustomDeck,
  isNumericDeck,
  numericCard,
  deckChanged,
  type Settings,
} from '../lib/poker';

type Player = {
  id: string;
  name: string;
  vote: string | null;
  voted: boolean;
  spectator: boolean;
};
type PublicRoom = Omit<Room, 'members'> & { you: string; members: Player[] };
async function request<T = { code: string; token: string; room: PublicRoom }>(
  path: string,
  token: string,
  data?: unknown,
) {
  const response = await fetch(path, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = (await response.json()) as T & {
    error?: string;
    code?: string;
  };
  if (!response.ok) throw new Error(result.code || 'CONNECTION_FAILED');
  return result as T;
}
const key = (code: string) => `planning-club:${code}`;
function Brand() {
  const { t } = useLanguage();
  return (
    <a className="brand" href="/" aria-label={t('home')}>
      <span className="brand-mark">
        <Diamond size={20} strokeWidth={2.5} />
      </span>
      planning<span>club</span>
    </a>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label={t('close')}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Seat({
  player,
  room,
  style,
}: {
  player: Player;
  room: PublicRoom;
  style?: CSSProperties;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`seat ${player.id === room.you ? 'own-seat' : ''}`}
      style={style}
    >
      {player.spectator ? (
        <div className="seat-observer" title={t('observer')}>
          <Eye size={22} />
        </div>
      ) : (
        <div
          className={`seat-card ${player.voted ? 'has-vote' : ''} ${room.revealed && player.voted ? 'is-revealed' : ''}`}
          aria-label={
            room.revealed
              ? `${player.name}: ${player.vote ?? t('noVote')}`
              : `${player.name}: ${player.voted ? t('voted') : t('waiting')}`
          }
        >
          <div className="card-inner">
            <span className="card-back">
              {player.voted ? <Diamond size={20} /> : '·'}
            </span>
            <span
              className={`card-front ${(player.vote?.length ?? 0) > 3 ? 'long-label' : ''}`}
            >
              {player.vote ?? '–'}
            </span>
          </div>
        </div>
      )}
      <div className="name-pill" title={player.name}>
        <span className="avatar">{player.name.slice(0, 1).toUpperCase()}</span>
        <span className="player-name">
          {player.name}
          {player.id === room.you ? ` · ${t('you')}` : ''}
        </span>
        {player.id === room.hostId && (
          <Crown size={12} aria-label={t('host')} />
        )}
      </div>
    </div>
  );
}
function SettingsDialog({
  settings,
  roomTitle,
  deckLocked = false,
  readOnly = false,
  busy = false,
  error,
  onClose,
  onSave,
}: {
  settings: Settings;
  roomTitle?: string;
  deckLocked?: boolean;
  readOnly?: boolean;
  busy?: boolean;
  error?: ReactNode;
  onClose: () => void;
  onSave: (settings: Settings, title: string) => void;
}) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState<Settings>(() => ({
    ...settings,
    customDeck: settings.customDeck?.slice(),
  }));
  const [title, setTitle] = useState(roomTitle ?? '');
  const [customText, setCustomText] = useState(
    (settings.customDeck ?? CUSTOM_DECK_START).join(', '),
  );
  const valid = draft.deck !== 'custom' || isValidCustomDeck(draft.customDeck);
  const locked = readOnly || deckLocked;
  return (
    <Modal title={t('settings')} onClose={onClose}>
      {error}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(draft, title);
        }}
      >
        {roomTitle !== undefined && (
          <label>
            {t('roomName')}
            <input
              value={title}
              maxLength={80}
              required
              disabled={readOnly}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        )}
        <label>
          {t('cardDeck')}
          <select
            value={draft.deck}
            disabled={locked}
            onChange={(e) => {
              const deck = e.target.value as Settings['deck'];
              setDraft({
                ...draft,
                deck,
                ...(deck === 'custom'
                  ? {
                      customDeck: customText
                        .split(/[,;\n]/)
                        .map((v) => v.trim().normalize('NFC')),
                    }
                  : {}),
              });
            }}
          >
            {[...Object.keys(DECKS), 'custom'].map((id) => (
              <option key={id} value={id}>
                {t(id as Settings['deck'])}
              </option>
            ))}
          </select>
        </label>
        {draft.deck === 'custom' && (
          <div className="custom-deck-editor">
            <label>
              {t('customCards')}
              <textarea
                value={customText}
                maxLength={200}
                disabled={locked}
                aria-describedby="custom-deck-hint"
                aria-invalid={!valid}
                placeholder={t('customPlaceholder')}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  setDraft({
                    ...draft,
                    customDeck: e.target.value
                      .split(/[,;\n]/)
                      .map((v) => v.trim().normalize('NFC')),
                  });
                }}
              />
            </label>
            <p id="custom-deck-hint" className="setting-hint">
              {t('customHint')}
            </p>
            {!valid && (
              <p className="field-error" role="alert">
                {errorText(language, 'INVALID_CUSTOM_DECK')}
              </p>
            )}
          </div>
        )}
        <div className="deck-preview" aria-hidden="true">
          {getDeck(draft)
            .filter(Boolean)
            .slice(0, 16)
            .map((v, i) => (
              <span key={i}>{v}</span>
            ))}
        </div>
        {deckLocked && <p className="setting-hint">{t('deckLockedHint')}</p>}
        <label className="switch-row">
          <span>
            {t('autoReveal')}
            <small>{t('autoRevealHint')}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={draft.autoReveal}
            aria-checked={draft.autoReveal}
            disabled={readOnly}
            onChange={(e) =>
              setDraft({ ...draft, autoReveal: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>
            {t('showAverage')}
            {!isNumericDeck(draft) && <small>{t('numericOnly')}</small>}
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={draft.showAverage}
            aria-checked={draft.showAverage}
            disabled={readOnly || !isNumericDeck(draft)}
            onChange={(e) =>
              setDraft({ ...draft, showAverage: e.target.checked })
            }
          />
        </label>
        {roomTitle !== undefined && deckChanged(draft, settings) && (
          <p className="setting-hint">{t('deckResetHint')}</p>
        )}
        {readOnly && <p className="setting-hint">{t('hostSettingsHint')}</p>}
        <div className="modal-actions">
          <button type="button" className="quiet" onClick={onClose}>
            {t(readOnly ? 'close' : 'cancel')}
          </button>
          {!readOnly && (
            <button
              type="submit"
              className="primary"
              disabled={
                busy || !valid || (roomTitle !== undefined && !title.trim())
              }
            >
              {t('save')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
export default function Home() {
  const { language, t } = useLanguage();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('Sprint Planning');
  const [entry, setEntry] = useState<'create' | 'join'>('create');
  const [createSettings, setCreateSettings] =
    useState<Settings>(DEFAULT_SETTINGS);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [token, setToken] = useState('');
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [story, setStory] = useState('');
  const [estimate, setEstimate] = useState('');
  const [toast, setToast] = useState<MessageKey | ''>('');
  const [loaded, setLoaded] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [modal, setModal] = useState<'settings' | 'invite' | null>(null);
  const sequence = useRef(0);
  const mutating = useRef(false);
  const roomRef = useRef<PublicRoom | null>(null);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_planning_room',
            description:
              'Read the current room, settings, stories and visible votes without revealing hidden votes or tokens.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object.');
              if (!roomRef.current) throw new Error('Join a room first.');
              return roomRef.current;
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser API. */
    }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    const c =
      new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
    // Initialize the browser-only session after hydration.
    // oxlint-disable-next-line react/react-compiler
    setCode(c);
    setToken(localStorage.getItem(key(c)) || '');
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!code || !token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!mutating.current) {
        const seq = ++sequence.current;
        try {
          const value = await request<PublicRoom>(`/api/rooms/${code}`, token);
          if (alive && seq === sequence.current) {
            setRoom(value);
            setConnectionError('');
          }
        } catch (e) {
          if (alive && seq === sequence.current)
            setConnectionError((e as Error).message);
        }
      }
      if (alive) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code, token]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function perform(fn: () => Promise<void>) {
    if (mutating.current) return;
    mutating.current = true;
    sequence.current++;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sequence.current++;
      mutating.current = false;
      setBusy(false);
    }
  }
  async function enter() {
    await perform(async () => {
      if (entry === 'join') {
        location.href = `/?room=${joinCode}`;
        return;
      }
      const result = await request('/api/rooms', '', {
        name,
        title,
        settings: createSettings,
      });
      localStorage.setItem(key(result.code), result.token);
      location.href = `/?room=${result.code}`;
    });
  }
  async function join() {
    await perform(async () => {
      const result = await request(`/api/rooms/${code}`, '', {
        type: 'join',
        name,
      });
      localStorage.setItem(key(code), result.token);
      setToken(result.token);
      setRoom(result.room);
      setConnectionError('');
    });
  }
  async function act(data: Record<string, unknown>, done?: () => void) {
    await perform(async () => {
      const result = await request(`/api/rooms/${code}`, token, {
        ...data,
        round: room?.round,
      });
      setRoom(result.room);
      setConnectionError('');
      if (data.type === 'addStory') setStory('');
      done?.();
    });
  }
  function openSettings() {
    if (!room) return;
    setError('');
    setModal('settings');
  }
  const host = !!room && room.you === room.hostId;
  const active = room?.stories.find((s) => s.id === room.activeId);
  const me = room?.members.find((m) => m.id === room.you);
  const settings = room?.settings || DEFAULT_SETTINGS;
  const deck = getDeck(settings);
  const validEstimates = estimateValues(settings);
  const chosenEstimate = validEstimates.includes(estimate)
    ? estimate
    : validEstimates.includes('5')
      ? '5'
      : validEstimates[Math.floor(validEstimates.length / 2)];
  const players = room?.members.filter((m) => !m.spectator) || [];
  const votes = players.filter((m) => m.voted);
  const numeric = votes.flatMap((m) =>
    m.vote !== null && numericCard(m.vote) !== null
      ? [numericCard(m.vote)!]
      : [],
  );
  const average = numeric.length
    ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) /
      10
    : null;
  const issue = error || connectionError;
  const errorBox = issue && (
    <div className="error" role="alert">
      {errorText(language, issue)}
      {error && (
        <button
          className="icon-button"
          aria-label={t('dismissError')}
          onClick={() => setError('')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );

  if (!room)
    return (
      <div className="app">
        <header className="topbar">
          <Brand />
          <LanguageSelector />
        </header>
        <main className="entry-page">
          <div className="entry-card">
            <div className="mini-deck" aria-hidden="true">
              <span>3</span>
              <span>
                5<small>♦</small>
              </span>
              <span>8</span>
            </div>
            <h1>{code ? t('takeSeat') : t('allAtTable')}</h1>
            {!code && (
              <div className="entry-tabs">
                <button
                  aria-pressed={entry === 'create'}
                  onClick={() => setEntry('create')}
                >
                  {t('createRoom')}
                </button>
                <button
                  aria-pressed={entry === 'join'}
                  onClick={() => setEntry('join')}
                >
                  {t('join')}
                </button>
              </div>
            )}
            {errorBox}
            {code && token && !connectionError ? (
              <p className="muted">{t('loadingRoom')}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void (code ? join() : enter());
                }}
              >
                {(code || entry === 'create') && (
                  <label>
                    {t('yourName')}
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={32}
                      required
                      autoComplete="name"
                      placeholder="Alex"
                    />
                  </label>
                )}
                {!code && entry === 'create' && (
                  <label>
                    {t('roomName')}
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>
                )}
                {!code && entry === 'join' && (
                  <label>
                    {t('roomCode')}
                    <input
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-F0-9]/g, ''),
                        )
                      }
                      maxLength={12}
                      minLength={12}
                      required
                      placeholder={t('codePlaceholder')}
                      autoComplete="off"
                    />
                  </label>
                )}
                {!code && entry === 'create' && (
                  <button
                    type="button"
                    className="settings-open-button"
                    aria-haspopup="dialog"
                    onClick={() => setModal('settings')}
                  >
                    <SlidersHorizontal size={16} />
                    <span>{t('settings')}</span>
                    <ChevronRight size={16} />
                  </button>
                )}
                <button
                  className="primary full"
                  disabled={
                    !loaded ||
                    busy ||
                    (code || entry === 'create'
                      ? !name.trim() || (!code && !title.trim())
                      : joinCode.length !== 12)
                  }
                >
                  {code || entry === 'join' ? t('join') : t('openTable')}
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
            {code && (
              <a className="text-link" href="/">
                {t('back')}
              </a>
            )}
          </div>
        </main>
        {modal === 'settings' && (
          <SettingsDialog
            settings={createSettings}
            onClose={() => setModal(null)}
            onSave={(value) => {
              setCreateSettings(value);
              setModal(null);
            }}
          />
        )}
      </div>
    );

  const ordered = [
    ...room.members.filter((m) => m.id === room.you),
    ...room.members.filter((m) => m.id !== room.you),
  ];
  const visible = ordered.slice(0, 8);
  const slots = Math.max(4, visible.length);
  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        <div className="room-title">{room.title}</div>
        <div className="toolbar">
          <LanguageSelector />
          <button
            className={`quiet ${storiesOpen ? 'active' : ''}`}
            aria-label={t('stories')}
            aria-expanded={storiesOpen}
            aria-controls="story-panel"
            onClick={() => setStoriesOpen(!storiesOpen)}
          >
            <List size={18} />
            <span className="toolbar-label">{t('stories')}</span>
            <span className="count">{room.stories.length}</span>
          </button>
          <button
            className="icon-button"
            aria-label={t('settings')}
            title={t('settings')}
            onClick={openSettings}
          >
            <SlidersHorizontal size={19} />
          </button>
          <button
            className="primary invite-button"
            aria-label={t('invite')}
            onClick={() => setModal('invite')}
          >
            <Plus size={18} />
            <span className="toolbar-label">{t('invite')}</span>
          </button>
        </div>
      </header>
      {issue && !modal && <div className="page-error">{errorBox}</div>}
      <main className={`room-layout ${storiesOpen ? 'with-stories' : ''}`}>
        <section className="play-area" aria-label={t('pokerTable')}>
          <div className="table-scene">
            <div className="table-stage">
              <div className="table-rim">
                <div className="table-felt">
                  <div className="table-content">
                    {active ? (
                      <>
                        <span className="table-kicker">
                          {t('storyLabel')}{' '}
                          {String(room.stories.indexOf(active) + 1).padStart(
                            2,
                            '0',
                          )}
                        </span>
                        <h1>{active.title}</h1>
                        {room.revealed ? (
                          <>
                            <div
                              className="distribution"
                              aria-label={t('results')}
                            >
                              {deck
                                .filter((v) => votes.some((m) => m.vote === v))
                                .map((v) => (
                                  <span key={v} className="result-chip">
                                    <strong>{v}</strong>
                                    <small>
                                      ×
                                      {votes.filter((m) => m.vote === v).length}
                                    </small>
                                  </span>
                                ))}
                            </div>
                            {settings.showAverage &&
                              isNumericDeck(settings) &&
                              average !== null && (
                                <p className="table-meta">
                                  Ø {average.toLocaleString(language)}
                                </p>
                              )}
                            {active.estimate !== null && (
                              <p className="saved-estimate">
                                <Check size={14} />{' '}
                                {t('estimateSaved', { value: active.estimate })}
                              </p>
                            )}
                            {host && (
                              <div className="table-actions">
                                <button
                                  className="icon-button"
                                  aria-label={t('voteAgain')}
                                  title={t('voteAgain')}
                                  disabled={busy}
                                  onClick={() => void act({ type: 'reset' })}
                                >
                                  <RotateCcw size={17} />
                                </button>
                                <select
                                  aria-label={t('agreedEstimate')}
                                  value={chosenEstimate}
                                  onChange={(e) => setEstimate(e.target.value)}
                                >
                                  {validEstimates.map((v) => (
                                    <option key={v}>{v}</option>
                                  ))}
                                </select>
                                <button
                                  className="primary"
                                  disabled={busy}
                                  onClick={() =>
                                    void act({
                                      type: 'estimate',
                                      value: chosenEstimate,
                                    })
                                  }
                                >
                                  {t('apply')}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="table-meta">
                              {t('cardsCount', {
                                votes: votes.length,
                                total: players.length,
                              })}
                            </p>
                            {host && (
                              <button
                                className="primary reveal-button"
                                disabled={busy || !votes.length}
                                onClick={() => void act({ type: 'reveal' })}
                              >
                                {t('reveal')}
                              </button>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Diamond className="table-symbol" size={26} />
                        <h1>{t('firstRound')}</h1>
                        {host ? (
                          <form
                            className="quick-story"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void act({ type: 'addStory', title: story });
                            }}
                          >
                            <input
                              aria-label={t('firstStory')}
                              placeholder={t('storyPrompt')}
                              maxLength={200}
                              value={story}
                              onChange={(e) => setStory(e.target.value)}
                              required
                            />
                            <button
                              className="primary icon-button"
                              aria-label={t('startRound')}
                              disabled={busy || !story.trim()}
                            >
                              <ArrowRight size={19} />
                            </button>
                          </form>
                        ) : (
                          <p className="table-meta">{t('waitingForHost')}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {Array.from({ length: slots }, (_, i) => {
                const angle = Math.PI / 2 + (i * 2 * Math.PI) / slots;
                const style = {
                  left: `calc(50% + var(--seat-spread, 46%) * ${Math.cos(angle)})`,
                  top: `${50 + 46 * Math.sin(angle)}%`,
                };
                const player = visible[i];
                return player ? (
                  <Seat
                    key={player.id}
                    player={player}
                    room={room}
                    style={style}
                  />
                ) : (
                  <button
                    key={`empty-${i}`}
                    className="empty-seat"
                    style={style}
                    aria-label={t('inviteMember')}
                    onClick={() => setModal('invite')}
                  >
                    <Plus size={19} />
                  </button>
                );
              })}
            </div>
          </div>
          {ordered.length > 8 && (
            <div className="extra-seats">
              {ordered.slice(8).map((player) => (
                <Seat key={player.id} player={player} room={room} />
              ))}
            </div>
          )}
          <div className="hand">
            <div className="hand-heading">
              <span>
                {me?.spectator
                  ? t('watching')
                  : room.revealed
                    ? t('roundRevealed')
                    : me?.voted
                      ? t('cardPlaced')
                      : t('yourEstimate')}
              </span>
              <button
                className={`quiet mode-button ${me?.spectator ? 'active' : ''}`}
                aria-pressed={!!me?.spectator}
                disabled={busy || room.revealed}
                title={room.revealed ? t('modeNextRound') : t('observerMode')}
                onClick={() =>
                  void act({ type: 'spectator', value: !me?.spectator })
                }
              >
                <Eye size={16} />
                <span>{t('watch')}</span>
              </button>
            </div>
            {!me?.spectator && (
              <div className="hand-cards">
                {deck.map((value, i) => (
                  <button
                    key={value}
                    className={`vote-card ${me?.vote === value ? 'selected' : ''} ${value.length > 3 ? 'long-label' : ''}`}
                    title={value}
                    style={
                      {
                        '--tilt': `${(i - (deck.length - 1) / 2) * 1.4}deg`,
                      } as CSSProperties
                    }
                    aria-pressed={me?.vote === value}
                    aria-label={
                      value === '?'
                        ? t('unsure')
                        : value === '☕'
                          ? t('break')
                          : t('estimateCard', { value })
                    }
                    disabled={busy || room.revealed || !active}
                    onClick={() =>
                      void act({
                        type: 'vote',
                        value: me?.vote === value ? null : value,
                      })
                    }
                  >
                    <span className="card-corner">{value}</span>
                    <strong>{value}</strong>
                    <Diamond className="card-suit" size={11} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
        {storiesOpen && (
          <aside id="story-panel" className="story-panel">
            <div className="panel-heading">
              <h2>
                {t('stories')}{' '}
                <span className="muted">
                  {room.stories.filter((s) => s.estimate !== null).length}/
                  {room.stories.length}
                </span>
              </h2>
              <button
                className="icon-button"
                aria-label={t('closeStories')}
                onClick={() => setStoriesOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="story-list">
              {!room.stories.length && (
                <p className="muted">{t('noStories')}</p>
              )}
              {room.stories.map((s, i) => (
                <button
                  className={`story-item ${s.id === room.activeId ? 'active' : ''}`}
                  disabled={!host || busy || s.id === room.activeId}
                  onClick={() => void act({ type: 'selectStory', id: s.id })}
                  key={s.id}
                >
                  <span className="story-index">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{s.title}</span>
                  {s.estimate !== null ? (
                    <span className="story-estimate">{s.estimate}</span>
                  ) : (
                    <ChevronRight size={15} />
                  )}
                </button>
              ))}
            </div>
            {host && (
              <form
                className="add-story"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ type: 'addStory', title: story });
                }}
              >
                <label>
                  {t('newStory')}
                  <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    maxLength={200}
                    placeholder={t('storyTitle')}
                    required
                  />
                </label>
                <button className="quiet full" disabled={busy || !story.trim()}>
                  <Plus size={17} /> {t('add')}
                </button>
              </form>
            )}
          </aside>
        )}
      </main>
      {modal === 'invite' && (
        <Modal title={t('inviteTeam')} onClose={() => setModal(null)}>
          <label>
            {t('inviteLink')}
            <input
              readOnly
              value={typeof location === 'undefined' ? '' : location.href}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          {errorBox}
          <button
            className="primary full"
            onClick={() =>
              void perform(async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                } catch {
                  throw new Error('COPY_FAILED');
                }
                setToast('linkCopied');
                setModal(null);
              })
            }
          >
            <Copy size={17} /> {t('copyLink')}
          </button>
          <div className="invite-code">
            <Users size={16} />
            <span>{t('roomCode')}</span>
            <code>{room.code}</code>
          </div>
        </Modal>
      )}
      {modal === 'settings' && (
        <SettingsDialog
          settings={settings}
          roomTitle={room.title}
          readOnly={!host}
          deckLocked={!room.revealed && votes.length > 0}
          busy={busy}
          error={errorBox}
          onClose={() => setModal(null)}
          onSave={(value, title) =>
            void act({ type: 'settings', title, ...value }, () => {
              setModal(null);
              setToast('settingsSaved');
            })
          }
        />
      )}
      {toast && (
        <output className="toast">
          <Check size={17} />
          {toast && t(toast)}
        </output>
      )}
    </div>
  );
}
