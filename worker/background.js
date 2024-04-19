/**
 * Background Service Worker for the extension that creates an offscreen document that can run a web worker to handle SQLite database operations.
 */

let creating
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  if (await chrome.offscreen.hasDocument?.()) {
    return
  }

  // create offscreen document
  if (creating) {
    await creating
  } else {
    creating = chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(path),
      reasons: [
        chrome.offscreen.Reason.WORKERS || chrome.offscreen.Reason.BLOBS
      ],
      justification: 'To run web worker to run sqlite'
    })

    await creating
    creating = null
  }
}

setupOffscreenDocument('worker/offscreen.html')
