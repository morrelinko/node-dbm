'use strict'

exports.up = function (opts) {
  return Promise.reject(new Error('some insert error.'))
}

exports.down = function () {
  return Promise.resolve()
}
