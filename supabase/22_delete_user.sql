-- ============================================================
-- 22. 회원탈퇴 함수
-- profiles ON DELETE CASCADE로 연결된 데이터 자동 삭제
-- auth.users에서도 삭제하여 완전 탈퇴 처리
-- ============================================================

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM auth.users WHERE id = auth.uid();
$$;
