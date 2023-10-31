import {VFileMessage} from 'vfile-message'

/**
 * Implementation of <https://html.spec.whatwg.org/multipage/semantics.html#shared-declarative-refresh-steps>.
 *
 * @param {string} input
 * @param {Readonly<URL>} from
 * @returns {URL | undefined}
 */
export function sharedDeclarativeRefresh(input, from) {
  // 2.
  let position = 0
  // 3.
  skipAsciiWhitespace()
  // 4.
  let before = position

  // 5. Skip time.
  while (position < input.length && asciiDigit(input.charCodeAt(position))) {
    position++
  }

  // 6. and 6.1
  if (position === before && !dot(input.charCodeAt(position))) {
    return
  }

  // 7. (unneeded).

  // 8. Discard more digits and dots.
  while (
    position < input.length &&
    asciiDigitOrDot(input.charCodeAt(position))
  ) {
    position++
  }

  // 9. (unneeded).
  // 10.
  before = position

  if (position < input.length) {
    // 10.2.
    skipAsciiWhitespace()

    // 10.3.
    if (commaOrSemicolon(input.charCodeAt(position))) {
      position++
    }

    // 10.4.
    skipAsciiWhitespace()
  }

  // 10.1: if no `,` or `;` was found, exit; or: 11.0.
  if (before === position || position === input.length) return

  // 11.1.
  let urlString = input.slice(position)
  let quote = 0

  // 11.2.
  let code = input.charCodeAt(position)
  if (code !== 85 /* `U` */ && code !== 117 /* `u` */) return skipQuotes()
  position++

  // 11.3.
  code = input.charCodeAt(position)
  if (code !== 82 /* `R` */ && code !== 114 /* `r` */) return parse()
  position++

  // 11.4.
  code = input.charCodeAt(position)
  if (code !== 76 /* `L` */ && code !== 108 /* `l` */) return parse()
  position++

  // 11.5.
  skipAsciiWhitespace()

  // 11.6.
  if (input.charCodeAt(position) !== 61 /* `=` */) return parse()
  position++

  // 11.7.
  skipAsciiWhitespace()
  // 11.8.
  return skipQuotes()

  // 11.8.
  function skipQuotes() {
    const code = input.charCodeAt(position)

    if (code === 34 /* `"` */ || code === 39 /* `'` */) {
      quote = code
      position++
    }

    // 11.9.
    urlString = input.slice(position)

    // 11.10.
    if (quote) {
      const index = urlString.indexOf(String.fromCharCode(quote))

      if (index !== -1) urlString = urlString.slice(0, index)
    }

    return parse()
  }

  function parse() {
    try {
      return new URL(urlString, from)
    } catch (error) {
      const cause = /** @type {Error} */ (error)
      const message = new VFileMessage(
        'Unexpected invalid URL `' +
          urlString +
          '` in `content` on `meta[http-equiv=refresh] relative to `' +
          from.href +
          '`',
        {cause, ruleId: 'shared-declarative-refresh', source: 'dead-or-alive'}
      )
      message.url = 'https://github.com/wooorm/dead-or-alive#' + message.ruleId
      message.fatal = true
      throw message
    }
  }

  function skipAsciiWhitespace() {
    while (
      position < input.length &&
      asciiWhitespace(input.charCodeAt(position))
    ) {
      position++
    }
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  function asciiDigit(code) {
    return code >= 48 /* `0` */ && code <= 57
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  function asciiDigitOrDot(code) {
    return asciiDigit(code) || dot(code)
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  function asciiWhitespace(code) {
    return (
      code === 9 /* `\t` */ ||
      code === 10 /* `\n` */ ||
      code === 12 /* `\f` */ ||
      code === 13 /* `\r` */ ||
      code === 32 /* ` ` */
    )
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  function dot(code) {
    return code === 46 /* `.` */
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  function commaOrSemicolon(code) {
    return code === 44 /* `,` */ || code === 59 /* `;` */
  }
}
