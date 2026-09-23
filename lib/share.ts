/** Only deployment configuration may supply the origin used in public share URLs. */
export function shareOrigin(configured = process.env.APP_ORIGIN) {
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('APP_ORIGIN is required for production share previews');
  }
  const url = new URL(configured || 'http://localhost:3000');
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'APP_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment',
    );
  }
  return url;
}

export function shareRoomCode(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{12}$/i.test(value)
    ? value.toUpperCase()
    : null;
}

export function shareMetadata(
  origin: URL,
  invitation: boolean,
  code: string | null,
  roomTitle: string | null,
) {
  const title = invitation
    ? roomTitle
      ? `Join ${roomTitle} · Planning Club`
      : 'Your seat is ready · Planning Club'
    : 'Planning Club · Scrum poker, better together';
  const description = invitation
    ? 'Your team has a seat for you. Pick a card, reveal together, and plan your next sprint. Join the planning poker room — no sign-up needed.'
    : 'Bring your team to the table. Estimate stories, reveal cards together, and find your next sprint’s rhythm. Free planning poker, no sign-up needed.';
  const url = new URL('/', origin);
  if (invitation && code) url.searchParams.set('room', code);
  const image = {
    url: new URL(invitation ? '/og-invite.png' : '/og.png', origin).href,
    type: 'image/png',
    width: 1734,
    height: 907,
    alt: invitation
      ? 'Planning Club — Your seat is ready. Join your team. Pick a card. Plan together.'
      : 'Planning Club — Everyone at the table. Scrum poker. Better together.',
  };
  return {
    metadataBase: origin,
    title,
    description,
    applicationName: 'Planning Club',
    alternates: { canonical: url.href },
    robots: { index: !invitation, follow: !invitation },
    referrer: 'strict-origin-when-cross-origin' as const,
    openGraph: {
      type: 'website' as const,
      siteName: 'Planning Club',
      locale: 'en_US',
      url: url.href,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
