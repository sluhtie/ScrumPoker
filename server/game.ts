import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { errorText, type ErrorCode } from '../lib/i18n.ts';
import {
  DECKS,
  DEFAULT_SETTINGS,
  estimateValues,
  getDeck,
  isValidCustomDeck,
  deckChanged,
  type Settings,
} from '../lib/poker.ts';
export const DECK = DECKS.fibonacci.values;
export type Member = {
  id: string;
  name: string;
  secret: string;
  vote: string | null;
  spectator: boolean;
};
export type Story = { id: string; title: string; estimate: string | null };
export type Room = {
  code: string;
  title: string;
  hostId: string;
  members: Member[];
  stories: Story[];
  activeId: string | null;
  revealed: boolean;
  round: number;
  createdAt: string;
  settings: Settings;
};
export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    public status = 400,
  ) {
    super(errorText('en', code));
  }
}
export const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function clean(
  value: unknown,
  max: number,
  label: 'Name' | 'Raumname' | 'Story',
) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new GameError(
      label === 'Name'
        ? 'INVALID_NAME'
        : label === 'Raumname'
          ? 'INVALID_ROOM_TITLE'
          : 'INVALID_STORY_TITLE',
    );
  return value.trim();
}
export function member(name: unknown) {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    member: {
      id: randomUUID(),
      name: clean(name, 32, 'Name'),
      secret: hash(token),
      vote: null,
      spectator: false,
    } as Member,
  };
}
export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new GameError('INVALID_SETTINGS');
  const input = value as Record<string, unknown>;
  if (
    typeof input.deck !== 'string' ||
    (input.deck !== 'custom' && !Object.hasOwn(DECKS, input.deck)) ||
    typeof input.autoReveal !== 'boolean' ||
    typeof input.showAverage !== 'boolean'
  )
    throw new GameError('INVALID_SETTINGS');
  if (input.deck === 'custom' && !isValidCustomDeck(input.customDeck))
    throw new GameError('INVALID_CUSTOM_DECK');
  return {
    deck: input.deck as Settings['deck'],
    ...(input.deck === 'custom'
      ? {
          customDeck: (input.customDeck as string[]).map((v) =>
            v.trim().normalize('NFC'),
          ),
        }
      : {}),
    autoReveal: input.autoReveal,
    showAverage: input.showAverage,
  };
}
export function createRoom(name: unknown, title: unknown, options?: unknown) {
  const settings =
    options === undefined ? { ...DEFAULT_SETTINGS } : validateSettings(options);
  const joined = member(name);
  const room: Room = {
    code: randomBytes(6).toString('hex').toUpperCase(),
    title: clean(title, 80, 'Raumname'),
    hostId: joined.member.id,
    members: [joined.member],
    stories: [],
    activeId: null,
    revealed: false,
    round: 1,
    createdAt: new Date().toISOString(),
    settings,
  };
  return { room, token: joined.token };
}
export function normalizeRoom(room: Room) {
  room.settings = { ...DEFAULT_SETTINGS, ...room.settings };
  room.members.forEach((m) => {
    m.spectator ??= false;
  });
  return room;
}
export function authenticate(room: Room, token: string) {
  normalizeRoom(room);
  const user = room.members.find((m) => m.secret === hash(token));
  if (!user) throw new GameError('REJOIN_REQUIRED', 401);
  return user;
}
export function view(room: Room, user: Member) {
  normalizeRoom(room);
  return {
    ...room,
    members: room.members.map(({ secret: _secret, ...m }) => ({
      ...m,
      voted: m.vote !== null,
      vote: room.revealed || m.id === user.id ? m.vote : null,
    })),
    you: user.id,
  };
}
export function action(
  room: Room,
  user: Member,
  input: Record<string, unknown>,
) {
  normalizeRoom(room);
  const type = input.type;
  if (type === 'spectator') {
    if (typeof input.value !== 'boolean') throw new GameError('INVALID_MODE');
    if (room.revealed) throw new GameError('MODE_LOCKED', 409);
    user.spectator = input.value;
    user.vote = null;
    autoReveal(room);
    return;
  }
  if (type === 'vote') {
    if (user.spectator) throw new GameError('OBSERVER_CANNOT_VOTE', 403);
    if (input.round !== room.round) throw new GameError('STALE_VOTE', 409);
    if (!room.activeId || room.revealed)
      throw new GameError('VOTING_CLOSED', 409);
    if (
      input.value !== null &&
      !getDeck(room.settings).includes(input.value as string)
    )
      throw new GameError('INVALID_CARD');
    user.vote = input.value as string | null;
    autoReveal(room);
    return;
  }
  if (user.id !== room.hostId) throw new GameError('HOST_ONLY', 403);
  if (type === 'settings') {
    const title = clean(input.title, 80, 'Raumname');
    const settings = validateSettings(input);
    if (input.round !== room.round) throw new GameError('STALE_SETTINGS', 409);
    const changedDeck = deckChanged(settings, room.settings);
    if (
      changedDeck &&
      room.activeId &&
      !room.revealed &&
      room.members.some((m) => m.vote !== null)
    )
      throw new GameError('DECK_LOCKED', 409);
    room.title = title;
    room.settings = settings;
    if (changedDeck) reset(room);
    autoReveal(room);
    return;
  }
  if (type === 'addStory') {
    if (room.stories.length >= 100) throw new GameError('STORY_LIMIT');
    const story = {
      id: randomUUID(),
      title: clean(input.title, 200, 'Story'),
      estimate: null,
    };
    room.stories.push(story);
    if (!room.activeId) {
      room.activeId = story.id;
      reset(room);
    }
    return;
  }
  if (type === 'selectStory') {
    if (!room.stories.some((s) => s.id === input.id))
      throw new GameError('STORY_NOT_FOUND', 404);
    room.activeId = input.id as string;
    reset(room);
    return;
  }
  if (input.round !== room.round) throw new GameError('STALE_ROUND', 409);
  if (type === 'reveal') {
    if (!room.activeId || !room.members.some((m) => m.vote !== null))
      throw new GameError('NO_VOTES');
    room.revealed = true;
    return;
  }
  if (type === 'reset') {
    reset(room);
    return;
  }
  if (type === 'estimate') {
    if (!room.revealed) throw new GameError('REVEAL_FIRST');
    if (
      typeof input.value !== 'string' ||
      !estimateValues(room.settings).includes(input.value)
    )
      throw new GameError('INVALID_ESTIMATE');
    const story = room.stories.find((s) => s.id === room.activeId);
    if (!story) throw new GameError('NO_ACTIVE_STORY');
    story.estimate = input.value;
    return;
  }
  throw new GameError('UNKNOWN_ACTION');
}
function reset(room: Room) {
  room.round++;
  room.revealed = false;
  room.members.forEach((m) => (m.vote = null));
}

function autoReveal(room: Room) {
  const voters = room.members.filter((m) => !m.spectator);
  if (
    !room.revealed &&
    room.activeId &&
    room.settings.autoReveal &&
    voters.length > 0 &&
    voters.every((m) => m.vote !== null)
  )
    room.revealed = true;
}
