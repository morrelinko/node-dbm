'use strict'

const path = require('path')
const assign = require('deep-assign')
const Promise = require('bluebird')
const _ = require('lodash')
const semver = require('semver')
const db = require('./database')
const filesystem = require('./filesystem')
const errors = require('./errors')

module.exports = class Migrator {
  constructor (opts = {}) {
    opts = assign({
      database: {},
      migration: {
        path: null
      }
    }, opts)

    if (!opts.database) {
      throw new errors.MigrationError({
        message: 'Migrator needs to export a database config.',
        code: 'INVALID_CONFIG'
      })
    }

    if (!opts.path) {
      throw new errors.MigrationError({
        message: 'Migrator needs to export the location of your migration files.',
        code: 'INVALID_CONFIG'
      })
    }

    this.connection = null
    this.opts = opts
  }

  init () {
    let connection = this.connection
    let promise = this.createDatabase()

    promise = promise.then(() => {
      return connection.transaction(transaction => {
        return this.migrateTo({
          version: 'init',
          transaction
        })
      })
    })

    promise = promise.then(() => {
      // Success
    })

    promise = promise.catch(err => {
      return Promise.reject(err)
    })

    return promise
  }

  migrate () {
    let connection = this.connection

    let promise = connection.transaction(transaction => {
      let versions = []

      let p = Promise.resolve(this.analyse({
        connection: transaction,
        exclude: ['init']
      }))

      p = p.then(result => {
        for (let version in result) {
          let value = result[version]

          if (value.expected !== value.actual) {
            versions.push(version)
          }
        }
      })

      p = p.then(() => {
        if (!versions.length) {
          return Promise.resolve()
        }

        return Promise.each(versions, version => {
          return this.migrateTo({
            version: version,
            transaction
          })
        })
      })

      return p
    })

    promise = promise.then(() => {
      // Success
    })

    promise = promise.catch(err => {
      return Promise.reject(err)
    })

    return promise
  }

  migrateTo (opts) {
    let tasks = this.getTasks(opts.version)

    opts.schema = opts.transaction.schema

    return Promise.each(tasks, task => {
      let promise = Promise.resolve()

      promise = promise.then(() => this.beforeTask(assign(opts, {task})))

      promise = promise.then(() => task.up(opts))

      promise = promise.then(() => this.afterTask(assign(opts, {task})))

      promise = promise.catch(err => {
        if (err instanceof errors.MigrationError &&
          err.code === 'MIGRATION_ALREADY_INITIALIZED') {
          return Promise.resolve()
        }

        throw err
      })

      return promise
    })
  }

  analyse (opts = {}) {
    opts = assign(opts, {
      connection: this.connection,
      exclude: []
    })

    let connection = opts.connection
    let folders = filesystem.folders(this.opts.path)
    let lookups = {}
    let result = {}

    folders.forEach(folder => {
      if (opts.exclude.indexOf(folder) !== -1) {
        return void 0
      }

      // Disallow running migrations above current version
      if (this.opts.version && folder !== 'init') {
        if (semver.gt(folder, this.opts.version)) {
          return void 0
        }
      }

      lookups[folder] = connection('migrations')
        .where({version: folder})
        .catch(function migratorLookupError (err) {
          // CASE: database does not exist
          if (err.errno === 1049) {
            throw new errors.MigrationError({
              message: 'Please initialize migration',
              code: 'MIGRATION_TABLE_MISSING'
            })
          }

          // CASE: table does not exist
          if (err.errno === 1 || err.errno === 1146) {
            throw new errors.MigrationError({
              message: 'Please initialize migration',
              code: 'MIGRATION_NOT_INITIALISED'
            })
          }

          throw err
        })
    })

    return Promise.props(lookups)
      .then(tasks => {
        for (let version in tasks) {
          let task = tasks[version]

          let actual = task.length
          let expected = this.getTasks(version).length
          result[version] = {actual, expected}
        }

        return result
      })
  }

  ready () {
    let promise = this.analyse()

    promise = promise.tap(result => {
      if (result.init && result.init.expected !== result.init.actual) {
        throw new errors.MigrationError({
          message: 'Please run migration',
          code: 'MIGRATION_NEEDED'
        })
      }

      _.each(_.omit(result, 'init'), function (value) {
        if (value.expected !== value.actual) {
          throw new errors.MigrationError({
            message: 'Please run migration',
            code: 'MIGRATION_NEEDED'
          })
        }
      })
    })

    return promise
  }

  beforeTask (opts = {}) {
    return opts.transaction('migrations')
      .then(function (migrations) {
        if (!migrations.length) {
          return void 0
        }

        if (_.find(migrations, {name: opts.task.name, version: opts.version})) {
          throw new errors.MigrationError({
            message: 'Migration already initialized.',
            code: 'MIGRATION_ALREADY_INITIALIZED'
          })
        }
      })
      .catch(function (err) {
        // CASE: table does not exist
        if (err.errno === 1 || err.errno === 1146) {
          return opts.transaction.schema.createTable('migrations', function (table) {
            table.string('name')
            table.string('version')
          })
        }

        throw err
      })
  }

  afterTask (opts = {}) {
    return opts.transaction('migrations').insert({
      name: opts.task.name,
      version: opts.version
    })
  }

  connect () {
    if (!this.connection) {
      this.connection = db.connect(this.opts.database)
    }

    return Promise.resolve(this.connection)
  }

  disconnect () {
    if (!this.connection) {
      return Promise.resolve()
    }

    let promise = this.connection.destroy()

    this.connection = null

    return promise
  }

  createDatabase () {
    let connection = this.connection
    let config = this.opts.database
    let name = config.connection.database
    let charset = config.connection.charset

    if (config.client === 'sqlite3') {
      return Promise.resolve()
    }

    return connection.raw('CREATE DATABASE IF NOT EXISTS ' + name + (
        charset ? (' CHARACTER SET ' + charset) : ''))
      .catch(err => {
        // CASE: DB exists
        if (err.errno === 1007) {
          return Promise.resolve()
        }

        throw new errors.DatabaseError({
          err: err,
          code: 'DBM_CREATE_DB_FAILED'
        })
      })
  }

  getTasks (version) {
    let files = []
    let tasks = []

    let migrationPath = path.join(this.opts.path, version)

    try {
      files = filesystem.files(migrationPath)
    } catch (err) {
      throw new errors.MigrationError({
        message: 'Migration path not found: ' + migrationPath,
        code: 'INVALID_MIGRATION_PATH'
      })
    }

    files.forEach(file => {
      try {
        let e = require(path.join(migrationPath, file))

        tasks.push({
          name: file,
          up: e.up,
          down: e.down
        })
      } catch (e) {
      }
    })

    return tasks
  }
}
