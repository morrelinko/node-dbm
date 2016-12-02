# DBM

Data Base Manager - built on top of [KnexJs](http://knexjs.org), provides utility db management tools.

### Migrator

Migration based on app versions. Inspired by [knex-migrator] from Ghost

##### Usage

```javascript
const dbm = require('dbm')

const migrator = new dbm.Migrator({
  path: path.join(process.cwd(), 'data/migrations'),
  version: '1.3.0', 
  database: { // knex connection config
    client: 'sqlite3',
    connection: {
      filename: 'data/test.db'
    }
  }
})

migrator.connect() // connect to database
    .then(() => migrator.init()) // initialize migration
    .then(() => migrator.migrate()) // run migrations up to version 1.3.0
    .finally(() => migrator.disconnect()) // disconnect
```

##### Folder Structure

```text
    data
    |-- migrations
    |----- init
    |-------- 1-create-tables.js
    |----- 1.0.0
    |-------- 1-modify-user-columns.js
    |----- 1.2.0
    |-------- 1-drop-refer-column.js
```

##### API

migrator.connect()

migrator.ready()

migrator.init()

migrator.analyse()

migrator.migrate()

migrator.migrateTo()

migrator.disconnect()

### Exporter

[WIP]
