-- 카드 첨부를 이미지 전용에서 모든 파일(이미지·동영상·문서 등)로 넓힌다.
-- 파일은 비공개 버킷 card-images에 두고, 화면에는 서명 URL로만 보여준다 (버킷 이름은 이력상 유지).

alter table public.cards rename column image to attachment_path;
alter table public.cards
  add column attachment_name text,
  add column attachment_type text,
  add column attachment_size bigint;

-- 기존 이미지 카드
update public.cards
  set attachment_name = split_part(attachment_path, '/', 2),
      attachment_type = 'image/*'
  where attachment_path is not null;
