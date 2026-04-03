import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'recharts',
    '@tiptap/react',
    '@tiptap/core',
    '@tiptap/pm',
    '@tiptap/starter-kit',
    '@tiptap/extension-underline',
    '@tiptap/extension-text-align',
    '@tiptap/extension-placeholder',
  ],
};

export default withSentryConfig(nextConfig, {
  // Sentry 조직·프로젝트 (sentry.io에서 확인)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 소스맵을 Sentry에 업로드하고 번들에서 제거 (에러 스택트레이스 해독용)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // 빌드 로그 숨기기
  silent: !process.env.CI,

  // 자동 계측 비활성화 (필요한 것만 수동 설정)
  autoInstrumentServerFunctions: false,
});
