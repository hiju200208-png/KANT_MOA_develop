import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/product/LoadError";
import { Skeleton } from "@/components/ui";
import { getArtistNotices, getNotice } from "@/mocks/notices";
import { getArtist } from "@/services/products";
import type { Artist } from "@/types/app";

interface NoticePageProps {
  params: Promise<{ slug: string; id: string }>;
}

// 아티스트 공지 상세. 아티스트 페이지 오른쪽 Notice 목록에서 들어온다 (공지 데이터는 아직 목 데이터)
export default function NoticePage({ params }: NoticePageProps) {
  return (
    <Suspense fallback={<NoticeSkeleton />}>
      <NoticeContent params={params} />
    </Suspense>
  );
}

async function NoticeContent({ params }: NoticePageProps) {
  const { slug, id } = await params;
  const notice = getNotice(slug, Number(id));
  if (!notice) notFound();

  let artist: Artist | null;
  try {
    artist = await getArtist(slug);
  } catch (error) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoadError error={error} retryHref={`/artists/${slug}/notices/${id}`} />
      </div>
    );
  }
  if (!artist) notFound();

  const others = getArtistNotices(slug, 5).filter((item) => item.id !== notice.id).slice(0, 4);
  const artistPath = `/artists/${artist.slug}`;

  return (
    <div className="content-shell max-w-3xl py-8 md:py-12">
      <nav aria-label="현재 위치" className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Link href={artistPath} className="brand-gradient-text-hover">{artist.name}</Link>
        <span aria-hidden="true">›</span>
        <span>Notice</span>
      </nav>

      <article className="rounded-2xl border border-line bg-white p-6 md:p-10">
        <header className="border-b border-line pb-6">
          <span className="inline-block rounded border border-line px-1.5 py-0.5 text-xs font-bold text-muted">{artist.name}</span>
          <h1 className="mt-3 text-xl font-black leading-snug tracking-[-0.03em] md:text-2xl">{notice.title}</h1>
          <time dateTime={notice.publishedAt} className="mt-2 block text-sm text-muted">
            {notice.publishedAt.replaceAll("-", ".")}
          </time>
        </header>

        <NoticeBody lines={notice.body} />

        <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
          {notice.productId && (
            <Link href={`/products/${notice.productId}`} className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-bold transition-colors hover:bg-neutral-800">
              <span className="text-white">관련 상품 보러가기</span>
            </Link>
          )}
          <Link href={artistPath} className="brand-gradient-soft-hover inline-flex h-11 items-center rounded-full border border-line bg-white px-5 text-sm font-bold">
            {artist.name} 굿즈 보기
          </Link>
        </div>
      </article>

      {others.length > 0 && (
        <section aria-labelledby="other-notices" className="mt-8">
          <h2 id="other-notices" className="mb-3 text-base font-black">다른 공지</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {others.map((item) => (
              <li key={item.id}>
                <Link href={`${artistPath}/notices/${item.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-violet-50/40">
                  <span className="min-w-0 truncate text-sm font-semibold">{item.title}</span>
                  <time dateTime={item.publishedAt} className="shrink-0 text-xs text-muted">{item.publishedAt.replaceAll("-", ".")}</time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// 본문 줄 기호: "< >" 가운데 소제목, "## " 섹션 제목, "- " 목록(연속된 줄은 하나로 묶음), "※ " 주의 문구, 그 외 일반 문단
type Block =
  | { kind: "title" | "section" | "note" | "text"; text: string }
  | { kind: "list"; items: string[] };

function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const last = blocks.at(-1);
    if (line.startsWith("- ")) {
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (line.startsWith("## ")) blocks.push({ kind: "section", text: line.slice(3) });
    else if (line.startsWith("※ ")) blocks.push({ kind: "note", text: line.slice(2) });
    else if (line.startsWith("<") && line.endsWith(">")) blocks.push({ kind: "title", text: line.slice(1, -1).trim() });
    else blocks.push({ kind: "text", text: line });
  }
  return blocks;
}

function NoticeBody({ lines }: { lines: string[] }) {
  return (
    <div className="mt-6 text-[15px] leading-7 text-neutral-700">
      {toBlocks(lines).map((block, index) => {
        switch (block.kind) {
          case "title":
            return (
              <p key={index} className="my-8 rounded-xl bg-[linear-gradient(135deg,#eafffa,#f1edff_52%,#fff0f8)] px-5 py-4 text-center text-base font-black text-foreground">
                {block.text}
              </p>
            );
          case "section":
            return (
              <h2 key={index} className="mt-8 mb-2 flex items-center gap-2 text-base font-black text-foreground">
                <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand" />
                {block.text}
              </h2>
            );
          case "list":
            return (
              <ul key={index} className="space-y-1.5">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-muted">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "note":
            return (
              <p key={index} className="mt-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm leading-6 text-muted">
                <span aria-hidden="true">※ </span>
                {block.text}
              </p>
            );
          default:
            return <p key={index}>{block.text}</p>;
        }
      })}
    </div>
  );
}

function NoticeSkeleton() {
  return (
    <div className="content-shell max-w-3xl py-8 md:py-12" aria-busy="true" aria-label="공지를 불러오는 중">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-96 w-full rounded-2xl" />
    </div>
  );
}
