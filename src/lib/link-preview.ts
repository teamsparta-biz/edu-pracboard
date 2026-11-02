import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// 카드 링크의 대표 이미지(og:image)를 찾는다. 카드를 저장한 뒤 한 번만 부르고 결과를 카드에 저장한다.
// 사용자가 넣은 주소를 서버가 여는 것이라, 내부망 주소로는 가지 않고(리다이렉트마다 다시 확인) 시간·크기를 제한한다.
// 실패하면 null — 미리보기가 없을 뿐 카드 저장은 그대로 된다.

const TIMEOUT_MS = 4000;
// 유튜브처럼 <head>에 스크립트가 많아 대표 이미지 태그가 1MB 가까이 뒤에 있는 사이트가 있다
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export async function findLinkImage(link: string | undefined): Promise<string | null> {
  if (!link) return null;
  try {
    let url = new URL(link);
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHttpUrl(url))) return null;
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; PracBoard link preview)", accept: "text/html" },
      });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        await res.body?.cancel();
        url = new URL(next, url);
        continue;
      }
      if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
        await res.body?.cancel();
        return null;
      }
      const image = metaImage(await readHead(res), url);
      return image?.protocol === "https:" ? image.toString() : null;
    }
  } catch {
    // 시간 초과, 잘못된 주소, 접속 실패
  }
  return null;
}

// <head>에 있는 메타 태그만 필요하므로 앞부분만 읽는다
async function readHead(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (html.includes("</head>")) break;
  }
  await reader.cancel();
  return html;
}

function metaImage(html: string, base: URL) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, "property") ?? attr(tag, "name");
    if (key && /^(og:image(:secure_url|:url)?|twitter:image(:src)?)$/i.test(key)) {
      const content = attr(tag, "content");
      if (content) {
        try {
          return new URL(decodeEntities(content), base);
        } catch {}
      }
    }
  }
  return null;
}

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((v) => v !== undefined);

const decodeEntities = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function isPublicHttpUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a));
}

function isPrivateAddress(ip: string) {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}
