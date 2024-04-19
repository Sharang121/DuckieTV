/**
 * Web Worker that handles CRUD operations to the SQLite database using web assembly.
 * The database is stored in the Origin private file system (OPFS) API.
 */

importScripts('./sqlite3.js')
importScripts('../js/vendor/CRUD.js')
importScripts('./CRUD.WorkerSqliteAdapter.js')
importScripts('../js/CRUD.entities.js')

globalThis.localStorage = {
  data: {},
  getItem: function (key) {
    return this.data[key]
  },
  setItem: function (key, value) {
    this.data[key] = value

    postMessage({
      type: 'setLocalStorageItem',
      payload: { key, value }
    })
  },
  updateData: function (data) {
    this.data = data
    CRUD.DEBUG = this.data['CRUD.DEBUG'] === 'true' || this.data['CRUD.DEBUG'] === true || this.data['CRUD.DEBUG'] == 1
  }
}

CRUD.setAdapter(new CRUD.WorkerSqliteAdapter('seriesguide_chrome', {
  estimatedSize: 25 * 1024 * 1024
}))

function sendMessage(data) {
  postMessage({
    type: 'crud',
    payload: data
  })
}

self.onmessage = function (message) {
  if (!message || !message?.data?.type) {
    console.warn('No message type found', message)
    return
  }

  const payload = message.data.payload
  switch (message.data.type) {
    case 'sendLocalStorage':
      globalThis.localStorage.updateData(JSON.parse(payload))
      break
    case 'CRUDRequest':
      handleCRUDRequest(payload)
      break
    default:
      console.error(`ERROR: Unhandled message: ${message}`)
  }
}

// apparently the original socket logic automatically ran .toJSON() on the CRUD entity results which the new worker does not do
// so we need to do the same here
function getResult(results) {
  if (Array.isArray(results)) {
    return results.map(function(result) {
      return getResult(result)
    })
  }

  if ('toJSON' in results) {
    return results.toJSON()
  }

  return results
}

function handleCRUDRequest(msg) {
  switch (msg.command) {
    case 'Find':
      CRUD.Find(msg.what, msg.filters, msg.options).then(function(result) {
        sendMessage({
          guid: msg.guid,
          result: getResult(result),
          Action: 'find'
        })
      }, function(err) {
        console.error('Error: ', err, msg)
        sendMessage({
          guid: msg.guid,
          error: err
        })
      })
      break
    case 'Persist':
      var tmp = CRUD.fromCache(msg.type, msg.values)
      var isNew = msg.ID === false
      if (!isNew) {
        tmp.__values__[CRUD.EntityManager.getPrimary(msg.type)] = msg.ID
      }
      tmp.Persist().then(function(result) {
        sendMessage({
          guid: msg.guid,
          result: {
            ID: tmp.getID(),
            Action: isNew ? 'inserted' : 'updated'
          }
        })
      }, function(err) {
        console.error('Error: ', err, msg)
        sendMessage({
          guid: msg.guid,
          error: err
        })
      })
      break
    case 'Delete':
      var tmp = CRUD.fromCache(msg.type, msg.values)
      tmp.Delete().then(function(result) {
        sendMessage({
          guid: msg.guid,
          result: getResult(result),
          Action: 'deleted'
        })
      }, function(err) {
        console.error('Error: ', err, msg)
        sendMessage({
          guid: msg.guid,
          error: err
        })
      })
      break
    case 'query':
      CRUD.executeQuery(msg.sql, msg.params).then(function(result) {
        sendMessage({
          guid: msg.guid,
          result: getResult(result),
          action: 'query'
        })
      }, function(err) {
        console.error('Error: ', err, msg)
        sendMessage({
          guid: msg.guid,
          error: err
        })
      })
      break
  }
}
