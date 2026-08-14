/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['mongoose', 'sharp'],
  outputFileTracingExcludes: {
    '*': ['./public/assets/**/*'],
  },
};

export default nextConfig;
