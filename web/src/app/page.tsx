import Link from 'next/link';
import type { Metadata } from 'next';
import PricingWizard from '@/components/landing/PricingWizard';
import SiteBanner from '@/components/marketing/SiteBanner';
import SitePopup from '@/components/marketing/SitePopup';
import { fetchBlocks, fetchActiveBanner, fetchActivePopups, b, type BlockMap } from '@/lib/marketing';

export const metadata: Metadata = {
  title: '관리왕 — 중소사업장 직원 관리 플랫폼',
  description:
    '출퇴근부터 급여·계약·세무까지. 직종별 맞춤 패키지로 필요한 기능만, 필요한 만큼.',
};

// ─── 공통 아이콘 ──────────────────────────────────────────────────────────

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── 내비게이션 ───────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-black text-primary-600 tracking-tight">관리왕</span>
          <span className="hidden sm:inline text-[11px] font-semibold text-text-muted bg-zinc-100
                           px-2 py-0.5 rounded-full">
            B2B SaaS
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm text-text-secondary">
          <a href="#features" className="hover:text-primary-600 transition-colors">기능</a>
          <a href="#pricing" className="hover:text-primary-600 transition-colors">요금제</a>
          <a href="#testimonials" className="hover:text-primary-600 transition-colors">후기</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5"
          >
            로그인
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700
                       transition-colors px-4 py-1.5 rounded-lg"
          >
            무료 시작
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── 히어로 ───────────────────────────────────────────────────────────────

function Hero({ bk }: { bk: BlockMap }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-700 pt-16 pb-24">
      {/* 배경 장식 */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 50%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {/* 배지 */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20
                        text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-status-checkin animate-pulse" />
          {b(bk, 'hero', 'badge', '🚀 중소사업장을 위한 스마트 인사 관리')}
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-5">
          {b(bk, 'hero', 'title_line1', '복잡한 인사 관리,')}
          <br />
          이제 <span className="relative inline-block">
            관리왕
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-1 bg-white/30 rounded-full"
            />
          </span>{' '}
          {b(bk, 'hero', 'title_line2', '하나로 끝.')}
        </h1>

        <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto mb-8 leading-relaxed">
          {b(bk, 'hero', 'subtitle', '출퇴근부터 급여·계약·세무까지. 직종별 맞춤 패키지로 필요한 기능만, 필요한 만큼.')}
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#pricing"
            className="w-full sm:w-auto bg-white text-primary-700 font-bold text-sm
                       px-7 py-3.5 rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
          >
            {b(bk, 'hero', 'cta_primary', '내 업종 맞춤 가격 보기 ↓')}
          </a>
          <Link
            href="/auth/register"
            className="w-full sm:w-auto bg-white/10 border border-white/30 text-white
                       font-semibold text-sm px-7 py-3.5 rounded-xl hover:bg-white/20 transition-colors"
          >
            {b(bk, 'hero', 'cta_secondary', '14일 무료 체험 시작 →')}
          </Link>
        </div>

        {/* 신뢰 지표 */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2
                        text-xs text-white/60 font-medium">
          {[
            b(bk, 'hero', 'trust_1', '신용카드 불필요'),
            b(bk, 'hero', 'trust_2', '언제든 취소'),
            b(bk, 'hero', 'trust_3', 'Free 플랜 영구 무료'),
            b(bk, 'hero', 'trust_4', '개인정보 암호화 보관'),
          ].map((text) => (
            <span key={text} className="flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5 text-status-checkin" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 가격 마법사 섹션 ──────────────────────────────────────────────────────

function WizardSection({ bk }: { bk: BlockMap }) {
  return (
    <section id="pricing" className="py-16 sm:py-20 bg-background scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">
            {b(bk, 'pricing', 'badge', '💰 합리적인 요금제')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary mb-3">
            {b(bk, 'pricing', 'title', '우리 팀에 딱 맞는 플랜 선택')}
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-lg mx-auto">
            {b(bk, 'pricing', 'subtitle', '소규모 팀부터 중견 기업까지, 유연하게 확장 가능한 플랜을 제공합니다')}
          </p>
        </div>

        <PricingWizard />
      </div>
    </section>
  );
}

// ─── 주요 기능 섹션 ────────────────────────────────────────────────────────

const FEATURES = [
  {
    emoji: '📱',
    title: '5가지 출퇴근 방식',
    desc: '앱 클릭, GPS, WiFi, QR, 생체인증을 동시에 활성화. 가장 먼저 인식된 방식으로 자동 처리.',
    badge: '경쟁사 대비 독보적',
  },
  {
    emoji: '⚖️',
    title: '주휴수당 · 휴게시간 자동 계산',
    desc: '근로기준법 제54조 자동 준수. 4시간↑ 30분, 8시간↑ 60분 휴게 자동 차감.',
    badge: '법적 분쟁 방지',
  },
  {
    emoji: '📋',
    title: '전자결재 + 법적 봉인',
    desc: '최종 승인 시 SHA-256 해시 체인 자동 생성. 5년 보존, 무결성 검증 지원.',
    badge: '법적 효력',
  },
  {
    emoji: '📅',
    title: '세무 캘린더 자동 알림',
    desc: '원천징수, 4대보험 신고, 연말정산 등 35일 이내 세무 할 일 자동 푸시.',
    badge: '가산세 예방',
  },
  {
    emoji: '🤖',
    title: 'AI 어시스턴트',
    desc: '공지 초안 자동 생성, 업무 분석, 결재 문서 작성까지. OpenAI 기반 실무 AI.',
    badge: '생산성 향상',
  },
  {
    emoji: '🏢',
    title: '다지점 통합 관리',
    desc: '지점별 직원 현황, 출퇴근 필터, 배정 관리를 하나의 대시보드에서.',
    badge: '프랜차이즈 최적',
  },
];

function FeaturesSection({ bk }: { bk: BlockMap }) {
  return (
    <section id="features" className="py-16 sm:py-20 bg-white scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">
            {b(bk, 'features', 'badge', '✨ 핵심 기능')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary mb-3">
            {b(bk, 'features', 'title', '업무에 필요한 모든 것')}
          </h2>
          <p className="text-sm text-text-secondary">
            {b(bk, 'features', 'subtitle', '관리왕 하나로 인사·근태·급여를 통합 관리하세요')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-border p-5 hover:shadow-card-hover
                         hover:border-primary-100 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{f.emoji}</span>
                <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                  {f.badge}
                </span>
              </div>
              <h3 className="font-bold text-text-primary mb-1.5 group-hover:text-primary-700 transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 비교 테이블 섹션 ──────────────────────────────────────────────────────

const PROBLEMS = [
  { problem: '엑셀로 출퇴근 기록 → 오기입·분실', solution: '다중 방식 자동 기록 (앱·GPS·QR·WiFi)' },
  { problem: '급여 계산이 머릿속에만 → 분쟁 발생 시 증거 없음', solution: '법적 효력 있는 급여 명세서, 암호화 보관' },
  { problem: '세무 신고 깜빡 → 가산세 폭탄', solution: '35일 이내 세무 할 일 자동 알림' },
  { problem: '직원마다 다른 근무시간 → 수동 계산 지옥', solution: '계약서 기반 개인 스케줄 + 법정 휴게 자동 계산' },
  { problem: '인사 정보가 여러 툴에 분산 → 전체 현황 파악 불가', solution: '하나의 플랫폼에서 전부 관리' },
];

function ComparisonSection() {
  return (
    <section className="py-16 sm:py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary mb-3">
            지금 어떻게 관리하고 계신가요?
          </h2>
          <p className="text-sm text-text-secondary">
            관리왕을 도입한 사업장들이 공통으로 겪던 문제들입니다
          </p>
        </div>

        <div className="space-y-3">
          {PROBLEMS.map(({ problem, solution }) => (
            <div
              key={problem}
              className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-border"
            >
              <div className="flex items-start gap-3 p-4 bg-red-50">
                <span className="text-status-absent text-lg mt-0.5 flex-shrink-0">✗</span>
                <p className="text-sm text-text-secondary">{problem}</p>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white">
                <span className="text-status-checkin text-lg mt-0.5 flex-shrink-0">✓</span>
                <p className="text-sm font-medium text-text-primary">{solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 고객 후기 섹션 ────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      '주휴수당 계산 때문에 직원이랑 말다툼이 잦았는데, 이제는 시스템이 자동으로 계산해주니 서로 신뢰가 생겼어요.',
    name: '김민준',
    role: '카페 사장',
    location: '서울 마포구',
    emoji: '☕',
  },
  {
    quote:
      '현장 직원들이 GPS로 출퇴근 찍으니까 누가 어디 있는지 실시간으로 보여요. 예전엔 전화로 일일이 확인했는데.',
    name: '이서연',
    role: '건설현장 팀장',
    location: '경기 화성',
    emoji: '🏗️',
  },
  {
    quote:
      '세 군데 편의점 직원 스케줄을 따로 관리했었는데, 이제 한 화면에서 다 보여요. 야간 아르바이트 급여 정산도 자동이라.',
    name: '박지현',
    role: '편의점 가맹점주',
    location: '부산 해운대',
    emoji: '🛍️',
  },
];

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-16 sm:py-20 bg-white scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">
            실제 사용자 후기
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary">
            같은 고민을 먼저 해결한 사장님들
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow"
            >
              {/* 별점 */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-sm text-text-primary leading-relaxed mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
                  {t.emoji}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">
                    {t.role} · {t.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 최종 CTA 배너 ────────────────────────────────────────────────────────

function CtaSection({ bk }: { bk: BlockMap }) {
  return (
    <section className="py-16 sm:py-20 bg-gradient-to-br from-primary-600 to-primary-700">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
          {b(bk, 'cta', 'title', '지금 바로 시작하세요')}
        </h2>
        <p className="text-white/80 text-sm sm:text-base mb-8">
          {b(bk, 'cta', 'subtitle', '14일 무료 체험 · 신용카드 불필요 · 5분이면 설정 완료')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto bg-white text-primary-700 font-bold text-sm
                       px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
          >
            {b(bk, 'cta', 'button', '무료 체험 시작하기 →')}
          </Link>
          <a
            href="#pricing"
            className="w-full sm:w-auto bg-white/10 border border-white/30 text-white
                       font-semibold text-sm px-8 py-3.5 rounded-xl hover:bg-white/20 transition-colors"
          >
            내 업종 가격 확인하기
          </a>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2
                        text-xs text-white/60 font-medium">
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-status-checkin" />
            Free 플랜 영구 무료
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-status-checkin" />
            데이터 암호화 (AES-256)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-status-checkin" />
            개인정보처리방침 준수
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── 푸터 ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-text-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white font-black text-lg mb-1">관리왕</p>
            <p className="text-zinc-400 text-xs">중소사업장 직원 관리 플랫폼</p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
            <a href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</a>
            <a href="/terms" className="hover:text-white transition-colors">서비스 이용약관</a>
            <a href="mailto:contact@gwanliwang.com" className="hover:text-white transition-colors">
              문의 · 영업
            </a>
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-700 flex flex-col sm:flex-row
                        items-start sm:items-center justify-between gap-2 text-xs text-zinc-500">
          <p>© 2026 관리왕. All rights reserved.</p>
          <p>모든 AI 결과물에는 검토가 필요할 수 있으며 법적 책임은 이용자에게 있습니다.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── 페이지 진입점 ────────────────────────────────────────────────────────

export default async function LandingPage() {
  const [bk, banner, popups] = await Promise.all([
    fetchBlocks(),
    fetchActiveBanner(),
    fetchActivePopups(),
  ]);

  return (
    <div className="min-h-screen">
      <SiteBanner banner={banner} />
      <Nav />
      <main>
        <Hero bk={bk} />
        <WizardSection bk={bk} />
        <FeaturesSection bk={bk} />
        <ComparisonSection />
        <TestimonialsSection />
        <CtaSection bk={bk} />
      </main>
      <Footer />
      <SitePopup popups={popups} />
    </div>
  );
}
