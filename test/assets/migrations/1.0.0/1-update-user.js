'use strict'

exports.up = function (opts) {
  return opts.transaction('users')
    .where('email', '=', 'johndoe@gmail.com')
    .update({name: 'JohnDoer'})
}

exports.down = function () {

}
