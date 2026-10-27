import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ACCESS_TOKEN_STORAGE_KEY, AUTH_CHANGE_EVENT, clearAccessToken, getAccessToken, setAccessToken } from '../src/services/session.ts';

afterEach(() => { Reflect.deleteProperty(globalThis, 'window'); });

function browser() {
  const data = new Map<string, string>();
  const events = new EventTarget();
  const fake = {
    localStorage: { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) },
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fake });
  return { data, events, fake };
}

test('서버에서는 토큰을 읽지 않는다', () => { assert.equal(getAccessToken(), null); });

test('P1·P3·P4 공통 키로 저장·해제하고 같은 탭에 상태 변경 알림', () => {
  const { data, events } = browser();
  let changed = 0;
  events.addEventListener(AUTH_CHANGE_EVENT, () => changed++);
  setAccessToken('fake-local-token');
  assert.equal(data.get(ACCESS_TOKEN_STORAGE_KEY), 'fake-local-token');
  assert.equal(getAccessToken(), 'fake-local-token');
  clearAccessToken('fake-local-token');
  assert.equal(getAccessToken(), null);
  assert.equal(changed, 2);
});

test('이전 토큰 요청의 늦은 401이 새 로그인 토큰을 지우지 않는다', () => {
  browser();
  setAccessToken('old');
  setAccessToken('new');
  clearAccessToken('old');
  assert.equal(getAccessToken(), 'new');
});

test('브라우저 저장소 차단 시 로그인 성공으로 가장하지 않는다', () => {
  const { fake } = browser();
  fake.localStorage.getItem = () => { throw new Error('blocked'); };
  fake.localStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(getAccessToken(), null);
  assert.throws(() => setAccessToken('fake'), /blocked/);
});
