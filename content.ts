// @ts-nocheck

const injector = document.createElement('script')!

injector.src = chrome.runtime.getURL('./socket.js')

injector.addEventListener('load', function () {
    this.parentNode?.removeChild(this)
})

const doc = document.body || document.head || document.documentElement

doc.appendChild(injector)
