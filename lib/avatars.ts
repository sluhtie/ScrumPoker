export const AVATARS = [
  'fox',
  'cat',
  'ghost',
  'robot',
  'frog',
  'axolotl',
] as const;
export type AvatarId = (typeof AVATARS)[number];
export const DEFAULT_AVATAR: AvatarId = 'fox';
export const AVATAR_KEY = 'planning-club:avatar';

export function isAvatar(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATARS.some((id) => id === value);
}
export function savedAvatar(value: unknown): AvatarId {
  return isAvatar(value) ? value : DEFAULT_AVATAR;
}
export function avatarImage(value: unknown) {
  return `/avatars/${savedAvatar(value)}.webp`;
}
