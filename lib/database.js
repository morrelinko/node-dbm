'use strict'

const knex = require('knex')

exports.connect = function (opts) {
  opts = opts || {}
  let client = opts.client

  if (client === 'sqlite3') {
    opts.useNullAsDefault = opts.useNullAsDefault || false
  }

  if (client === 'mysql') {
    opts.connection.timezone = 'UTC'
    opts.connection.charset = 'utf8mb4'
  }

  return knex(opts)
}
