import {
  createUserSession,
  normalizeUsername,
  registerUser,
  validatePassword,
  validateUsername,
  type Env,
} from '../../_lib/auth';
import { jsonResponse } from '../../_lib/entries';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.json().catch(() => null);
  const username = normalizeUsername(payload && typeof payload === 'object' ? (payload as { username?: unknown }).username : null);
  const password = payload && typeof payload === 'object' ? (payload as { password?: unknown }).password : null;
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);

  if (usernameError || passwordError) {
    return jsonResponse({ error: usernameError ?? passwordError }, { status: 400 });
  }

  try {
    const user = await registerUser(env.DB, username, password as string);
    const cookie = await createUserSession(env.DB, user.id, request);

    return jsonResponse(
      { user },
      {
        headers: {
          'Set-Cookie': cookie,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      return jsonResponse({ error: '这个用户名已经被注册。' }, { status: 409 });
    }

    console.error('Failed to register user:', error);
    return jsonResponse({ error: '注册失败，请稍后重试。' }, { status: 500 });
  }
};
