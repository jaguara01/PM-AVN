/** @type {import('next').NextConfig} */
const nextConfig = {
  // These load WASM or native bindings and must not be bundled.
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector', 'pg'],
};
export default nextConfig;
