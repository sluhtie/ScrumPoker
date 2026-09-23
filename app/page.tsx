import PokerApp from './poker-app';
import { shareMetadata, shareOrigin, shareRoomCode } from '../lib/share';
import { readShareTitle } from '../server/db';

// Resolve room invitations and the deployment origin at request time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const invitation = query.room !== undefined;
  const code = shareRoomCode(query.room);
  let title: string | null = null;
  if (code) {
    try {
      title = await readShareTitle(code);
    } catch {
      // An unavailable database must not prevent the room UI from loading.
      // The generic invitation never exposes connection details or room state.
    }
  }
  return shareMetadata(shareOrigin(), invitation, code, title);
}

export default function Page() {
  return <PokerApp />;
}
