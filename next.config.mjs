/** @type {import('next').NextConfig} */
const nextConfig = {
  // These load WASM or native bindings and must not be bundled.
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector', 'pg'],
  // Long meeting transcripts are sent to a server action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
};
export default nextConfig;
