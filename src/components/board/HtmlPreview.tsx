"use client";

import { useEffect, useState } from "react";
import { MAX_HTML_PREVIEW_BYTES } from "@/lib/storage";

// 교육생이 올린 HTML 파일을 격리된 창(sandbox iframe)에 그린다.
// 파일 내용을 받아 srcdoc으로 넣고 allow-same-origin을 주지 않으므로, 그 안의 스크립트는 고유한 빈 출처에서 돌아
// 보드 화면·로그인 쿠키·Supabase 세션에 접근할 수 없다. (Storage 주소를 그대로 iframe에 넣으면 Storage가
// HTML을 일반 텍스트로 돌려줘 소스 코드가 보인다.)
// 같은 파일(서명 URL)을 여러 번 그려도 한 번만 받는다.
const cache = new Map<string, Promise<string | null>>();

function load(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    cache.set(url, p);
  }
  return p;
}

type Props = {
  url: string;
  size?: number;
  title: string;
  // 카드 썸네일: 축소해서 보여주고 누르면 카드가 열린다. 상세: 실제 크기로 조작할 수 있다.
  variant: "thumbnail" | "detail";
  fallback: React.ReactNode;
};

export default function HtmlPreview({ url, size, title, variant, fallback }: Props) {
  const previewable = !size || size <= MAX_HTML_PREVIEW_BYTES;
  const [html, setHtml] = useState<{ url: string; text: string | null }>();

  useEffect(() => {
    if (!previewable) return;
    let alive = true;
    load(url).then((text) => alive && setHtml({ url, text }));
    return () => {
      alive = false;
    };
  }, [url, previewable]);

  const text = html?.url === url ? html.text : undefined;
  if (!previewable || text === null) return fallback;
  if (text === undefined) return <div className="absolute inset-0 animate-pulse bg-muted" />;

  if (variant === "thumbnail") {
    // 데스크톱 화면 폭으로 그린 뒤 1/4로 줄인다. 누르면 카드가 열리도록 창 안으로는 입력을 보내지 않는다.
    return (
      <iframe
        srcDoc={text}
        sandbox="allow-scripts"
        title={title}
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        className="absolute top-0 left-0 w-[400%] h-[400%] origin-top-left scale-25 border-0 bg-white pointer-events-none"
      />
    );
  }
  return (
    <iframe
      srcDoc={text}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      title={title}
      className="block w-full h-[60vh] border-0 bg-white"
    />
  );
}
