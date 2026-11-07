/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  images: { unoptimized: true },
};
export default nextConfig;
