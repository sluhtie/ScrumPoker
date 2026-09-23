'use client';
// Full navigation resets the browser-local room view when entering or leaving a room.
/* oxlint-disable next/no-html-link-for-pages */
// These local avatars are already optimized to 256px WebP (8–13 KB each).
/* oxlint-disable next/no-img-element */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Menu } from '@base-ui/react/menu';
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
  Pencil,
  UserMinus,
  LockKeyhole,
  ChevronDown,
} from 'lucide-react';
import {
  AVATARS,
  AVATAR_KEY,
  DEFAULT_AVATAR,
  avatarImage,
  savedAvatar,
  type AvatarId,
} from '../lib/avatars';
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
  avatar?: AvatarId;
  vote: string | null;
  voted: boolean;
  spectator: boolean;
  observerLocked?: boolean;
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
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
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
  onEdit,
  onModerate,
  busy = false,
}: {
  player: Player;
  room: PublicRoom;
  style?: CSSProperties;
  onEdit?: () => void;
  onModerate?: (data: Record<string, unknown>) => void;
  busy?: boolean;
}) {
  const { t } = useLanguage();
  const NameTag = onEdit ? 'button' : 'div';
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const canModerate =
    room.you === room.hostId && player.id !== room.hostId && !!onModerate;
  const nameContent = (
    <>
      <img
        className="avatar"
        src={avatarImage(player.avatar)}
        alt=""
        width={32}
        height={32}
      />
      <span className="player-name">
        {player.name}
        {player.id === room.you ? ` · ${t('you')}` : ''}
      </span>
      {player.id === room.hostId && <Crown size={12} aria-label={t('host')} />}
    </>
  );
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
      {canModerate ? (
        <Menu.Root
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (!open) setConfirmRemove(false);
          }}
        >
          <Menu.Trigger
            className="name-pill manageable-seat"
            aria-label={t('manageParticipant', { name: player.name })}
            title={player.name}
          >
            {nameContent}
            <ChevronDown className="seat-menu-chevron" size={12} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="center"
              sideOffset={8}
              className="seat-menu-positioner"
            >
              <Menu.Popup
                className="seat-menu"
                aria-label={t('manageParticipant', { name: player.name })}
              >
                <div className="seat-menu-heading">
                  <strong>{player.name}</strong>
                  <span>{player.spectator ? t('observer') : t('voter')}</span>
                </div>
                {confirmRemove ? (
                  <>
                    <p className="seat-menu-confirm">
                      {t('removeMemberConfirm', { name: player.name })}
                    </p>
                    <Menu.Item
                      className="seat-menu-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('cancel')}
                    </Menu.Item>
                  </>
                ) : (
                  <Menu.Item
                    className="seat-menu-item"
                    disabled={busy}
                    onClick={() =>
                      onModerate?.({
                        type: 'setObserver',
                        id: player.id,
                        value: !player.observerLocked,
                      })
                    }
                  >
                    <Eye size={16} />
                    {player.observerLocked
                      ? t('allowVoting')
                      : t('makeObserver')}
                  </Menu.Item>
                )}
                <Menu.Item
                  className="seat-menu-item seat-menu-danger"
                  disabled={busy}
                  closeOnClick={confirmRemove}
                  onClick={() => {
                    if (confirmRemove)
                      onModerate?.({ type: 'removeMember', id: player.id });
                    else setConfirmRemove(true);
                  }}
                >
                  <UserMinus size={16} />
                  {t('removeMember')}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ) : (
        <NameTag
          className="name-pill"
          title={onEdit ? t('changeAvatar') : player.name}
          onClick={onEdit}
          aria-label={
            onEdit ? `${t('changeAvatar')} · ${player.name}` : undefined
          }
          aria-haspopup={onEdit ? 'dialog' : undefined}
        >
          {nameContent}
        </NameTag>
      )}
    </div>
  );
}
function AvatarDialog({
  value,
  busy = false,
  error,
  onClose,
  onSave,
}: {
  value: AvatarId;
  busy?: boolean;
  error?: ReactNode;
  onClose: () => void;
  onSave: (value: AvatarId) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value);
  return (
    <Modal title={t('chooseAvatar')} onClose={onClose}>
      <p className="avatar-hint">{t('avatarHint')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <fieldset className="avatar-grid" disabled={busy}>
          <legend className="sr-only">{t('chooseAvatar')}</legend>
          {AVATARS.map((id) => (
            <label
              className="avatar-option"
              key={id}
              aria-label={t(`avatar${id}`)}
            >
              <input
                type="radio"
                name="avatar"
                value={id}
                checked={draft === id}
                onChange={() => setDraft(id)}
              />
              <span className="avatar-tile">
                <img src={avatarImage(id)} alt="" width={112} height={112} />
                <span className="avatar-check" aria-hidden="true">
                  <Check size={14} />
                </span>
                <span>{t(`avatar${id}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error}
        <div className="modal-actions">
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={onClose}
          >
            {t('cancel')}
          </button>
          <button className="primary" disabled={busy}>
            {t('save')}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
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
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [title, setTitle] = useState('Sprint Planning');
  const [entry, setEntry] = useState<'create' | 'join'>('create');
  const [createSettings, setCreateSettings] =
    useState<Settings>(DEFAULT_SETTINGS);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [token, setToken] = useState('');
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [accessEnded, setAccessEnded] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [story, setStory] = useState('');
  const [estimate, setEstimate] = useState('');
  const [toast, setToast] = useState<MessageKey | ''>('');
  const [loaded, setLoaded] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [modal, setModal] = useState<'settings' | 'invite' | 'avatar' | null>(
    null,
  );
  const sequence = useRef(0);
  const mutating = useRef(false);
  const roomRef = useRef<PublicRoom | null>(null);
  const endAccess = useCallback(() => {
    roomRef.current = null;
    setRoom(null);
    setModal(null);
    setAccessEnded(true);
  }, []);
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
    try {
      setToken(localStorage.getItem(key(c)) || '');
      setAvatar(savedAvatar(localStorage.getItem(AVATAR_KEY)));
    } catch {
      /* The in-session profile still works when storage is disabled. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!code || !token || accessEnded) return;
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
          if (alive && seq === sequence.current) {
            if ((e as Error).message === 'REJOIN_REQUIRED') {
              endAccess();
              return;
            }
            setConnectionError((e as Error).message);
          }
        }
      }
      if (alive) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code, token, accessEnded, endAccess]);
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
      if ((e as Error).message === 'REJOIN_REQUIRED') endAccess();
      else setError((e as Error).message);
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
        avatar,
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
        avatar,
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
  function moderate(data: Record<string, unknown>) {
    void act(data, () =>
      setToast(
        data.type === 'removeMember' ? 'memberRemoved' : 'permissionsSaved',
      ),
    );
  }
  function openSettings() {
    if (!room) return;
    setError('');
    setModal('settings');
  }
  function rememberAvatar(value: AvatarId) {
    setAvatar(value);
    try {
      localStorage.setItem(AVATAR_KEY, value);
    } catch {
      /* Optional device preference. */
    }
  }
  function openAvatar() {
    setError('');
    setModal('avatar');
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

  if (accessEnded)
    return (
      <div className="app">
        <header className="topbar">
          <Brand />
          <LanguageSelector />
        </header>
        <main className="entry-page">
          <div className="entry-card access-ended">
            <UserMinus size={36} aria-hidden="true" />
            <h1>{t('sessionEnded')}</h1>
            <p className="muted">{t('sessionEndedHint')}</p>
            <a className="text-link" href="/">
              {t('back')}
            </a>
          </div>
        </main>
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
                  <div className="profile-entry">
                    <button
                      type="button"
                      className="avatar-trigger"
                      onClick={openAvatar}
                      aria-label={t('chooseAvatar')}
                      title={t('chooseAvatar')}
                      aria-haspopup="dialog"
                    >
                      <img
                        src={avatarImage(avatar)}
                        alt=""
                        width={64}
                        height={64}
                      />
                      <span className="avatar-edit" aria-hidden="true">
                        <Pencil size={12} />
                      </span>
                    </button>
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
                  </div>
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
        {modal === 'avatar' && (
          <AvatarDialog
            value={avatar}
            onClose={() => setModal(null)}
            onSave={(value) => {
              rememberAvatar(value);
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
                    onModerate={host ? moderate : undefined}
                    busy={busy}
                    onEdit={player.id === room.you ? openAvatar : undefined}
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
                <Seat
                  key={player.id}
                  player={player}
                  room={room}
                  onModerate={host ? moderate : undefined}
                  busy={busy}
                />
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
                disabled={busy || room.revealed || me?.observerLocked}
                title={
                  me?.observerLocked
                    ? t('observerLocked')
                    : room.revealed
                      ? t('modeNextRound')
                      : t('observerMode')
                }
                onClick={() =>
                  void act({ type: 'spectator', value: !me?.spectator })
                }
              >
                <Eye size={16} />
                <span>{t('watch')}</span>
              </button>
            </div>
            {me?.observerLocked && (
              <output className="observer-lock-note">
                <LockKeyhole size={14} />
                {t('observerLocked')}
              </output>
            )}
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
      {modal === 'avatar' && (
        <AvatarDialog
          value={savedAvatar(me?.avatar)}
          busy={busy}
          error={errorBox}
          onClose={() => setModal(null)}
          onSave={(value) =>
            void act({ type: 'avatar', avatar: value }, () => {
              rememberAvatar(value);
              setModal(null);
              setToast('avatarSaved');
            })
          }
        />
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
