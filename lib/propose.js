/**
 * @typedef {[value: string, score: number]} ValueScoreTuple
 */

import {levenshteinEditDistance} from 'levenshtein-edit-distance'

const relativeThreshold = 0.5
const max = 4

/**
 * @param {string} value
 * @param {ReadonlyArray<string>} ideas
 * @returns {Array<string>}
 */
export function propose(value, ideas) {
  return ideas
    .map((d) => score(value, d))
    .sort(sort)
    .filter((d) => filter(d))
    .map((d) => pick(d))
    .slice(0, max)
}

/**
 * @param {string} value
 * @param {string} d
 * @returns {ValueScoreTuple} d
 */
function score(value, d) {
  return [d, levenshteinEditDistance(value, d) / value.length]
}

/**
 * @param {ValueScoreTuple} a
 * @param {ValueScoreTuple} b
 * @returns {number}
 */
function sort(a, b) {
  return a[1] - b[1]
}

/**
 * @param {ValueScoreTuple} d
 * @returns {boolean}
 */
function filter(d) {
  return d[1] < relativeThreshold
}

/**
 * @param {ValueScoreTuple} d
 * @returns {string}
 */
function pick(d) {
  return d[0]
}
