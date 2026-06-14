import { AuthView } from "@neondatabase/auth-ui";
// Scoped to the auth route on purpose: this stylesheet ships its own un-layered
// Tailwind Preflight, which would otherwise override the app's padding/font-size
// utilities everywhere (see app/globals.css note). Only the auth pages need it.
import "@neondatabase/auth-ui/css";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="page">
      <div className="container auth-container">
        <AuthView pathname={path} />
      </div>
    </main>
  );
}
