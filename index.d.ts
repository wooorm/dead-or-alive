import type {VFileMessage} from 'vfile-message'

export {deadOrAlive, defaultAnchorAllowlist, defaultSleep} from './lib/index.js'

/**
 * Allow extra anchors.
 * The first item is a regular expression to match URLs (origin and path,
 * so without search or hash),
 * and the second item is a regular expression to match hashes (without `#`).
 * When both match,
 * the hash is allowed.
 */
export type AnchorAllow = [url: RegExp, anchor: RegExp]

/**
 * Configuration.
 */
export interface Options {
  /**
   * Allow anchors (default: `defaultAnchorAllowlist`);
   * each tuple is checked to match URLs (origin and path,
   * so without search or hash),
   * and then to match hashes (without `#`);
   * when both match,
   * the hash is allowed,
   * and no `missing-anchor` error is used.
   */
  anchorAllowlist?: ReadonlyArray<Readonly<AnchorAllow>> | null | undefined
  /**
   * Check whether URL hashes point to elements (default: `true`).
   */
  checkAnchor?: boolean | null | undefined
  /**
   * Find URLs in the final resource (default: `true`);
   * currently applies to HTML.
   */
  findUrls?: boolean | null | undefined
  /**
   * Follow HTML redirects (default: `true`);
   * a `<meta content=0;to http-equiv=refresh>` can be useful for static sites
   * such as those on GH pages.
   */
  followMetaHttpEquiv?: boolean | null | undefined
  /**
   * Inclusive maximum redirects to follow (default: `5`).
   */
  maxRedirects?: number | null | undefined
  /**
   * Inclusive maximum number to try again on failures (default: `1`).
   */
  maxRetries?: number | null | undefined
  /**
   * Accept `user-content-` prefix in `id` on elements (default: `true`).
   */
  resolveClobberPrefix?: boolean | null | undefined
  /**
   * Calculate miliseconds to sleep between tries (default: `defaultSleep`).
   */
  sleep?: Sleep | null | undefined
  /**
   * Timeout for HTTP request in miliseconds (default: `3000`).
   */
  timeout?: number | null | undefined
  /**
   * User agent (default: `'Mozilla/5.0 … Safari/537.36'`, a modern Chrome on macOS user agent).
   */
  userAgent?: string | null | undefined
}

/**
 * Result.
 */
interface ResultAlive {
  /**
   * Messages where the first is a fatal error when dead.
   */
  messages: Array<VFileMessage>
  /**
   * Whether all redirects were permanent.
   */
  permanent: boolean | undefined
  /**
   * Status.
   */
  status: 'alive'
  /**
   * Final URL if alive.
   */
  url: string
  /**
   * Further URLs if `findUrls: true` and the resource was HTML.
   */
  urls: Set<string> | undefined
}

/**
 * Result.
 */
interface ResultDead {
  /**
   * Messages where the first is a fatal error when dead.
   */
  messages: [VFileMessage, ...Array<VFileMessage>]
  /**
   * Whether all redirects were permanent.
   */
  permanent: boolean | undefined
  /**
   * Status.
   */
  status: 'dead'
  /**
   * Final URL if alive.
   */
  url: undefined
  /**
   * Further URLs if `findUrls: true` and the resource was HTML.
   */
  urls: Set<string> | undefined
}

/**
 * Result.
 */
export type Result = ResultAlive | ResultDead

/**
 * Calculate miliseconds to sleep between tries.
 */
export type Sleep = (retries: number) => number
