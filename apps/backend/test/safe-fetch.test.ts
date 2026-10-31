import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, safeFetch, sniffImageMime } from '../src/common/safe-fetch';

test('private and reserved addresses are blocked', () => {
  for (const a of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) assert.equal(isPrivateAddress(a), true, a);
  for (const a of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(a), false, a);
});
test('safeFetch rejects non-https, credentials, odd ports and internal hosts', async () => {
  for (const url of ['http://example.com/a.png', 'https://user:pw@example.com/a.png', 'https://example.com:8443/a.png', 'https://127.0.0.1/a.png', 'https://[::1]/a.png', 'https://localhost/a.png', 'file:///etc/passwd'])
    await assert.rejects(() => safeFetch(url, { maxBytes: 1024, timeoutMs: 2000 }), url);
});
test('image type comes from magic bytes, not the remote header', () => {
  assert.equal(sniffImageMime(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(sniffImageMime(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
});
