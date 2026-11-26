import type { NextConfig } from 'next';

// GitHub Pages serves this project from https://<user>.github.io/<repo>/, so every
// asset URL needs the "/<repo>" prefix. The deploy workflow sets PAGES_BASE_PATH
// automatically; locally it's empty, so `npm run dev` still works at the site root.
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export', // build plain static files into ./out (GitHub Pages can't run a Node server)
  basePath,
  trailingSlash: true, // emit /page/index.html so Pages serves every route without a server
  images: { unoptimized: true }, // the image optimizer needs a server; not available on Pages
};

export default nextConfig;
