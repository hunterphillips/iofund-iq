import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

// Root is a pure router: authenticated → /fund (inside the app shell);
// unauthenticated → the sign-in flow. The former inline landing + chat is
// superseded by the shell (drawer chat + /chat land in later slices).
export default async function Home() {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    redirect("/fund");
  }

  redirect("/auth/sign-in");
}
