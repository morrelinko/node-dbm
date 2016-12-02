'use strict'

const SimpleError = require('simplerror')

exports.MigrationError = class MigrationError extends SimpleError {
  constructor (opts) {
    super(opts)
    this.name = 'MigrationError'
  }
}
