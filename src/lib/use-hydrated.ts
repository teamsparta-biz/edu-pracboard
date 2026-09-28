import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// 저장된 로그인 상태(localStorage)를 읽은 뒤에만 역할별 화면을 그리기 위한 훅.
// 서버 렌더와 첫 클라이언트 렌더는 false, 이후 true.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
