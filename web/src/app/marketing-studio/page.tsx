'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

// ── helpers ───────────────────────────────────────────────────────────────

function studioFetch(path: string, key: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'x-studio-key': key, 'Content-Type': 'application/json', ...opts?.headers },
  });
}

// ── types ─────────────────────────────────────────────────────────────────

interface Block { section: string; key: string; label: string; value: string; }
interface Banner {
  id: string; text: string; link_url?: string; link_text?: string;
  bg_color: string; text_color: string; is_active: boolean;
  starts_at?: string; ends_at?: string;
}
interface Popup {
  id: string; name: string; title: string; body: string;
  cta_text?: string; cta_url?: string;
  trigger_type: string; trigger_value: number;
  target: string; dismiss_days: number; is_active: boolean;
  starts_at?: string; ends_at?: string;
}

// ── 로그인 화면 ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-black text-zinc-900 mb-1">마케팅 스튜디오</h1>
        <p className="text-sm text-zinc-500 mb-6">스튜디오 키를 입력하세요</p>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && val && onLogin(val)}
          placeholder="Studio Key"
          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => val && onLogin(val)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
        >
          입장
        </button>
      </div>
    </div>
  );
}

// ── 블록 탭 ───────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hero: '히어로 섹션', pricing: '요금제 섹션', features: '기능 섹션', cta: 'CTA 섹션',
};

function BlocksTab({ studioKey }: { studioKey: string }) {
  const [blocks, setBlocks] = useState<Record<string, Block[]>>({});
  const [dirty, setDirty] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await studioFetch('/marketing/studio/blocks', studioKey);
    if (!res.ok) { toast.error('블록 로드 실패'); return; }
    const map: Record<string, Record<string, string>> = await res.json();
    // flatten to sections
    const grouped: Record<string, Block[]> = {};
    for (const [section, keys] of Object.entries(map)) {
      grouped[section] = Object.entries(keys).map(([key, value]) => ({
        section, key, label: key, value,
      }));
    }
    setBlocks(grouped);
  }, [studioKey]);

  useEffect(() => { load(); }, [load]);

  const change = (section: string, key: string, value: string) => {
    setDirty((prev) => new Map(prev).set(`${section}.${key}`, value));
    setBlocks((prev) => ({
      ...prev,
      [section]: prev[section].map((b) => b.key === key ? { ...b, value } : b),
    }));
  };

  const save = async () => {
    setSaving(true);
    const payload = [...dirty.entries()].map(([sk, value]) => {
      const [section, ...rest] = sk.split('.');
      return { section, key: rest.join('.'), value };
    });
    const res = await studioFetch('/marketing/studio/blocks/bulk', studioKey, {
      method: 'POST',
      body: JSON.stringify({ blocks: payload }),
    });
    setSaving(false);
    if (res.ok) { toast.success('저장 완료'); setDirty(new Map()); }
    else toast.error('저장 실패');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-zinc-900">텍스트 블록</h2>
        {dirty.size > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            {saving ? '저장 중...' : `변경사항 저장 (${dirty.size})`}
          </button>
        )}
      </div>

      <div className="space-y-8">
        {Object.entries(blocks).map(([section, items]) => (
          <div key={section}>
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
              {SECTION_LABELS[section] ?? section}
            </h3>
            <div className="space-y-3">
              {items.map((block) => (
                <div key={block.key} className="bg-zinc-50 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                    {block.key}
                  </label>
                  {block.value.length > 80 ? (
                    <textarea
                      rows={3}
                      value={block.value}
                      onChange={(e) => change(section, block.key, e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={block.value}
                      onChange={(e) => change(section, block.key, e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 배너 탭 ───────────────────────────────────────────────────────────────

function BannersTab({ studioKey }: { studioKey: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState<Partial<Banner>>({
    text: '', bg_color: '#1d4ed8', text_color: '#ffffff', is_active: false,
  });
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await studioFetch('/marketing/studio/banners', studioKey);
    if (res.ok) setBanners(await res.json());
  }, [studioKey]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `/marketing/studio/banners/${editing}` : '/marketing/studio/banners';
    const res = await studioFetch(url, studioKey, { method, body: JSON.stringify(form) });
    if (res.ok) { toast.success('저장 완료'); setForm({ text: '', bg_color: '#1d4ed8', text_color: '#ffffff', is_active: false }); setEditing(null); load(); }
    else toast.error('저장 실패');
  };

  const del = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const res = await studioFetch(`/marketing/studio/banners/${id}`, studioKey, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제 완료'); load(); }
  };

  const edit = (b: Banner) => { setEditing(b.id); setForm(b); };

  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-6">사이트 배너</h2>

      {/* 폼 */}
      <div className="bg-zinc-50 rounded-2xl p-5 mb-8">
        <h3 className="text-sm font-bold text-zinc-700 mb-4">{editing ? '배너 수정' : '새 배너 추가'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500 font-medium mb-1 block">배너 텍스트 *</label>
            <input value={form.text ?? ''} onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="🎉 신규 가입 시 1개월 무료" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">링크 URL</label>
            <input value={form.link_url ?? ''} onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">링크 텍스트</label>
            <input value={form.link_text ?? ''} onChange={(e) => setForm({ ...form, link_text: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="자세히 보기" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">배경색</label>
            <input type="color" value={form.bg_color ?? '#1d4ed8'} onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
              className="h-9 w-full rounded-lg border border-zinc-200 cursor-pointer" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">글자색</label>
            <input type="color" value={form.text_color ?? '#ffffff'} onChange={(e) => setForm({ ...form, text_color: e.target.value })}
              className="h-9 w-full rounded-lg border border-zinc-200 cursor-pointer" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active ?? false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded" />
            즉시 활성화
          </label>
          <div className="ml-auto flex gap-2">
            {editing && <button onClick={() => { setEditing(null); setForm({ text: '', bg_color: '#1d4ed8', text_color: '#ffffff', is_active: false }); }}
              className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5">취소</button>}
            <button onClick={save} disabled={!form.text}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-1.5 rounded-xl transition-colors">
              {editing ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {banners.map((ban) => (
          <div key={ban.id} className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: ban.bg_color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{ban.text}</p>
              {ban.link_url && <p className="text-xs text-zinc-400 truncate">{ban.link_url}</p>}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ban.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {ban.is_active ? '활성' : '비활성'}
            </span>
            <button onClick={() => edit(ban)} className="text-xs text-blue-600 hover:underline">수정</button>
            <button onClick={() => del(ban.id)} className="text-xs text-red-500 hover:underline">삭제</button>
          </div>
        ))}
        {!banners.length && <p className="text-sm text-zinc-400 text-center py-8">등록된 배너 없음</p>}
      </div>
    </div>
  );
}

// ── 팝업 탭 ───────────────────────────────────────────────────────────────

function PopupsTab({ studioKey }: { studioKey: string }) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [form, setForm] = useState<Partial<Popup>>({
    name: '', title: '', body: '', trigger_type: 'immediate', trigger_value: 0,
    target: 'all', dismiss_days: 7, is_active: false,
  });
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await studioFetch('/marketing/studio/popups', studioKey);
    if (res.ok) setPopups(await res.json());
  }, [studioKey]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `/marketing/studio/popups/${editing}` : '/marketing/studio/popups';
    const res = await studioFetch(url, studioKey, { method, body: JSON.stringify(form) });
    if (res.ok) {
      toast.success('저장 완료');
      setForm({ name: '', title: '', body: '', trigger_type: 'immediate', trigger_value: 0, target: 'all', dismiss_days: 7, is_active: false });
      setEditing(null); load();
    } else toast.error('저장 실패');
  };

  const del = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const res = await studioFetch(`/marketing/studio/popups/${id}`, studioKey, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제 완료'); load(); }
  };

  const edit = (p: Popup) => { setEditing(p.id); setForm(p); };

  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-6">팝업 관리</h2>

      <div className="bg-zinc-50 rounded-2xl p-5 mb-8">
        <h3 className="text-sm font-bold text-zinc-700 mb-4">{editing ? '팝업 수정' : '새 팝업 추가'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">팝업 이름 (내부용)</label>
            <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="프로모션_2026_04" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">팝업 제목 *</label>
            <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="지금 가입하면 1개월 무료!" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500 font-medium mb-1 block">본문 *</label>
            <textarea rows={3} value={form.body ?? ''} onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="기간 한정 이벤트 내용..." />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">CTA 버튼 텍스트</label>
            <input value={form.cta_text ?? ''} onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="무료 시작하기 →" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">CTA URL</label>
            <input value={form.cta_url ?? ''} onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/auth/register" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">트리거 방식</label>
            <select value={form.trigger_type ?? 'immediate'} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="immediate">즉시</option>
              <option value="delay">N초 후</option>
              <option value="scroll">스크롤 N%</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">
              {form.trigger_type === 'scroll' ? '스크롤 %' : '지연 (초)'}
            </label>
            <input type="number" min={0} value={form.trigger_value ?? 0}
              onChange={(e) => setForm({ ...form, trigger_value: parseInt(e.target.value) || 0 })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">재표시 안 함 (일)</label>
            <input type="number" min={0} value={form.dismiss_days ?? 7}
              onChange={(e) => setForm({ ...form, dismiss_days: parseInt(e.target.value) || 7 })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active ?? false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded" />
            즉시 활성화
          </label>
          <div className="ml-auto flex gap-2">
            {editing && <button onClick={() => { setEditing(null); setForm({ name: '', title: '', body: '', trigger_type: 'immediate', trigger_value: 0, target: 'all', dismiss_days: 7, is_active: false }); }}
              className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5">취소</button>}
            <button onClick={save} disabled={!form.title || !form.body}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-1.5 rounded-xl transition-colors">
              {editing ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {popups.map((pop) => (
          <div key={pop.id} className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{pop.title}</p>
              <p className="text-xs text-zinc-400">{pop.name} · {pop.trigger_type} · {pop.dismiss_days}일</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pop.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {pop.is_active ? '활성' : '비활성'}
            </span>
            <button onClick={() => edit(pop)} className="text-xs text-blue-600 hover:underline">수정</button>
            <button onClick={() => del(pop.id)} className="text-xs text-red-500 hover:underline">삭제</button>
          </div>
        ))}
        {!popups.length && <p className="text-sm text-zinc-400 text-center py-8">등록된 팝업 없음</p>}
      </div>
    </div>
  );
}

// ── 메인 스튜디오 ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'blocks', label: '텍스트 블록' },
  { id: 'banners', label: '배너' },
  { id: 'popups', label: '팝업' },
];

export default function MarketingStudioPage() {
  const [studioKey, setStudioKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('blocks');

  const login = async (key: string) => {
    // 간단한 서버 확인
    const res = await studioFetch('/marketing/studio/blocks', key);
    if (res.ok) { setStudioKey(key); setAuthed(true); }
    else toast.error('스튜디오 키가 올바르지 않습니다.');
  };

  if (!authed) return <LoginScreen onLogin={login} />;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-black text-zinc-900">관리왕</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Marketing Studio
            </span>
          </div>
          <a href="/" target="_blank" className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors">
            랜딩 페이지 미리보기 →
          </a>
        </div>
        {/* 탭 */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-zinc-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'blocks'  && <BlocksTab  studioKey={studioKey} />}
        {tab === 'banners' && <BannersTab studioKey={studioKey} />}
        {tab === 'popups'  && <PopupsTab  studioKey={studioKey} />}
      </main>
    </div>
  );
}
