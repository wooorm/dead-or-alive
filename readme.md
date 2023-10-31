# dead-or-alive

[![Build][badge-build-image]][badge-build-url]
[![Coverage][badge-coverage-image]][badge-coverage-url]
[![Downloads][badge-downloads-image]][badge-downloads-url]
[![Size][badge-size-image]][badge-size-url]

Check if urls are dead or alive.

## Contents

* [What is this?](#what-is-this)
* [When should I use this?](#when-should-i-use-this)
* [Install](#install)
* [Use](#use)
* [API](#api)
  * [`deadOrAlive(href[, options])`](#deadoralivehref-options)
  * [`defaultAnchorAllowlist`](#defaultanchorallowlist)
  * [`defaultSleep(retries)`](#defaultsleepretries)
  * [`AnchorAllow`](#anchorallow)
  * [`Options`](#options)
  * [`Result`](#result)
  * [`Sleep`](#sleep)
* [Errors](#errors)
  * [`dead`](#dead)
  * [`fetch`](#fetch)
  * [`lost-hash-with-meta-http-equiv`](#lost-hash-with-meta-http-equiv)
  * [`lost-hash-with-non-html`](#lost-hash-with-non-html)
  * [`lost-hash-with-redirect`](#lost-hash-with-redirect)
  * [`max-redirect`](#max-redirect)
  * [`missing-anchor`](#missing-anchor)
  * [`shared-declarative-refresh`](#shared-declarative-refresh)
* [Compatibility](#compatibility)
* [Security](#security)
* [Contribute](#contribute)
* [License](#license)

## What is this?

The main goal of this project is to make sure URLs in docs are okay.
As in,
“if I link to it and a user goes there,
will it work,
and will they be there or somewhere else?”
It uses modern JavaScript that works everywhere,
and it uses the DOM when available,
so you can use it in browsers, Node.js, workers.

It is made to be used by other tools.
Such as a markdown tool,
[`remark-lint-no-dead-urls`][github-remark-lint-no-dead-urls].

* [x] works in browser, node, worker, etc
* [x] checks if anchors (such as `#readme`) point to elements
* [x] follows HTTP and HTML redirects
* [x] supports DOM clobber prefix (`user-content-`)
* [x] emits warnings

## When should I use this?

You can use this when you want to build a link checker.

If you want to support SPAs or other client-side JS,
this doesn’t do that.

## Install

This package is [ESM only][github-gist-esm].
In Node.js (version 18+),
install with [npm][npm-install]:

```sh
npm install dead-or-alive
```

In Deno with [`esm.sh`][esm-sh]:

```js
import {deadOrAlive} from 'https://esm.sh/dead-or-alive@1'
```

In browsers with [`esm.sh`][esm-sh]:

```html
<script type="module">
  import {deadOrAlive} from 'https://esm.sh/dead-or-alive@1?bundle'
</script>
```

## Use

```js
import {deadOrAlive} from 'dead-or-alive'

console.log(await deadOrAlive('https://something-that-is-dead.com'))
console.log(await deadOrAlive('https://github.com'))
```

…yields:

```txt
{
  messages: [
    [1:1: Unexpected error fetching `https://something-that-is-dead.com/`] { … }
  ],
  status: 'dead',
  url: undefined,
  urls: undefined
}
{
  messages: [],
  status: 'alive',
  url: 'https://github.com/',
  urls: Set(203) {
    'https://github.githubassets.com/',
    'https://avatars.githubusercontent.com/',
    …
  }
}
```

## API

This package exports the identifiers
[`deadOrAlive`][api-dead-or-alive],
[`defaultAnchorAllowlist`][api-default-anchor-allowlist],
and [`defaultSleep`][api-default-sleep].
It exports the TypeScript types
[`AnchorAllow`][api-anchor-allow],
[`Options`][api-options],
[`Result`][api-result],
and [`Sleep`][api-sleep].
There is no default export.

### `deadOrAlive(href[, options])`

Check if a url is dead or alive.

###### Parameters

* `href` (`URL` or `string`)
  — URL
* `options` ([`Options`][api-options], optional)
  — configuration

###### Returns

Result ([`Promise<Result>`][api-result]).

###### Notes

To improve performance,
decrease `maxRetries` and/or decrease the value used
for `sleep`.
The normal behavior is to assume connections might be flakey and to sleep a
while and retry a couple times.

If you do not care about HTML redirects,
whether anchors work,
and what further URLs are used on,
you can pass `checkAnchor: false`,
`findUrls: false`,
and `followMetaHttpEquiv: false`,
which enables a fast path without parsing HTML.

### `defaultAnchorAllowlist`

Allow certain anchors ([`Array<AnchorAllow>`][api-anchor-allow]).

This currently allows text fragments everywhere.

### `defaultSleep(retries)`

Calculate miliseconds to sleep between tries.

The function is defined as `x ** 3 * 1000`,
so the first sleep is `1 ** 3 * 1000` is 1s,
2nd is 8s,
3rd is 27s,
etc.

###### Parameters

* `retries` (`number`)
  — try

###### Returns

Miliseconds to sleep (`number`).

### `AnchorAllow`

Allow extra anchors ([`Array<AnchorAllow>`][api-anchor-allow]).
The first item is a regular expression to match URLs (origin and path,
so without search or hash),
and the second item is a regular expression to match hashes (without `#`).
When both match,
the hash is allowed.

###### Type

```ts
export type AnchorAllow = [url: RegExp, anchor: RegExp]
```

### `Options`

Configuration (TypeScript type).

###### Fields

* `anchorAllowlist` ([`Array<AnchorAllow>`][api-anchor-allow], default: `true`)
  — allow anchors;
  each tuple is checked to match URLs (origin and path,
  so without search or hash),
  and then to match hashes (without `#`);
  when both match,
  the hash is allowed,
  and no `missing-anchor` error is used
* `checkAnchor` (`boolean`, default: `true`)
  — check whether URL hashes point to elements
* `followMetaHttpEquiv` (`boolean`, default: `true`)
  — follow HTML redirects;
  a `<meta content=0;to http-equiv=refresh>` can be useful for static sites
  such as those on GH pages
* `findUrls` (`boolean`, default: `true`)
  — find URLs in the final resource;
  currently applies to HTML
* `maxRedirects` (`number`, default: `5`)
  — inclusive maximum redirects to follow
* `maxRetries` (`number`, default: `1`)
  — inclusive maximum number to try again on failures
* `resolveClobberPrefix` (`boolean`, default: `true`)
  — accept `user-content-` prefix in `id` on elements
* `sleep` ([`Sleep`][api-sleep], default: [`defaultSleep`][api-default-sleep])
  — calculate miliseconds to sleep between tries
* `timeout` (`number`, default: `3000`)
  — timeout for HTTP request in miliseconds
* `userAgent` (`string`, default: `'Mozilla/5.0 … Safari/537.36'`,
  a modern Chrome on macOS user agent)
  — user agent

### `Result`

Result (TypeScript type).

###### Fields

* `messages` ([`Array<VFileMessage>`][github-vfile-message])
  — messages where the first is a fatal error when dead
* `status` (`'alive'` or `'dead'`)
  — status
* `url` (`string` or `undefined`)
  — final URL if alive
* `urls` (`Set<string>` or `undefined`)
  — further URLs if `findUrls: true` and the resource was HTML

### `Sleep`

Calculate miliseconds to sleep between tries (TypeScript type).

###### Parameters

* `retries` (`number`)
  — try

###### Returns

Miliseconds to sleep (`number`).

## Errors

### `dead`

```txt
Unexpected not ok response `$status` (`$statusText`) on `$url`
```

This error is used when a URL looks temporarily or permenantly dead.

### `fetch`

```txt
Unexpected error fetching `$url`
```

This error is used when for some unknown reason the URL is dead.
It might be that you are offline,
or the URL is temporarily dead,
or something else is wrong.
But it looks dead.

### `lost-hash-with-meta-http-equiv`

```txt
Unexpected hash in URL `$url` that redirects with `meta[http-equiv=refresh] to `$url` losing the hash, remove the hash from the original URL
```

This warning is used when a URL with an anchor gets an HTML redirect,
which looses that anchor.
You can remove the hash from the original URL.
Or find a similar section on the final URL.

### `lost-hash-with-non-html`

```txt
Unexpected hash in URL `$url` to non-html ($contentType) losing the hash, remove the hash from the original URL
```

This warning is used when a URL with an anchor resolves to some non-HTML thing,
which might be an error.
Perhaps you can remove the hash from the original URL?

### `lost-hash-with-redirect`

```txt
Unexpected hash in URL `$url` that redirects to `$url` losing the hash, remove the hash from the original URL
```

This warning is used when a URL with an anchor gets an HTTP redirect,
which looses that anchor.
You can remove the hash from the original URL.
Or find a similar section on the final URL.

### `max-redirect`

```txt
Unexpected redirect to `$url`, too many redirects
```

This error is used when there are more redirects than
`options.maxRedirects`.
Increase this number or use your browser to see if the URL ends up redirecting
to something that works.

### `missing-anchor`

```txt
Unexpected missing anchor element on `$url` for fragment `$fragment`, remove if unneeded or refer to an existing element
```

This error is used when a hash is used in a URL but no such element can be
found.
Elements can match hashes by their `id` or by their `name` (when `<a>`).
The prefix `user-content-` is ignored on elements as that’s what GitHub and
[`rehype-sanitize`][github-rehype-sanitize] use to solve DOM clobbering.

Remove the hash if unneeded or refer to a different,
existing element.

### `shared-declarative-refresh`

```txt
Unexpected invalid URL `$url` in `content` on `meta[http-equiv=refresh] relative to `$url`
```

This error is used when an HTML redirect such as
`<meta content=0;xxx http-equiv=refresh>` is used,
but `xxx` does not parse as a URL.
Use your browser to see if the URL ends up redirecting to something that works.

## Compatibility

This projects is compatible with maintained versions of Node.js.

When we cut a new major release,
we drop support for unmaintained versions of Node.
This means we try to keep the current release line,
`dead-or-alive@1`,
compatible with Node.js 18.

## Security

This package is safe.

## Contribute

Yes please!
See [How to Contribute to Open Source][open-source-guide-contribute].

## License

[MIT][file-license] © [Titus Wormer][wooorm]

<!-- Definitions -->

[api-anchor-allow]: #anchorallow

[api-dead-or-alive]: #deadoralivehref-options

[api-default-anchor-allowlist]: #defaultanchorallowlist

[api-default-sleep]: #defaultsleepretries

[api-options]: #options

[api-result]: #result

[api-sleep]: #sleep

[badge-build-image]: https://github.com/wooorm/dead-or-alive/workflows/main/badge.svg

[badge-build-url]: https://github.com/wooorm/dead-or-alive/actions

[badge-coverage-image]: https://img.shields.io/codecov/c/github/wooorm/dead-or-alive.svg

[badge-coverage-url]: https://codecov.io/github/wooorm/dead-or-alive

[badge-downloads-image]: https://img.shields.io/npm/dm/dead-or-alive.svg

[badge-downloads-url]: https://www.npmjs.com/package/dead-or-alive

[badge-size-image]: https://img.shields.io/bundlejs/size/dead-or-alive

[badge-size-url]: https://bundlejs.com/?q=dead-or-alive

[npm-install]: https://docs.npmjs.com/cli/install

[esm-sh]: https://esm.sh

[file-license]: license

[github-gist-esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[github-rehype-sanitize]: https://github.com/rehypejs/rehype-sanitize

[github-remark-lint-no-dead-urls]: https://github.com/remarkjs/remark-lint-no-dead-urls

[github-vfile-message]: https://github.com/vfile/vfile-message

[open-source-guide-contribute]: https://opensource.guide/how-to-contribute/

[wooorm]: https://wooorm.com
