/**
 * @import {AnchorAllow, Options, Result, Sleep} from 'dead-or-alive'
 * @import {Root} from 'hast'
 */

/**
 * @typedef State
 *   State.
 * @property {ReadonlyArray<Readonly<AnchorAllow>>} anchorAllowlist
 *   Allow anchors.
 * @property {boolean} checkAnchor
 *   Check whether URL hashes point to elements.
 * @property {boolean} findUrls
 *   Find links in the final resource.
 * @property {boolean} followMetaHttpEquiv
 *   Follow HTML redirects.
 * @property {number} maxRedirects
 *   Maximum redirects to follow, inclusive.
 * @property {number} maxRetries
 *   Maximum number to try again on failures, inclusive.
 * @property {Array<VFileMessage>} messages
 *   Collected messages.
 * @property {boolean | undefined} permanent
 *   Whether all redirects were permanent.
 * @property {boolean} resolveClobberPrefix
 *   Accept `user-content-` prefix in `id` on elements.
 * @property {number} redirects
 *   Number of redirects.
 * @property {number} retries
 *   Number of retries.
 * @property {Sleep} sleep
 *   Calculate miliseconds to sleep between tries.
 * @property {number} timeout
 *   Timeout for HTTP request in miliseconds.
 * @property {Set<string> | undefined} urls
 *   Further URLs, if `findUrls: true`.
 * @property {string} userAgent
 *   User agent.
 */

import {parse} from 'fast-content-type-parse'
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic'
import {isElement} from 'hast-util-is-element'
import {select} from 'hast-util-select'
import {urlAttributes} from 'html-url-attributes'
import {visit} from 'unist-util-visit'
import {VFileMessage} from 'vfile-message'
import {getAnchors} from './anchors.js'
import {propose} from './propose.js'
import {sharedDeclarativeRefresh} from './shared-declarative-refresh.js'
import {fetch} from '#fetch'

/** @type {Readonly<Options>} */
const emptyOptions = {}

const defaultUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'

const documentation = 'https://github.com/wooorm/dead-or-alive'

const listFormat = new Intl.ListFormat('en', {
  style: 'long',
  type: 'disjunction'
})

/**
 * Check if a url is dead or alive.
 *
 * ###### Notes
 *
 * To improve performance,
 * decrease `maxRetries` and/or decrease the value used
 * for `sleep`.
 * The normal behavior is to assume connections might be flakey and to sleep a
 * while and retry a couple times.
 *
 * If you do not care about HTML redirects,
 * whether anchors work,
 * and what further URLs are used on,
 * you can pass `checkAnchor: false`,
 * `findUrls: false`,
 * and `followMetaHttpEquiv: false`,
 * which enables a fast path without parsing HTML.
 *
 * @param {Readonly<URL> | string} href
 *   URL.
 * @param {Readonly<Options> | null | undefined} [options]
 *   Configuration (optional).
 * @returns {Promise<Result>}
 *   Result.
 */
export async function deadOrAlive(href, options) {
  const settings = options || emptyOptions
  const anchorAllowlist = settings.anchorAllowlist || defaultAnchorAllowlist
  const checkAnchor = settings.checkAnchor !== false
  const findUrls = settings.findUrls !== false
  const followMetaHttpEquiv = settings.followMetaHttpEquiv !== false
  const maxRedirects =
    typeof settings.maxRedirects === 'number' ? settings.maxRedirects : 5
  const maxRetries =
    typeof settings.maxRetries === 'number' ? settings.maxRetries : 1
  const resolveClobberPrefix = settings.resolveClobberPrefix !== false
  const sleep = settings.sleep || defaultSleep
  const timeout = typeof settings.timeout === 'number' ? settings.timeout : 3000
  const userAgent = settings.userAgent || defaultUserAgent

  /** @type {State} */
  const state = {
    anchorAllowlist,
    checkAnchor,
    findUrls,
    followMetaHttpEquiv,
    maxRedirects,
    maxRetries,
    messages: [],
    permanent: undefined,
    redirects: 0,
    resolveClobberPrefix,
    retries: 0,
    sleep,
    timeout,
    urls: undefined,
    userAgent
  }

  try {
    const url = await deadOrAliveInternal(
      state,
      typeof href === 'string' ? new URL(href) : href
    )
    return {
      messages: state.messages,
      permanent: state.permanent,
      status: 'alive',
      url: url.href,
      urls: state.urls
    }
  } catch (error) {
    const cause = /** @type {VFileMessage} */ (error)
    return {
      messages: [cause, ...state.messages],
      permanent: state.permanent,
      status: 'dead',
      url: undefined,
      urls: state.urls
    }
  }
}

/**
 * Allow certain anchors.
 *
 * This currently allows text fragments everywhere.
 *
 * @type {ReadonlyArray<Readonly<AnchorAllow>>}
 */
export const defaultAnchorAllowlist = [[/./, /^:~:/]]

/**
 * Calculate miliseconds to sleep between tries.
 *
 * The function is defined as `x ** 3 * 1000`,
 * so the first sleep is `1 ** 3 * 1000` is 1s,
 * 2nd is 8s,
 * 3rd is 27s,
 * etc.
 *
 * @param {number} retries
 *   Try.
 * @returns {number}
 *   Miliseconds to sleep.
 */
export function defaultSleep(retries) {
  return retries ** 3 * 1000
}

/**
 * Check if urls are dead or alive.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Readonly<URL>} url
 *   URL.
 * @returns {Promise<URL>}
 *   Result.
 */
async function deadOrAliveInternal(state, url) {
  if (state.redirects > state.maxRedirects) {
    const message = new VFileMessage(
      'Unexpected redirect to `' + url.href + '`, too many redirects',
      {ruleId: 'max-redirect', source: 'dead-or-alive'}
    )

    message.url = documentation + '#' + message.ruleId
    message.fatal = true
    throw message
  }

  /** @type {Awaited<ReturnType<typeof fetch>>} */
  let response

  try {
    // Create a manually abortable fetch,
    // instead of `AbortSignal.timeout(state.timeout)`.
    // This way we only abort slow requests; not the other work.
    const controller = new AbortController()
    const id = setTimeout(function () {
      controller.abort()
    }, state.timeout)

    response = await fetch(url, {
      headers: {
        userAgent: state.userAgent,
        // <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Upgrade-Insecure-Requests>
        'Upgrade-Insecure-Requests': '1',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'gzip',
        'accept-language': 'en-US,en;q=0.9'
      },
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal
    })

    clearTimeout(id)
  } catch (error) {
    if (state.retries < state.maxRetries) return retry(state, url)

    const cause = /** @type {Error} */ (error)
    const message = new VFileMessage(
      'Unexpected error fetching `' + url.href + '`',
      {cause, ruleId: 'fetch', source: 'dead-or-alive'}
    )

    message.url = documentation + '#' + message.ruleId
    message.fatal = true
    throw message
  }

  // Reset retries if successful.
  state.retries = 0

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')

    if (location) {
      const redirect = new URL(location, url)

      if (response.status === 301 || response.status === 308) {
        if (state.permanent === undefined) state.permanent = true
      } else {
        state.permanent = false
      }

      if (url.hash) {
        const message = new VFileMessage(
          'Unexpected hash in URL `' +
            url.href +
            '` that redirects to `' +
            redirect.href +
            '` losing the hash, remove the hash from the original URL',
          {
            ruleId: 'lost-hash-with-redirect',
            source: 'dead-or-alive'
          }
        )
        message.url = documentation + '#' + message.ruleId
        state.messages.push(message)
      }

      state.redirects++
      return deadOrAliveInternal(state, redirect)
    }
  }

  if (!response.ok) {
    if (
      state.retries < state.maxRetries &&
      // When the server says the client is wrong, we don’t try again.
      (response.status < 400 || response.status >= 500)
    ) {
      return retry(state, url)
    }

    const message = new VFileMessage(
      'Unexpected not ok response `' +
        response.status +
        '` (`' +
        response.statusText +
        '`) on `' +
        response.url +
        '`',
      {ruleId: 'dead', source: 'dead-or-alive'}
    )

    message.url = documentation + '#' + message.ruleId
    message.fatal = true
    throw message
  }

  // Note: defaulting to HTML might not be great?
  const contentType = response.headers.get('content-type') || undefined

  if (contentType) {
    const type = parse(contentType)

    if (type.type === 'text/html') {
      return handleTextHtml(state, url, response)
    }
  }

  return handleUnknown(state, url, response, contentType)
}

/**
 * @param {State} state
 * @param {Readonly<URL>} url
 * @returns {Promise<URL>}
 */
async function retry(state, url) {
  state.retries++

  await new Promise(function (resolve) {
    setTimeout(resolve, state.sleep(state.retries))
  })

  return deadOrAliveInternal(state, url)
}

/**
 * @param {State} state
 * @param {Readonly<URL>} url
 * @param {Response} response
 * @returns {Promise<URL>}
 */
// eslint-disable-next-line complexity
async function handleTextHtml(state, url, response) {
  // If we don’t need to dig into the HTML, we’re done.
  if (
    !(
      (state.checkAnchor && url.hash) ||
      state.findUrls ||
      state.followMetaHttpEquiv
    )
  ) {
    return new URL(response.url)
  }

  const text = await response.text()
  const tree = fromHtmlIsomorphic(text)

  if (state.followMetaHttpEquiv) {
    const meta = select('meta[http-equiv=refresh]', tree)
    // Note: this also throws a proper `VFileMessage` when an invalid URL
    // is defined in the HTML.
    const redirect =
      meta && meta.properties.content
        ? sharedDeclarativeRefresh(
            String(meta.properties.content),
            new URL(response.url)
          )
        : undefined

    if (redirect) {
      if (state.checkAnchor && url.hash) {
        const message = new VFileMessage(
          'Unexpected hash in URL `' +
            url.href +
            '` that redirects with `meta[http-equiv=refresh] to `' +
            redirect.href +
            '` losing the hash, remove the hash from the original URL',
          {
            ruleId: 'lost-hash-with-meta-http-equiv',
            source: 'dead-or-alive'
          }
        )
        message.url = documentation + '#' + message.ruleId
        state.messages.push(message)
      }

      // Treat all HTML redirects as non-permanent.
      state.permanent = false
      state.redirects++
      return deadOrAliveInternal(state, redirect)
    }
  }

  if (state.findUrls) {
    state.urls = findUrls(url, tree)
  }

  if (state.checkAnchor && url.hash) {
    const responseUrl = new URL(response.url)
    const baseUrl = responseUrl.origin + responseUrl.pathname
    const fragment = url.hash.slice(1)
    const result = new URL(response.url)
    result.hash = url.hash

    for (const [urlRe, fragmentRe] of state.anchorAllowlist) {
      if (urlRe.test(baseUrl) && fragmentRe.test(fragment)) {
        return result
      }
    }

    const anchors = getAnchors(tree, state)
    const match = anchors.get(fragment) || {}
    const node =
      match.systemId || match.systemName || match.userId || match.userName

    if (node) {
      return result
    }

    const proposals = listFormat.format(
      propose(fragment, [...anchors.keys()]).map((d) => '`' + d + '`')
    )

    const message = new VFileMessage(
      'Unexpected missing anchor element on `' +
        response.url +
        '` for fragment `' +
        fragment +
        '`, remove if unneeded or refer to an existing element' +
        (proposals ? ' such as ' + proposals : ''),
      {ruleId: 'missing-anchor', source: 'dead-or-alive'}
    )

    message.url = documentation + '#' + message.ruleId
    message.fatal = true
    throw message
  }

  // Allow the hash to remain.
  return new URL(response.url + url.hash)
}

/**
 * @param {State} state
 * @param {Readonly<URL>} url
 * @param {Response} response
 * @param {string | undefined} contentType
 * @returns {URL}
 */
function handleUnknown(state, url, response, contentType) {
  if (state.checkAnchor && url.hash) {
    const message = new VFileMessage(
      'Unexpected hash in URL `' +
        url.href +
        '` to non-html (`' +
        contentType +
        '`) losing the hash, remove the hash from the original URL',
      {ruleId: 'lost-hash-with-non-html', source: 'dead-or-alive'}
    )
    message.url = documentation + '#' + message.ruleId
    state.messages.push(message)
  }

  return new URL(response.url)
}

/**
 * @param {Readonly<URL>} url
 * @param {Root} tree
 * @returns {Set<string>}
 */
function findUrls(url, tree) {
  /** @type {Set<string>} */
  const urls = new Set()

  visit(tree, 'element', function (node) {
    /** @type {string} */
    let key

    for (key in node.properties) {
      if (
        Object.hasOwn(node.properties, key) &&
        Object.hasOwn(urlAttributes, key) &&
        isElement(node, urlAttributes[key])
      ) {
        const value = node.properties[key]

        if (Array.isArray(value)) {
          for (const item of value) {
            add(item)
          }
        } else if (typeof value === 'string') {
          add(value)
        }
      }
    }
  })

  return urls

  /**
   * @param {boolean | number | string} value
   * @returns {undefined}
   */
  function add(value) {
    if (typeof value === 'string') {
      /** @type {URL} */
      let found

      try {
        found = new URL(value, url)
      } catch {
        // Note: we currently silently bail
        return
      }

      urls.add(found.href)
    }
  }
}
