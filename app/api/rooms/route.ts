import { createRoom } from '../../../server/game';
import { insert } from '../../../server/db';
import { body, json, failure, origin } from '../../../server/http';
export async function POST(request: Request) {
  try {
    origin(request);
    const input = await body(request);
    const { room, token } = createRoom(input.name, input.title, input.settings);
    await insert(room);
    return json({ code: room.code, token }, 201);
  } catch (e) {
    return failure(e);
  }
}
