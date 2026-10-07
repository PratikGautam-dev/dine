import type { NextConfig } from "next";

// NEXT_PUBLIC_API_BASE_URL is inlined into the browser bundle at build time,
// and every API helper falls back to http://localhost:8000 when it's unset --
// so a Vercel build without it would deploy "successfully" and then fail every
// login/API call from any other machine. Fail the Vercel build loudly instead.
// (Only enforced on Vercel: local dev and `docker build` keep the fallback.)
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not set for this Vercel build. Set it to the backend's public URL " +
      "(e.g. https://your-backend.onrender.com) under Project Settings -> Environment Variables, then redeploy.",
  );
}

const nextConfig: NextConfig = {
  // Self-hosted Docker deployment ONLY (frontend/Dockerfile): traces only
  // the files each page actually needs into .next/standalone, so the
  // runtime image doesn't need to ship node_modules at all.
  //
  // MUST be disabled on Vercel -- this is a correction, not a guess: an
  // earlier version of this comment claimed "Vercel ignores this and does
  // its own tracing," which was never actually verified against a live
  // Vercel deploy and turned out to be wrong. Vercel's build pipeline
  // expects .next/next-server.js.nft.json; `output: "standalone"` moves
  // that trace file to .next/standalone/next-server.js.nft.json instead,
  // which broke Vercel's own onBuildComplete step with a literal ENOENT on
  // the path it expected ("no such file or directory,
  // .next/next-server.js.nft.json") -- a real production deploy failure,
  // not a hypothetical. Vercel sets VERCEL=1 automatically during its own
  // builds (never during `docker build`), so that's what this switches on.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
