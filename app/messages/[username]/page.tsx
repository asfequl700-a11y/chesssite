import { Suspense } from "react";
import { MessagesPage } from "@/components/messages";

export const metadata = { title: "Messages" };

// The username is read inside <Suspense> so the shared page shell holds no URL data (Next.js instant-shell-url-data).
export default function Page({ params }: PageProps<"/messages/[username]">) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <Chat params={params} />
    </Suspense>
  );
}

async function Chat({ params }: { params: PageProps<"/messages/[username]">["params"] }) {
  const { username } = await params;
  return <MessagesPage username={decodeURIComponent(username)} />;
}
