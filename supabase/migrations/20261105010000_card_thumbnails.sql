-- 카드 이미지 미리보기 (2026-11-05)
-- 휴대폰 사진 원본(3~10MB)을 보드 목록에서 그대로 받으면 보는 사람마다 수십 MB를 받는다.
-- 올릴 때 브라우저가 작은 미리보기(가로·세로 800px 이하 WebP/JPEG)를 함께 올리고, 보드 목록은 그것만 보여준다.
-- 카드를 열면 원본을 본다. 미리보기가 없는 예전 카드는 원본을 보여준다.

alter table public.cards add column attachment_thumb_path text;
