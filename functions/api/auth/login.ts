import {
  createUserSession,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyLogin,
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
    return jsonResponse({ error: '用户名或密码不正确。' }, { status: 400 });
  }

  try {
    const user = await verifyLogin(env.DB, username, password as string);
    if (!user) {
      return jsonResponse({ error: '用户名或密码不正确。' }, { status: 401 });
    }

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
    console.error('Failed to login user:', error);
    return jsonResponse({ error: '登录失败，请稍后重试。' }, { status: 500 });
  }
};
