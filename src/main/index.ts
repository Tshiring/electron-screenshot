import { app, shell, BrowserWindow, ipcMain, desktopCapturer, screen, session } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import { joinImages } from 'join-images'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const captureScreenshots = async () => {
    const imgPaths: string[] = []
    const displays = screen.getAllDisplays()
    const screenshotDir = path.join(__dirname, 'screenshots')

    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir)
    }

    for (const display of displays) {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: display.size // Match the display's size
        })

        // Find the source matching the display
        const matchingSource = sources.find((source) => source.display_id === display.id.toString())

        if (matchingSource) {
          const screenshotPath = path.join(screenshotDir, `screenshot-${display.id}.png`)

          // Save the thumbnail to a file
          fs.writeFileSync(screenshotPath, matchingSource.thumbnail.toPNG())
          console.log(`Screenshot saved for display ${display.id} at ${screenshotPath}`)
          imgPaths.push(screenshotPath)
        } else {
          console.error(`No matching source found for display ${display.id}`)
        }
      } catch (error) {
        console.error(`Error capturing screenshot for display ${display.id}:`, error)
      }
    }

    if (imgPaths.length > 0) {
      // Merge the screenshots into one using `join-images`
      try {
        const outputPath = path.join(screenshotDir, 'merged-output.png')
        const img = await joinImages(imgPaths, { direction: 'horizontal' })
        await img.toFile(outputPath)
        for (const imgPath of imgPaths) {
          fs.unlinkSync(imgPath)
        }
      } catch (error) {
        console.error('Error merging images:', error)
      }
    }
  }

  ipcMain.handle('capture-screenshots', async () => {
    await captureScreenshots()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Grant access to the first screen found.
      callback({ video: sources[0], audio: 'loopback' })
    })
    // If true, use the system picker if available.
    // Note: this is currently experimental. If the system picker
    // is available, it will be used and the media request handler
    // will not be invoked.
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main
