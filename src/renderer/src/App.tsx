import ScreenRecording from "./ScreenRecording"

function App(): JSX.Element {
  const handleCapture = () => {
    // Send a message to the main process to capture the screenshots
    window.electron.ipcRenderer.invoke('capture-screenshots')
  }

  return (
    <>
      <div>
        <button onClick={handleCapture}>Capture Screenshots</button>
        <ScreenRecording />
      </div>
    </>
  )
}

export default App
