import { deleteCurrentSession, expiredSessionCookie, type Env } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/entries';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await deleteCurrentSession(request, env.DB);
    return jsonResponse(
      { success: true },
      {
        headers: {
          'Set-Cookie': expiredSessionCookie(request),
        },
      },
    );
  } catch (error) {
    console.error('Failed to logout user:', error);
    return jsonResponse({ error: '退出登录失败，请稍后重试。' }, { status: 500 });
  }
};
