'use strict'

const fs = require('fs')
const path = require('path')
const jetpack = require('fs-jetpack')
const should = require('should')
const sinon = require('sinon')
const errors = require('../lib/errors')
const dbm = require('../')

const sandbox = sinon.sandbox.create()

describe('DBM', function () {
  describe('Migrator', function () {
    let migrator
    let db = path.join(process.cwd(), 'test/assets/test.db')

    before(function () {
      if (fs.existsSync(db)) {
        fs.unlinkSync(db)
      }

      jetpack.remove('test/assets/migrations/1.2.0')
      jetpack.remove('test/assets/migrations/1.3.0')
      jetpack.remove('test/assets/migrations/1.4.0')
    })

    before(function () {
      migrator = new dbm.Migrator({
        path: path.join(process.cwd(), 'test/assets/migrations'),
        version: '1.3.0',
        database: {
          client: 'sqlite3',
          connection: {
            filename: db
          }
        }
      })
    })

    beforeEach(function () {
      sandbox.spy(migrator, 'beforeTask')
      sandbox.spy(migrator, 'afterTask')
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('ready() --> fail initialize', function () {
      return migrator.connect()
        .then(() => {
          return migrator.ready()
        })
        .then(() => {
          throw new Error('Database should not be ok')
        })
        .catch(err => {
          should.exist(err)
          should(err).be.instanceOf(errors.MigrationError)
          should(err.code).eql('MIGRATION_NOT_INITIALISED')
        })
        .finally(() => {
          return migrator.disconnect()
        })
    })

    it('init()', function () {
      let connect = migrator.connect()

      return connect.then(() => migrator.init())
        .then(() => connect.value().raw('SELECT * from users;'))
        .then(values => {
          should(values.length).eql(1)
          values[0].name.should.eql('John Doe')

          return connect.value().raw('SELECT * from migrations;')
        })
        .then(function (values) {
          should(values.length).eql(2)
          should(values[0].name).eql('1-create-users.js')
          should(values[0].version).eql('init')

          should(values[1].name).eql('2-insert-users.js')
          should(values[1].version).eql('init')

          should(migrator.beforeTask.called).eql(true)
          should(migrator.beforeTask.callCount).eql(2)

          should(migrator.afterTask.called).eql(true)
          should(migrator.afterTask.callCount).eql(2)
        })
        .finally(() => {
          return migrator.disconnect()
        })
    })

    it('ready() --> fail needs migration', function () {
      return migrator.connect()
        .then(() => {
          return migrator.ready()
        })
        .then(() => {
          throw new Error('Database should not be ok')
        })
        .catch(function (err) {
          should.exist(err)
          should(err).be.instanceOf(errors.MigrationError)
          should(err.code).eql('MIGRATION_NEEDED')
        })
        .finally(() => migrator.disconnect())
    })

    // Calling init() twice should not affect migration state
    it('init() twice', function () {
      let connect = migrator.connect()

      return connect.then(() => migrator.init())
        .then(() => connect.value().raw('SELECT * FROM users;'))
        .then(result => {
          should(result.length).eql(1)

          return connect.value().raw('SELECT * from migrations;')
        })
        .then(result => {
          should(result.length).eql(2)

          should(migrator.beforeTask.called).eql(true)
          should(migrator.beforeTask.callCount).eql(2)

          should(migrator.afterTask.called).eql(false)
        })
        .finally(() => migrator.disconnect())
    })

    // Calling init() twice should not migrate to latest version
    it('ready() --> fail needs migration', function () {
      return migrator.connect()
        .then(() => {
          return migrator.ready()
        })
        .then(() => {
          throw new Error('Database should not be ok')
        })
        .catch(function (err) {
          should.exist(err)
          should(err).be.instanceOf(errors.MigrationError)
          should(err.code).eql('MIGRATION_NEEDED')
        })
        .finally(() => migrator.disconnect())
    })

    it('migrate() --> 1.0.0 and 1.1.1', function () {
      // this.timeout(3000)

      let connect = migrator.connect()

      return connect
        .then(() => migrator.migrate())
        .then(() => connect.value().raw('select * from migrations;'))
        .then(result => {
          should(result.length).eql(4)

          should(result[0].name).eql('1-create-users.js')
          should(result[0].version).eql('init')

          should(result[1].name).eql('2-insert-users.js')
          should(result[1].version).eql('init')

          should(result[2].name).eql('1-update-user.js')
          should(result[2].version).eql('1.0.0')

          should(result[3].name).eql('1-create-accounts.js')
          should(result[3].version).eql('1.1.1')

          // before and after task should be called 2 times.
          // First two tasks executed at init()
          should(migrator.beforeTask.called).eql(true)
          should(migrator.beforeTask.callCount).eql(2)
          should(migrator.afterTask.called).eql(true)
          should(migrator.afterTask.callCount).eql(2)
        })
        .finally(() => {
          connect = null
          migrator.disconnect()
        })
    })

    it('ready() --> pass', function () {
      return migrator.connect()
        .then(() => migrator.ready())
    })

    it('migrate() --> 1.2.0', function () {
      jetpack.copy('test/assets/upgrades/1.2.0', 'test/assets/migrations/1.2.0')

      let connect = migrator.connect()

      return connect
        .then(() => migrator.migrate())
        .then(() => connect.value().raw('select * from migrations;'))
        .then(result => {
          should(result.length).eql(5)
        })
        .finally(() => {
          connect = null
          migrator.disconnect()
        })
    })

    it('migrate() --> 1.3.0 with error', function () {
      jetpack.copy('test/assets/upgrades/1.3.0', 'test/assets/migrations/1.3.0', {overwrite: true})
      jetpack.remove('test/assets/migrations/1.3.0/2-fixed-task.js')

      let connect = migrator.connect()

      return connect
        .then(() => migrator.migrate())
        .catch(function (err) {
          should.exist(err)
          should(err.message).eql('some insert error.')
          return connect.value().raw('select * from migrations;')
        })
        .then(result => {
          should(result.length).eql(5)
        })
        .finally(() => {
          connect = null
          migrator.disconnect()
        })
    })

    it('migrate() --> 1.3.0 with fixed error', function () {
      jetpack.copy('test/assets/upgrades/1.3.0', 'test/assets/migrations/1.3.0', {overwrite: true})
      jetpack.remove('test/assets/migrations/1.3.0/2-error-task.js')

      let connect = migrator.connect()

      return connect
        .then(() => migrator.migrate())
        .then(() => connect.value().raw('select * from migrations;'))
        .then(result => {
          should(result.length).eql(7)
        })
        .finally(() => {
          connect = null
          migrator.disconnect()
        })
    })

    it('migrate() --> above current version 1.3.0', function () {
      jetpack.copy('test/assets/upgrades/1.4.0', 'test/assets/migrations/1.4.0', {overwrite: true})

      let connect = migrator.connect()

      return connect
        .then(() => migrator.migrate())
        .then(() => connect.value().raw('select * from migrations;'))
        .then(result => {
          should(result.length).eql(7)
        })
        .finally(() => {
          connect = null
          migrator.disconnect()
        })
    })
  })
})
