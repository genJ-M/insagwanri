/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 로컬 개발 시 admin-backend 직접 프록시
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/admin/v1/:path*',
          destination: 'http://localhost:4001/admin/v1/:path*',
        },
      ];
    }
    return [];
  },
};
module.exports = nextConfig;
