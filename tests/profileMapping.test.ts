import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileValidationError, toProfile } from '../src/services/profileMapping.ts';

test('내 정보 조회·저장 응답의 연락처를 버리지 않고 화면 프로필에 반영한다', () => {
  const user = { id: 'user-1', email: 'user@example.com', nickname: '수정한 이름', role: 'ADMIN', phone: '010-1234-5678' };
  assert.deepEqual(toProfile(user), { id: user.id, email: user.email, nickname: user.nickname, phone: user.phone });
  assert.equal(toProfile({ ...user, phone: null }).phone, null);
  assert.equal(toProfile({ id: user.id, email: user.email, nickname: user.nickname, role: 'USER' }).phone, null);
});

test('닉네임·휴대폰 입력과 연락처 삭제를 안내한다', () => {
  for (const phone of ['01012345678', '010-1234-5678', '011 123 4567', '', null]) {
    assert.equal(profileValidationError({ nickname: '회원', phone }), null);
  }
  for (const phone of ['abc01012345678', '123', '+821012345678']) {
    assert.match(profileValidationError({ phone }) ?? '', /휴대폰/);
  }
  assert.match(profileValidationError({ nickname: '   ' }) ?? '', /닉네임/);
  assert.match(profileValidationError({ nickname: '가'.repeat(51) }) ?? '', /닉네임/);
});
