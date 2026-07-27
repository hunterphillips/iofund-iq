import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const REPO_OWNER = "hunterphillips";
const REPO_NAME = "iofund-iq";
const WORKFLOW_FILE = "poll-trades.yml";

// POST /api/admin/sync-trades → dispatch the poll-trades GitHub Actions
// workflow (the same job the 30-min cron runs). Fire-and-forget: GitHub
// returns 204 on a successful dispatch; the run itself takes ~1 minute.
export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const token = process.env.GITHUB_WORKFLOW_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_WORKFLOW_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "iofund-iq",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (res.status !== 204) {
    const detail = await res.text().catch(() => "");
    console.error("[sync-trades] dispatch failed", res.status, detail);
    return NextResponse.json(
      { error: "GitHub rejected the dispatch." },
      { status: 502 },
    );
  }

  return NextResponse.json({ started: true }, { status: 202 });
}
