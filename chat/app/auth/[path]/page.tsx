import { AuthView } from "@neondatabase/auth-ui";

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
