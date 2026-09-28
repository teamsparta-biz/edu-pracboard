// axhub 교육명 "[기업명] - 교육명"에서 교육명만 꺼낸다. 형식이 다르면 원본 그대로.
export function educationTitle(name: string) {
  return name.replace(/^\s*\[[^\]]*\]\s*-\s*/, "");
}
