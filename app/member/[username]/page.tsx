import { Suspense } from "react";
import { ProfilePage } from "@/components/profile-page";

export const metadata = { title: "Player" };

// The username is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/member/[username]">) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <Member params={params} />
    </Suspense>
  );
}

async function Member({ params }: { params: PageProps<"/member/[username]">["params"] }) {
  const { username } = await params;
  return <ProfilePage key={username} username={decodeURIComponent(username)} />;
}
