import React, { useState } from 'react';
import { HelpCircle, Lock, LogIn, User, UserPlus } from 'lucide-react';
import type { AuthUser } from '../types';

type AuthMode = 'login' | 'register';

type AuthScreenProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('注册成功，立即登录吧！');
  const [messageTone, setMessageTone] = useState<'warm' | 'error'>('warm');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = mode === 'login' ? '登 录' : '注册账号';
  const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessageTone('warm');
    setMessage(mode === 'login' ? '正在校验账号...' : '正在创建账号...');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => null) as { user?: AuthUser; error?: string } | null;

      if (!response.ok || !data?.user) {
        setMessageTone('error');
        setMessage(data?.error ?? '操作失败，请稍后重试。');
        return;
      }

      setMessage(mode === 'login' ? '登录成功，正在打开手帐...' : '注册成功，正在打开手帐...');
      onAuthenticated(data.user);
    } catch (error) {
      console.error('Auth request failed.', error);
      setMessageTone('error');
      setMessage('网络连接异常，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    const nextMode = mode === 'login' ? 'register' : 'login';
    setMode(nextMode);
    setMessageTone('warm');
    setMessage(nextMode === 'login' ? '注册成功，立即登录吧！' : '创建一个自己的墨迹手帐账号。');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F4F1EA] text-[#4A3B32] font-sans antialiased">
      <header className="bg-[#FAF8F5] border-b border-[#EADFC9] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5A2B] text-amber-50 flex items-center justify-center font-serif text-xl font-bold shadow-sm border border-[#704822] flex-shrink-0">
                墨
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-base md:text-lg font-black text-[#5c4033] tracking-wide flex items-center gap-2 whitespace-nowrap">
                  每日计划与复盘
                  <span className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-widest text-[#8B5A2B] bg-[#FAF1E3] border border-[#E8DCC4] py-0.5 px-2 rounded-full">
                    Cognitive Tracker
                  </span>
                </h1>
                <p className="text-[11px] text-stone-500 font-serif leading-snug mt-1 truncate">「预估安排」与「真实经过」的认知对照</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-[#FAF8F5] border-l-4 border-[#DE6B48] rounded-r-xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
          <h3 className="font-serif text-sm font-bold text-[#DE6B48] flex items-center gap-1.5">
            💡 行动力不足的真正原因，是选择模糊
          </h3>
          <p className="text-xs text-stone-600 font-serif leading-relaxed mt-2 break-words">
            大部分人的时间焦虑并非来源于忙碌，而是因为“对自我时间的预估偏差”。每次低估写作任务耗时、多睡20分钟引起链条延误，都是校准的机会。
          </p>
        </div>

        <section className="mx-auto mt-8 sm:mt-10 w-full max-w-md bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-3xl shadow-md relative overflow-hidden">
          <div
            className="px-6 py-8 sm:px-8 sm:py-9"
            style={{
              backgroundImage: 'radial-gradient(#F0E6D2 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <div className="pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full bg-white/40" />
            <div className="relative text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#8B5A2B] text-amber-50 flex items-center justify-center font-serif text-2xl font-bold shadow-sm border border-[#704822]">
                启
              </div>
              <h2 className="mt-4 font-serif text-2xl font-black text-[#5c4033] tracking-wide">
                {mode === 'login' ? '账号登录 · 墨迹手帐' : '注册账号 · 墨迹手帐'}
              </h2>
              <p className="mt-2 text-xs text-stone-500 font-serif tracking-widest">时间精确预测与认知偏差校准系统</p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-7 space-y-5">
              <div
                className={`rounded-xl border px-3 py-3 text-xs font-serif font-bold flex items-center gap-2 ${
                  messageTone === 'error'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-amber-300 bg-amber-50 text-[#8B5A2B]'
                }`}
              >
                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>

              <label className="block">
                <span className="block text-xs font-serif font-bold text-[#8B5A2B] mb-2">用户登录名</span>
                <div className="flex items-center gap-2 rounded-xl border border-[#E8DCC4] bg-white px-3 py-2.5 focus-within:border-[#8B5A2B] transition-colors">
                  <User className="w-4 h-4 text-stone-400" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#4A3B32] outline-hidden placeholder:text-stone-400"
                    placeholder="请输入用户名..."
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-xs font-serif font-bold text-[#8B5A2B] mb-2">账户密码</span>
                <div className="flex items-center gap-2 rounded-xl border border-[#E8DCC4] bg-white px-3 py-2.5 focus-within:border-[#8B5A2B] transition-colors">
                  <Lock className="w-4 h-4 text-stone-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#4A3B32] outline-hidden placeholder:text-stone-400"
                    placeholder="请输入安全密码..."
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full cursor-pointer flex items-center justify-center gap-2 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-4 py-3 rounded-xl text-sm font-sans font-bold shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isSubmitting ? '处理中...' : submitLabel}
              </button>
            </form>

            <div className="relative mt-7 border-t border-[#E8DCC4] pt-5 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="cursor-pointer text-xs font-serif text-[#8B5A2B] hover:text-amber-800"
              >
                {mode === 'login' ? '还没有账号？点击此处免费注册' : '已有账号？返回登录'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
