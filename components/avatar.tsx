/** Profile photo, or the first letter of the name on a coloured square (chess.com-style 3px corners). */
export function Avatar({ url, name, size = 40, className = "" }: { url?: string | null; name: string; size?: number; className?: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element -- small user photos from Supabase Storage
    return <img src={url} alt="" width={size} height={size} className={`shrink-0 rounded-[3px] object-cover ${className}`} style={{ width: size, height: size }} />;
  return (
    <span className={`grid shrink-0 place-items-center rounded-[3px] bg-primary font-bold text-white ${className}`} style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
