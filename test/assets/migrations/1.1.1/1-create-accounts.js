'use strict'

exports.up = function (opts) {
  return opts.schema.createTable('accounts', function (table) {
    table.string('platform')
  })
}

exports.down = function () {
}
