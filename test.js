/**
 * @import {VFileMessage} from 'vfile-message'
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {deadOrAlive} from 'dead-or-alive'
import {MockAgent, getGlobalDispatcher, setGlobalDispatcher} from 'undici'
import {sharedDeclarativeRefresh} from './lib/shared-declarative-refresh.js'
import {propose} from './lib/propose.js'

test('core', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(await import('dead-or-alive')).sort(), [
      'deadOrAlive',
      'defaultAnchorAllowlist',
      'defaultSleep'
    ])
  })
})

test('deadOrAlive (real)', async function (t) {
  await t.test('should work for a real url', async function () {
    const result = await deadOrAlive('https://github.com')
    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://github.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work for a real `http` url', async function () {
    const result = await deadOrAlive('http://github.com')
    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://github.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work for a redirecting real url', async function () {
    const result = await deadOrAlive('https://mdn.io')
    assert.equal(result.status, 'alive')
    assert.deepEqual(
      result.url,
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
    )
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work for a real url w/ anchor', async function () {
    const result = await deadOrAlive(
      'https://github.com/wooorm/dead-or-alive#dead-or-alive'
    )
    assert.equal(result.status, 'alive')
    assert.deepEqual(
      result.url,
      'https://github.com/wooorm/dead-or-alive#dead-or-alive'
    )
    assert.equal(result.messages.length, 0)
  })

  await t.test(
    'should fail for a missing real url w/ anchor',
    async function () {
      // To do: when released, use that.
      const result = await deadOrAlive(
        'https://github.com/wooorm/dead-or-alive#deader-live'
      )
      assert.equal(result.status, 'dead')
      assert.equal(result.messages.length, 1)
      const message = result.messages[0]
      assert.equal(
        message.reason,
        'Unexpected missing anchor element on `https://github.com/wooorm/dead-or-alive` for fragment `deader-live`, remove if unneeded or refer to an existing element such as `dead-or-alive`'
      )
      assert.equal(message.ruleId, 'missing-anchor')
      assert.equal(message.source, 'dead-or-alive')
    }
  )
})

test('deadOrAlive (mocked)', async function (t) {
  await t.test('should work w/ a 200', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200, 'ok')

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work w/ URLs', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200, 'ok')

    const result = await deadOrAlive(new URL('https://example.com'))

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work w/ a timeout', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200).delay(100)

    const result = await deadOrAlive('https://example.com', {timeout: 50})

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected error fetching `https://example.com/`'
    )
    assert.equal(message.ruleId, 'fetch')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should work w/ retries', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    let called = false

    interceptable
      .intercept({
        path(path) {
          if (path === '/') {
            if (called) {
              return true
            }

            called = true
          }

          return false
        }
      })
      .reply(200)

    const result = await deadOrAlive('https://example.com', {
      sleep: shortSleep
    })

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work w/ a 404', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(404)

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected not ok response `404` (`Not Found`) on `https://example.com/`'
    )
    assert.equal(message.ruleId, 'dead')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should work w/ a 500', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(500)

    const result = await deadOrAlive('https://example.com', {sleep: shortSleep})

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected error fetching `https://example.com/`'
    )
    assert.equal(message.ruleId, 'fetch')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should work w/ a 301', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(301, '', {headers: {Location: '/to'}})
    interceptable
      .intercept({path: '/to'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/to')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work w/ a 302', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(302, '', {headers: {Location: '/to'}})
    interceptable
      .intercept({path: '/to'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/to')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work w/ 5 redirects (default)', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    const max = 5

    let index = 0
    while (index < max) {
      interceptable
        .intercept({path: '/' + index})
        .reply(301, '', {headers: {Location: '/' + (index + 1)}})
      index++
    }

    interceptable
      .intercept({path: '/' + max})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com/0')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/' + max)
    assert.equal(result.messages.length, 0)
  })

  await t.test('should fail w/ 6 redirects (default)', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    const max = 6

    let index = 0
    while (index < max) {
      interceptable
        .intercept({path: '/' + index})
        .reply(301, '', {headers: {Location: '/' + (index + 1)}})
      index++
    }

    interceptable
      .intercept({path: '/' + max})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com/0')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected redirect to `https://example.com/6`, too many redirects'
    )
    assert.equal(message.ruleId, 'max-redirect')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should support `maxRedirects`', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    const max = 10

    let index = 0
    while (index < max) {
      interceptable
        .intercept({path: '/' + index})
        .reply(301, '', {headers: {Location: '/' + (index + 1)}})
      index++
    }

    interceptable
      .intercept({path: '/' + max})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com/0', {
      maxRedirects: 7
    })

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected redirect to `https://example.com/8`, too many redirects'
    )
    assert.equal(message.ruleId, 'max-redirect')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should warn w/ a redirect w/ hash', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(301, '', {headers: {Location: '/to'}})
    interceptable
      .intercept({path: '/to'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com#hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/to')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected hash in URL `https://example.com/#hi` that redirects to `https://example.com/to` losing the hash, remove the hash from the original URL'
    )
    assert.equal(message.ruleId, 'lost-hash-with-redirect')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should work with an HTML redirect', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(
        200,
        '<!doctypehtml><title>Redirecting…</title><meta http-equiv=refresh content="0;url=https://example.com/i/was/redirected/">',
        {headers: {'Content-type': 'text/html'}}
      )
    interceptable
      .intercept({path: '/i/was/redirected/'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/i/was/redirected/')
    assert.equal(result.messages.length, 0)
  })

  await t.test(
    'should not follow HTML redirects w/ `followMetaHttpEquiv: false`',
    async function () {
      const globalDispatcher = getGlobalDispatcher()
      const mockAgent = new MockAgent()
      mockAgent.enableNetConnect(/(?=a)b/)
      setGlobalDispatcher(mockAgent)
      const interceptable = mockAgent.get('https://example.com')
      interceptable
        .intercept({path: '/'})
        .reply(
          200,
          '<!doctypehtml><title>Redirecting…</title><meta http-equiv=refresh content="0;url=https://example.com/i/was/redirected/">',
          {headers: {'Content-type': 'text/html'}}
        )

      const result = await deadOrAlive('https://example.com', {
        followMetaHttpEquiv: false
      })

      await mockAgent.close()
      await setGlobalDispatcher(globalDispatcher)

      assert.equal(result.status, 'alive')
      assert.deepEqual(result.url, 'https://example.com/')
      assert.equal(result.messages.length, 0)
    }
  )

  await t.test(
    'should ignore an HTML redirect w/o `content`',
    async function () {
      const globalDispatcher = getGlobalDispatcher()
      const mockAgent = new MockAgent()
      mockAgent.enableNetConnect(/(?=a)b/)
      setGlobalDispatcher(mockAgent)
      const interceptable = mockAgent.get('https://example.com')
      interceptable
        .intercept({path: '/'})
        .reply(
          200,
          '<!doctypehtml><title>Redirecting…</title><meta http-equiv=refresh>',
          {headers: {'Content-type': 'text/html'}}
        )

      const result = await deadOrAlive('https://example.com')

      await mockAgent.close()
      await setGlobalDispatcher(globalDispatcher)

      assert.equal(result.status, 'alive')
      assert.deepEqual(result.url, 'https://example.com/')
      assert.equal(result.messages.length, 0)
    }
  )

  await t.test('should warn w/ HTML redirect losing hash', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(
        200,
        '<!doctypehtml><title>Redirecting…</title><meta http-equiv=refresh content="0;/to/">',
        {headers: {'Content-type': 'text/html'}}
      )
    interceptable
      .intercept({path: '/to/'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com#hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/to/')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected hash in URL `https://example.com/#hi` that redirects with `meta[http-equiv=refresh] to `https://example.com/to/` losing the hash, remove the hash from the original URL'
    )
    assert.equal(message.ruleId, 'lost-hash-with-meta-http-equiv')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should find an anchor by `id`', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, '<!doctypehtml><title></title><h1 id=hi>hi</h1>', {
        headers: {'Content-type': 'text/html'}
      })

    const result = await deadOrAlive('https://example.com#hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/#hi')
    assert.equal(result.messages.length, 0)
  })

  await t.test(
    'should find an anchor by `id` (clobber prefix)',
    async function () {
      const globalDispatcher = getGlobalDispatcher()
      const mockAgent = new MockAgent()
      mockAgent.enableNetConnect(/(?=a)b/)
      setGlobalDispatcher(mockAgent)
      const interceptable = mockAgent.get('https://example.com')
      interceptable
        .intercept({path: '/'})
        .reply(
          200,
          '<!doctypehtml><title></title><h1 id=user-content-hi>hi</h1>',
          {headers: {'Content-type': 'text/html'}}
        )

      const result = await deadOrAlive('https://example.com#hi')

      await mockAgent.close()
      await setGlobalDispatcher(globalDispatcher)

      assert.equal(result.status, 'alive')
      assert.deepEqual(result.url, 'https://example.com/#hi')
      assert.equal(result.messages.length, 0)
    }
  )

  await t.test('should find an anchor by `a[name]`', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, '<!doctypehtml><title></title><a name=hi>hi</a>', {
        headers: {'Content-type': 'text/html'}
      })

    const result = await deadOrAlive('https://example.com#hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.deepEqual(result.url, 'https://example.com/#hi')
    assert.equal(result.messages.length, 0)
  })

  await t.test(
    'should find an anchor by `a[name]` (clobber prefix)',
    async function () {
      const globalDispatcher = getGlobalDispatcher()
      const mockAgent = new MockAgent()
      mockAgent.enableNetConnect(/(?=a)b/)
      setGlobalDispatcher(mockAgent)
      const interceptable = mockAgent.get('https://example.com')
      interceptable
        .intercept({path: '/'})
        .reply(
          200,
          '<!doctypehtml><title></title><a name=user-content-hi>hi</a>',
          {headers: {'Content-type': 'text/html'}}
        )

      const result = await deadOrAlive('https://example.com#hi')

      await mockAgent.close()
      await setGlobalDispatcher(globalDispatcher)

      assert.equal(result.status, 'alive')
      assert.deepEqual(result.url, 'https://example.com/#hi')
      assert.equal(result.messages.length, 0)
    }
  )

  await t.test('should find similar anchors', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(
        200,
        '<!doctypehtml><title></title><h1 id=aaab>hi</h1><h1 id=user-content-aaac>hi</h1><a name=aaad>hi</a><a name=user-content-aaae>hi</a>',
        {headers: {'Content-type': 'text/html'}}
      )

    const result = await deadOrAlive('https://example.com#aaaa')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected missing anchor element on `https://example.com/` for fragment `aaaa`, remove if unneeded or refer to an existing element such as `aaab`, `aaac`, `aaad`, or `aaae`'
    )
    assert.equal(message.ruleId, 'missing-anchor')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should allow text fragments by default', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com#:~:text=hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/#:~:text=hi')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should find similar anchors (none)', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, '<!doctypehtml><title></title><h1 id=xxxx>hi</h1>', {
        headers: {'Content-type': 'text/html'}
      })

    const result = await deadOrAlive('https://example.com#aaaa')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected missing anchor element on `https://example.com/` for fragment `aaaa`, remove if unneeded or refer to an existing element'
    )
    assert.equal(message.ruleId, 'missing-anchor')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should work w/o `Content-type`', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200, 'hi')

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should work with non-html', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200, '*{color:red}', {
      headers: {'Content-type': 'text/css'}
    })

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
  })

  await t.test('should warn about anchors into non-html', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable.intercept({path: '/'}).reply(200, '*{color:red}', {
      headers: {'Content-type': 'text/css'}
    })

    const result = await deadOrAlive('https://example.com#hi')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 1)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected hash in URL `https://example.com/#hi` to non-html (`text/css`) losing the hash, remove the hash from the original URL'
    )
    assert.equal(message.ruleId, 'lost-hash-with-non-html')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should find further URLs', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, '<a href=/>a</a><q cite=#a>b</q><a ping="b c">c</a>', {
        headers: {'Content-type': 'text/html'}
      })

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
    assert.deepEqual(result.urls ? [...result.urls] : [], [
      'https://example.com/',
      'https://example.com/#a',
      'https://example.com/b',
      'https://example.com/c'
    ])
  })

  await t.test('should ignore broken further URLs', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, '<a href=https://exa[mple.org>a</a>', {
        headers: {'Content-type': 'text/html'}
      })

    const result = await deadOrAlive('https://example.com')

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
    assert.deepEqual(result.urls ? [...result.urls] : [], [])
  })

  await t.test(
    'should not find further urls w/ `findUrls: false`',
    async function () {
      const globalDispatcher = getGlobalDispatcher()
      const mockAgent = new MockAgent()
      mockAgent.enableNetConnect(/(?=a)b/)
      setGlobalDispatcher(mockAgent)
      const interceptable = mockAgent.get('https://example.com')
      interceptable.intercept({path: '/'}).reply(200, '<a href=a>b</a>', {
        headers: {'Content-type': 'text/html'}
      })

      const result = await deadOrAlive('https://example.com', {findUrls: false})

      await mockAgent.close()
      await setGlobalDispatcher(globalDispatcher)

      assert.equal(result.status, 'alive')
      assert.equal(result.url, 'https://example.com/')
      assert.equal(result.messages.length, 0)
      assert.deepEqual(result.urls, undefined)
    }
  )

  await t.test('should be fast if html is not needed', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)
    const interceptable = mockAgent.get('https://example.com')
    interceptable
      .intercept({path: '/'})
      .reply(200, 'ok', {headers: {'Content-type': 'text/html'}})

    const result = await deadOrAlive('https://example.com', {
      checkAnchor: false,
      findUrls: false,
      followMetaHttpEquiv: false
    })

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'alive')
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.messages.length, 0)
    assert.deepEqual(result.urls, undefined)
  })

  await t.test('should be fast if retries are not needed', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)

    const result = await deadOrAlive('https://example.com', {
      maxRetries: 0
    })

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.url, undefined)
    assert.deepEqual(result.urls, undefined)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected error fetching `https://example.com/`'
    )
    assert.equal(message.ruleId, 'fetch')
    assert.equal(message.source, 'dead-or-alive')
  })

  await t.test('should be fast if sleep is fast', async function () {
    const globalDispatcher = getGlobalDispatcher()
    const mockAgent = new MockAgent()
    mockAgent.enableNetConnect(/(?=a)b/)
    setGlobalDispatcher(mockAgent)

    const result = await deadOrAlive('https://example.com', {
      sleep() {
        return 40
      }
    })

    await mockAgent.close()
    await setGlobalDispatcher(globalDispatcher)

    assert.equal(result.status, 'dead')
    assert.equal(result.url, undefined)
    assert.deepEqual(result.urls, undefined)
    const message = result.messages[0]
    assert.equal(
      message.reason,
      'Unexpected error fetching `https://example.com/`'
    )
    assert.equal(message.ruleId, 'fetch')
    assert.equal(message.source, 'dead-or-alive')
  })
})

test('sharedDeclarativeRefresh (internal util)', async function (t) {
  const from = new URL('https://example.com/from')

  await t.test('should work', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;/to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should support initial whitespace', async function () {
    assert.equal(
      sharedDeclarativeRefresh('\t 0;/to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ float', async function () {
    assert.equal(
      sharedDeclarativeRefresh('1.234;/to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ missing integer', async function () {
    assert.equal(
      sharedDeclarativeRefresh('.;/to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should fail w/o time', async function () {
    assert.equal(sharedDeclarativeRefresh(';/to', from), undefined)
  })

  await t.test('should fail w/o separator', async function () {
    assert.equal(sharedDeclarativeRefresh('0?/to', from), undefined)
  })

  await t.test(
    'should fail w/o continuation after separator',
    async function () {
      assert.equal(sharedDeclarativeRefresh('0;', from), undefined)
    }
  )

  await t.test('should work w/ semicolon separator', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ comma separator', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0,to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ whitespace before separator', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0 ,to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ whitespace after separator', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0, to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ double quotes', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;"to"', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ single quotes', async function () {
    assert.equal(
      sharedDeclarativeRefresh("0;'to'", from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ quotes, truncating at end', async function () {
    assert.equal(
      sharedDeclarativeRefresh("0;'to'c", from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ quotes, w/o end', async function () {
    assert.equal(
      sharedDeclarativeRefresh("0;'to", from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ `url` prefix', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;url=to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ `url` prefix (uppercase)', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;URL=to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ `url` prefix (funkycase)', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;uRl=to', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/o prefix, w/ `u`', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;us', from)?.href,
      'https://example.com/us'
    )
  })

  await t.test('should work w/o prefix, w/ `ur`', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;ura', from)?.href,
      'https://example.com/ura'
    )
  })

  await t.test('should work w/o prefix, w/ `url` (no `=`)', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;urlang', from)?.href,
      'https://example.com/urlang'
    )
  })

  await t.test(
    'should work w/ whitespace before `=` in prefix',
    async function () {
      assert.equal(
        sharedDeclarativeRefresh('0;url =to', from)?.href,
        'https://example.com/to'
      )
    }
  )

  await t.test(
    'should work w/ whitespace after `=` in prefix',
    async function () {
      assert.equal(
        sharedDeclarativeRefresh('0;url= to', from)?.href,
        'https://example.com/to'
      )
    }
  )

  await t.test('should work w/ quotes after prefix', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;url="to"', from)?.href,
      'https://example.com/to'
    )
  })

  await t.test('should work w/ a different domain', async function () {
    assert.equal(
      sharedDeclarativeRefresh('0;https://example.org/stuff', from)?.href,
      'https://example.org/stuff'
    )
  })

  await t.test('should throw on invalid URLs', async function () {
    try {
      sharedDeclarativeRefresh('0;url="https://exa[mple.org"', from)
      assert.fail()
    } catch (error) {
      const message = /** @type {VFileMessage} */ (error)
      assert.equal(
        message.reason,
        'Unexpected invalid URL `https://exa[mple.org` in `content` on `meta[http-equiv=refresh] relative to `https://example.com/from`'
      )
      assert.equal(message.ruleId, 'shared-declarative-refresh')
      assert.equal(message.source, 'dead-or-alive')
    }
  })
})

test('propose (internal util)', async function (t) {
  await t.test('should work when empty', async function () {
    assert.deepEqual(propose('woolwork', []), [])
  })

  await t.test('should work (1)', async function () {
    assert.deepEqual(
      propose('woolwork', ['woolworker', 'woolworking', 'woolwinder']),
      ['woolworker', 'woolworking']
    )
  })

  await t.test('should work (2)', async function () {
    assert.deepEqual(
      propose('woolworkir', ['woolworker', 'woolworking', 'woolwinder']),
      ['woolworker', 'woolworking', 'woolwinder']
    )
  })
})

/**
 * @param {number} retries
 * @returns {number}
 */
function shortSleep(retries) {
  return retries ** 2 * 100
}
