import { zipSync, strToU8 } from "fflate";

// 게시물 내려받기(zip) 구성. 서버(src/app/actions/export.ts)가 준 목록으로 브라우저에서 만든다.
//
// [교육명] 1회차.zip
// └─ [교육명] 1회차/
//     ├─ 게시물 목록.xlsx     게시물·댓글 시트. 첨부 파일 칸은 zip 안 파일로 가는 링크
//     ├─ 게시물 보기.html     보드처럼 섹션별 카드 화면. 이미지는 바로 보인다
//     └─ 2차시/A반/01_섹션/001_작성자_제목.pdf   (보드가 하나면 보드 폴더 없이 섹션 폴더부터)

export type ExportScope = { type: "board" | "lesson" | "round" | "education"; id: string };

export type ExportCard = {
  title: string;
  content: string;
  link?: string;
  author: string;
  createdAt: string;
  likes: number;
  comments: { author: string; content: string; createdAt: string }[];
  attachment?: { url: string; name: string; type: string; size: number };
};

export type ExportManifest = {
  education: string;
  company?: string;
  scope: ExportScope["type"];
  boards: { place: string[]; sections: { name: string; cards: ExportCard[] }[] }[];
};

export type ExportFile = { path: string; url: string; size: number };

type Row = {
  place: string;
  section: string;
  no: string;
  card: ExportCard;
  // zip 루트 폴더 기준 첨부 파일 위치
  file?: string;
};

// 범위가 이미 정하는 위치 단계는 폴더에서 뺀다 (회차를 받으면 "1회차/" 폴더는 없다)
const FIXED_DEPTH: Record<ExportScope["type"], number> = { education: 0, round: 1, lesson: 2, board: 99 };

// 윈도우·맥에서 못 쓰는 문자를 지우고 길이를 줄인다
export function safeName(name: string, max = 40) {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = [...cleaned].slice(0, max).join("").replace(/[. ]+$/, "");
  return cut || "_";
}

function splitExt(name: string) {
  const m = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(name.normalize("NFC"))!;
  return { base: m[1], ext: (m[2] ?? "").toLowerCase() };
}

export function exportTitle(m: ExportManifest) {
  const [first] = m.boards;
  const head = m.company && !m.education.includes(m.company) ? `[${m.company}] ${m.education}` : m.education;
  if (m.scope === "education" || !first) return safeName(head, 80);
  // 교육 보드는 "교육 보드"를 빼고 이름만
  const place = m.scope === "board" ? first.place.filter((p, i) => !(i === 0 && p === "교육 보드")) : first.place.slice(0, FIXED_DEPTH[m.scope]);
  return safeName(`${head} ${place.join(" ")}`, 80);
}

export function planExport(m: ExportManifest) {
  const root = exportTitle(m);
  const rows: Row[] = [];
  const files: ExportFile[] = [];
  const multi = m.boards.length > 1;
  const used = new Set<string>();
  // 이름을 줄이다 보면 다른 보드 폴더와 같아질 수 있어 겹치면 번호를 붙인다
  const unique = (path: string) => {
    let p = path;
    for (let n = 2; used.has(p.toLowerCase()); n++) p = path.replace(/(\.[^./]*)?$/, ` (${n})$1`);
    used.add(p.toLowerCase());
    return p;
  };
  for (const board of m.boards) {
    const folders = multi ? board.place.slice(FIXED_DEPTH[m.scope]).map((p) => safeName(p)) : [];
    board.sections.forEach((section, si) => {
      const sectionFolder = `${String(si + 1).padStart(2, "0")}_${safeName(section.name)}`;
      section.cards.forEach((card, ci) => {
        const no = String(ci + 1).padStart(3, "0");
        let file: string | undefined;
        if (card.attachment) {
          const { base, ext } = splitExt(card.attachment.name);
          const label = safeName([card.author, card.title || base].filter(Boolean).join("_"));
          file = unique([...folders, sectionFolder, `${no}_${label}${ext}`].join("/"));
          files.push({ path: `${root}/${file}`, url: card.attachment.url, size: card.attachment.size });
        }
        rows.push({ place: board.place.join(" · "), section: section.name, no, card, file });
      });
    });
  }
  return { root, rows, files, multi };
}

/* ───────────── 엑셀 (.xlsx) ───────────── */

const xmlEscape = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 엑셀 셀 하나의 최대 길이
const CELL_MAX = 32000;

type Cell = string | number | { link: string; text: string } | undefined;

function colName(i: number) {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// 스타일 번호: 0 기본, 1 머리글, 2 줄바꿈, 3 링크
function cellXml(ref: string, v: Cell, style: number) {
  if (v === undefined || v === "") return "";
  if (typeof v === "number") return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  if (typeof v === "object") {
    // 수식 안의 문자열은 255자까지라, 넘으면 링크 없이 글자만 둔다
    const q = (s: string) => s.replace(/"/g, '""');
    if (v.link.length <= 255 && v.text.length <= 255)
      return `<c r="${ref}" s="3" t="str"><f>${xmlEscape(`HYPERLINK("${q(v.link)}","${q(v.text)}")`)}</f><v>${xmlEscape(v.text)}</v></c>`;
    v = v.text;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v.slice(0, CELL_MAX))}</t></is></c>`;
}

function sheetXml(header: string[], widths: number[], rows: Cell[][], wrapCols: number[]) {
  const last = `${colName(header.length - 1)}${rows.length + 1}`;
  const line = (cells: Cell[], r: number, head: boolean) =>
    `<row r="${r}">${cells.map((v, i) => cellXml(`${colName(i)}${r}`, v, head ? 1 : wrapCols.includes(i) ? 2 : 0)).join("")}</row>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${line(header, 1, true)}${rows.map((r, i) => line(r, i + 2, false)).join("")}</sheetData>` +
    `<autoFilter ref="A1:${last}"/>` +
    `</worksheet>`
  );
}

// "2026-11-03 14:20" (한국 시간)
export function kst(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
}

export function buildXlsx(plan: ReturnType<typeof planExport>) {
  const placeCol = plan.multi;
  const posts = sheetXml(
    [...(placeCol ? ["위치"] : []), "섹션", "번호", "작성자", "제목", "내용", "링크", "첨부 파일", "작성일시", "하트", "댓글"],
    [...(placeCol ? [24] : []), 16, 6, 12, 28, 50, 30, 36, 17, 6, 6],
    plan.rows.map((r) => [
      ...(placeCol ? [r.place] : []),
      r.section,
      r.no,
      r.card.author,
      r.card.title,
      r.card.content,
      r.card.link ? { link: r.card.link, text: r.card.link } : undefined,
      r.file ? { link: r.file, text: r.card.attachment!.name } : undefined,
      kst(r.card.createdAt),
      r.card.likes,
      r.card.comments.length,
    ]),
    [placeCol ? 5 : 4],
  );
  const commentRows = plan.rows.flatMap((r) =>
    r.card.comments.map((c) => [...(placeCol ? [r.place] : []), r.section, r.no, r.card.title, c.author, c.content, kst(c.createdAt)] as Cell[]),
  );
  const comments = sheetXml(
    [...(placeCol ? ["위치"] : []), "섹션", "번호", "카드 제목", "작성자", "댓글", "작성일시"],
    [...(placeCol ? [24] : []), 16, 6, 28, 12, 60, 17],
    commentRows,
    [placeCol ? 5 : 4],
  );

  const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`);
  return zipSync({
    "[Content_Types].xml": xml(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    ),
    "_rels/.rels": xml(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    "xl/workbook.xml": xml(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="게시물" sheetId="1" r:id="rId1"/><sheet name="댓글" sheetId="2" r:id="rId2"/></sheets>` +
        `<definedNames>` +
        `<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'게시물'!$A$1:$${colName(placeCol ? 10 : 9)}$${plan.rows.length + 1}</definedName>` +
        `<definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">'댓글'!$A$1:$${colName(placeCol ? 6 : 5)}$${commentRows.length + 1}</definedName>` +
        `</definedNames>` +
        `</workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": xml(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/styles.xml": xml(
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font>` +
        `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="맑은 고딕"/></font></fonts>` +
        `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>` +
        `<borders count="1"><border/></borders>` +
        `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
        `<cellXfs count="4">` +
        `<xf fontId="0" applyAlignment="1"><alignment vertical="top"/></xf>` +
        `<xf fontId="1" fillId="2" applyFont="1" applyFill="1"/>` +
        `<xf fontId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
        `<xf fontId="2" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>` +
        `</cellXfs></styleSheet>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(posts),
    "xl/worksheets/sheet2.xml": strToU8(comments),
  });
}

/* ───────────── 보기용 HTML ───────────── */

const htmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// zip을 푼 폴더 안에서 여는 상대 주소
const href = (path: string) => path.split("/").map(encodeURIComponent).join("/");

function preview(r: Row) {
  const a = r.card.attachment;
  if (!a || !r.file) return "";
  const src = href(r.file);
  if (a.type.startsWith("image/")) return `<a href="${src}" target="_blank"><img src="${src}" alt="" loading="lazy"></a>`;
  if (a.type.startsWith("video/")) return `<video src="${src}" controls preload="metadata"></video>`;
  if (a.type.startsWith("audio/")) return `<audio src="${src}" controls preload="none"></audio>`;
  return "";
}

export function buildHtml(plan: ReturnType<typeof planExport>, m: ExportManifest) {
  const groups = new Map<string, Map<string, Row[]>>();
  for (const r of plan.rows) {
    const sections = groups.get(r.place) ?? new Map<string, Row[]>();
    groups.set(r.place, sections);
    sections.set(r.section, [...(sections.get(r.section) ?? []), r]);
  }
  // 카드가 없는 섹션도 목차에 남긴다
  for (const b of m.boards)
    for (const s of b.sections) {
      const sections = groups.get(b.place.join(" · ")) ?? new Map<string, Row[]>();
      groups.set(b.place.join(" · "), sections);
      if (!sections.has(s.name)) sections.set(s.name, []);
    }

  const card = (r: Row) => {
    const c = r.card;
    const comments = c.comments.length
      ? `<details><summary>댓글 ${c.comments.length}</summary><ul>${c.comments
          .map((x) => `<li><b>${htmlEscape(x.author)}</b> ${htmlEscape(x.content)} <time>${kst(x.createdAt)}</time></li>`)
          .join("")}</ul></details>`
      : "";
    return (
      `<article><div class="no">${r.no}</div>${preview(r)}` +
      (c.title ? `<h4>${htmlEscape(c.title)}</h4>` : "") +
      (c.content ? `<p class="body">${htmlEscape(c.content)}</p>` : "") +
      (c.link ? `<p><a href="${htmlEscape(c.link)}" target="_blank" rel="noopener">🔗 ${htmlEscape(c.link)}</a></p>` : "") +
      (r.file ? `<p><a class="file" href="${href(r.file)}" target="_blank">📎 ${htmlEscape(c.attachment!.name)}</a></p>` : "") +
      `<footer>${htmlEscape(c.author)} · ${kst(c.createdAt)}${c.likes ? ` · ♥ ${c.likes}` : ""}</footer>${comments}</article>`
    );
  };

  let body = "";
  let id = 0;
  const toc: string[] = [];
  for (const [place, sections] of groups) {
    if (plan.multi) body += `<h2>${htmlEscape(place)}</h2>`;
    for (const [name, rows] of sections) {
      const anchor = `s${++id}`;
      toc.push(`<a href="#${anchor}">${plan.multi ? `${htmlEscape(place)} › ` : ""}${htmlEscape(name)} <span>${rows.length}</span></a>`);
      body += `<section id="${anchor}"><h3>${htmlEscape(name)} <span>${rows.length}</span></h3>${
        rows.length ? `<div class="grid">${rows.map(card).join("")}</div>` : `<p class="empty">게시물이 없어요.</p>`
      }</section>`;
    }
  }

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(plan.root)}</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#faf8f5;color:#1f1f1f;line-height:1.5}
header{padding:32px 24px 16px;max-width:1200px;margin:auto}header p{margin:0;color:#777;font-size:14px}h1{margin:4px 0 0;font-size:28px}
nav{position:sticky;top:0;z-index:1;background:#faf8f5ee;border-bottom:1px solid #eee;padding:10px 24px;display:flex;gap:8px;overflow-x:auto}
nav a{white-space:nowrap;text-decoration:none;color:#333;border:1px solid #ddd;background:#fff;border-radius:999px;padding:4px 12px;font-size:13px}
nav span,h3 span{color:#999;font-weight:400}
main{max-width:1200px;margin:auto;padding:8px 24px 64px}h2{margin:40px 0 0;font-size:22px}h3{margin:28px 0 12px;font-size:17px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;align-items:start}
article{position:relative;background:#fff;border:1px solid #eaeaea;border-radius:14px;padding:14px;overflow:hidden}
article img,article video{display:block;width:calc(100% + 28px);margin:-14px -14px 10px;max-height:320px;object-fit:cover;background:#f2f2f2}
article audio{width:100%}
.no{position:absolute;top:8px;right:10px;font-size:11px;color:#aaa;background:#fffd;border-radius:6px;padding:0 4px}
h4{margin:0 0 6px;font-size:15px}.body{white-space:pre-wrap;margin:0 0 8px;font-size:14px}
article p{margin:0 0 6px;font-size:13px;word-break:break-all}a{color:#c8102e}
footer{font-size:12px;color:#888;margin-top:6px}details{margin-top:8px;font-size:13px}summary{cursor:pointer;color:#555}
details ul{padding-left:16px;margin:6px 0 0}time{color:#aaa;font-size:11px}.empty{color:#999;font-size:14px}
</style></head><body>
<header><p>${htmlEscape([m.company, m.education].filter(Boolean).join(" · "))}</p><h1>${htmlEscape(plan.root)}</h1>
<p>게시물 ${plan.rows.length}개 · 내려받은 시각 ${kst(new Date().toISOString())}</p></header>
<nav>${toc.join("")}</nav>
<main>${body}</main>
</body></html>`;
}
