'use strict'

const jetpack = require('fs-jetpack')

exports.folders = function (path) {
  let folders = jetpack.cwd(path).list()

  if (!folders) {
    folders = []
  }

  return folders
}

exports.files = function (path) {
  return exports.folders(path)
}
