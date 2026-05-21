/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Packages that use native Node.js modules and cannot be bundled by webpack
    serverComponentsExternalPackages: ['archiver', 'jspdf', 'jspdf-autotable'],
  },
};

export default nextConfig;
