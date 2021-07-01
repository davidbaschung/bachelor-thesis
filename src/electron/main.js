console.log("main.js electron loaded");

/* This file allows us to adjust some parameter of the desktop-app, like the window size */
const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
  const win = new BrowserWindow({
    width: 500,
    height: 800,
    webPreferences: {
      preload: "preload.js",
    }
  })

  console.log("requesting client file");
  win.loadFile('src/client/index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
