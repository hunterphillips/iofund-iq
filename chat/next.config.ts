import type { NextConfig } from "next";

const config: NextConfig = {
  // chat/_data/ is materialized by scripts/copy-data.sh during predev/prebuild
  // (the canonical source lives at the repo-root data/ directory).
  outputFileTracingIncludes: {
    "/api/chat": ["_data/**/*.md"],
  },
};

export default config;
