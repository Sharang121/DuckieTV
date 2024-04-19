/**
 * Offscreen worker that creates a web worker to handle SQLite database operations.
 * A web worker is required to get access to the Origin private file system (OPFS) API for the SQLite database.
 * It is only available to web workers.
 */
const worker = new Worker(new URL(chrome.runtime.getURL('worker/worker.js')))

worker.postMessage({
  type: 'sendLocalStorage',
  payload: JSON.stringify(localStorage)
})

worker.onmessage = function ({ data }) {
  switch (data.type) {
    case 'setLocalStorageItem':
      localStorage.setItem(data.payload.key, data.payload.value)
      break
    case 'crud':
      chrome.runtime.sendMessage({
        __type: 'CRUDResponse',
        ...data.payload
      })
      break
    default:
      console.error(`ERROR: Unhandled message: ${data.type}`)
  }
}

worker.onerror = function (error) {
  console.error('worker error', error)
}

async function handleMessage(message) {
  if (message.__type !== 'CRUDRequest') {
    return
  }

  worker.postMessage({
    type: 'CRUDRequest',
    payload: message
  })
}

chrome.runtime.onMessage.addListener(handleMessage)

window.addEventListener('storage', function () {
  worker.postMessage({
    type: 'sendLocalStorage',
    payload: JSON.stringify(localStorage)
  })
}, false)
