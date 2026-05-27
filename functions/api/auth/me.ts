import { getCurrentUser, type Env } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/entries';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getCurrentUser(request, env.DB);
    if (!user) {
      return jsonResponse({ user: null }, { status: 401 });
    }

    return jsonResponse({ user });
  } catch (error) {
    console.error('Failed to read current user:', error);
    return jsonResponse({ error: '读取登录状态失败，请刷新重试。' }, { status: 500 });
  }
};
