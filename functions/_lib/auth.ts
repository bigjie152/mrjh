export type Env = {
  DB: D1Database;
};

export type AuthUser = {
  id: string;
  username: string;
};

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response };

const SESSION_COOKIE = 'mrjh_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const LEGACY_USER_ID = '__legacy__';

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bytesToHex(buffer);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: 120_000,
    },
    key,
    256,
  );

  return bytesToHex(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || rawValue.length === 0) return;
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  });

  return cookies;
}

function isHttpsRequest(request: Request) {
  return new URL(request.url).protocol === 'https:';
}

export function sessionCookie(token: string, request: Request) {
  const secure = isHttpsRequest(request) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = isHttpsRequest(request) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function normalizeUsername(username: unknown) {
  return typeof username === 'string' ? username.trim() : '';
}

export function validateUsername(username: string) {
  if (username.length < 2 || username.length > 24) {
    return '用户名需要是 2-24 个字符。';
  }

  if (/\s/.test(username)) {
    return '用户名中不能包含空格。';
  }

  return null;
}

export function validatePassword(password: unknown) {
  if (typeof password !== 'string') return '密码不能为空。';
  if (password.length < 6) return '密码至少需要 6 位。';
  if (password.length > 72) return '密码长度不能超过 72 位。';
  return null;
}

export async function createUserSession(db: D1Database, userId: string, request: Request) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;

  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(tokenHash, userId, now, expiresAt)
    .run();

  return sessionCookie(token, request);
}

export async function registerUser(db: D1Database, username: string, password: string) {
  const userId = `usr_${randomHex(12)}`;
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const userCount = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  const shouldClaimLegacyEntries = (userCount?.count ?? 0) === 0;

  await db
    .prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, updated_at)
       VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)`,
    )
    .bind(userId, username, passwordHash, salt)
    .run();

  if (shouldClaimLegacyEntries) {
    await db.prepare('UPDATE daily_entries SET user_id = ?1 WHERE user_id = ?2').bind(userId, LEGACY_USER_ID).run();
  }

  return { id: userId, username };
}

export async function verifyLogin(db: D1Database, username: string, password: string): Promise<AuthUser | null> {
  const user = await db
    .prepare('SELECT id, username, password_hash, password_salt FROM users WHERE username = ?1 COLLATE NOCASE')
    .bind(username)
    .first<{ id: string; username: string; password_hash: string; password_salt: string }>();

  if (!user) return null;

  const passwordHash = await hashPassword(password, user.password_salt);
  if (!timingSafeEqual(passwordHash, user.password_hash)) return null;

  return { id: user.id, username: user.username };
}

export async function getCurrentUser(request: Request, db: D1Database): Promise<AuthUser | null> {
  const token = parseCookies(request.headers.get('Cookie')).get(SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT users.id, users.username
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2`,
    )
    .bind(tokenHash, now)
    .first<AuthUser>();

  return row ?? null;
}

export async function deleteCurrentSession(request: Request, db: D1Database) {
  const token = parseCookies(request.headers.get('Cookie')).get(SESSION_COOKIE);
  if (!token) return;

  const tokenHash = await sha256Hex(token);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
}

export async function requireUser(request: Request, db: D1Database): Promise<AuthResult> {
  const user = await getCurrentUser(request, db);
  if (user) return { ok: true, user };

  return {
    ok: false,
    response: Response.json(
      { error: '请先登录账号。' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    ),
  };
}
