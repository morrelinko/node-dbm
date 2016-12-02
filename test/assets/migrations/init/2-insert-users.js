'use strict'

const Promise = require('bluebird')

exports.up = function (opts) {
  let promises = []

  promises.push(opts.transaction('users').insert({
    name: 'John Doe',
    email: 'johndoe@gmail.com'
  }))

  return Promise.all(promises)
}

exports.down = function () {

}
