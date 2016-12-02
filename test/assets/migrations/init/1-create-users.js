'use strict'

const Promise = require('bluebird')

exports.up = function (opts) {
  let promises = []

  promises.push(opts.schema.createTable('users', function (table) {
    table.string('name')
    table.string('email')
  }))

  return Promise.all(promises)
}

exports.down = function () {
  console.log('Executing DOWN() Task In Init')
}
