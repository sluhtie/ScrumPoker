import {
  action,
  authenticate,
  member,
  view,
  GameError,
} from '../../../../server/game';
import { read, mutate } from '../../../../server/db';
import { body, json, failure, origin, token } from '../../../../server/http';
const codeFrom = (r: Request) =>
  new URL(r.url).pathname.split('/').pop()!.toUpperCase();
export async function GET(request: Request) {
  try {
    const room = await read(codeFrom(request));
    return json(view(room, authenticate(room, token(request))));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    origin(request);
    const input = await body(request);
    return json(
      await mutate(codeFrom(request), (room) => {
        if (input.type === 'join') {
          if (room.members.length >= 30) throw new GameError('ROOM_FULL');
          const joined = member(input.name);
          room.members.push(joined.member);
          return { token: joined.token, room: view(room, joined.member) };
        }
        const user = authenticate(room, token(request));
        action(room, user, input);
        return { room: view(room, user) };
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
