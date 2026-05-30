import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) for a minimal production
  // Docker image. In this Bun monorepo the trace root must be the repo root so
  // the workspace dependency @fictrio/contracts is included.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
