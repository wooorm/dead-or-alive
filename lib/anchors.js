/**
 * @import {Element, Root} from 'hast'
 */

/**
 * @typedef Anchor
 * @property {Element} [systemId]
 * @property {Element} [systemName]
 * @property {Element} [userId]
 * @property {Element} [userName]
 *
 * @typedef Options
 * @property {boolean} resolveClobberPrefix
 *   Accept `user-content-` prefix on elements.
 */

import {visit} from 'unist-util-visit'

const clobberPrefix = 'user-content-'

/**
 * @param {Root} tree
 * @param {Options} options
 * @returns {Map<string, Anchor>}
 */
export function getAnchors(tree, options) {
  /** @type {Map<string, Anchor>} */
  const map = new Map()

  visit(tree, 'element', function (node) {
    if (node.properties.id) {
      set('Id', String(node.properties.id), node)
    }

    // Continue walking: `id` is preferred.
    if (node.tagName === 'a' && node.properties.name) {
      set('Name', String(node.properties.name), node)
    }
  })

  return map

  /**
   * @param {'Id' | 'Name'} type
   * @param {string} value
   * @param {Element} node
   */
  function set(type, value, node) {
    /** @type {'system' | 'user'} */
    let kind = 'system'

    if (value.startsWith(clobberPrefix) && options.resolveClobberPrefix) {
      value = value.slice(clobberPrefix.length)
      kind = 'user'
    }

    let anchor = map.get(value)
    if (!anchor) {
      anchor = {}
      map.set(value, anchor)
    }

    anchor[`${kind}${type}`] = node
  }
}
