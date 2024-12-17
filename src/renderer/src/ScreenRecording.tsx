import React, { useState, useRef } from 'react'

function ScreenRecording() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null) // Ref for mediaRecorder
  const chunksRef = useRef<Blob[]>([]) // Ref to store video chunks
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null) // Ref to store interval ID

  const startRecording = async () => {
    try {
      const displayStream: MediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          width: 1920,
          height: 1080,
          frameRate: 30
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = displayStream
        videoRef.current.onloadedmetadata = () => videoRef.current.play()
      }

      setStream(displayStream)

      const mediaRecorder = new MediaRecorder(displayStream)
      mediaRecorderRef.current = mediaRecorder // Store mediaRecorder in the ref

      // Collect video chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data) // Store each chunk in the array
        }
      }

      // Start recording and capture data every second
      mediaRecorder.start(1000)

      // Set interval to send accumulated chunks every 10 seconds
      intervalIdRef.current = setInterval(() => {
        if (chunksRef.current.length > 0) {
          const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })

          const reader = new FileReader()
          reader.onload = () => {
            // Send the accumulated video data to the server via WebSocket
            // socket.emit('video-data', { chunk: reader.result })

            // Clear the chunks after sending
            chunksRef.current = []
          }

          reader.readAsArrayBuffer(videoBlob)
        }
      }, 10000) // 10 seconds
    } catch (error) {
      console.error('Error accessing media devices.', error)
    }
  }

  const stopRecording = () => {
    // Stop the media recorder and clear the interval
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      // socket.emit('end-recording')
    }

    // Stop and clear the stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    // Pause the video
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    // Clear the interval and send any remaining chunks
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null

      // Send remaining chunks if any
      if (chunksRef.current.length > 0) {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          // socket.emit('video-data', reader.result)
          chunksRef.current = []
        }
        reader.readAsArrayBuffer(videoBlob)
      }
    }

    // Save the recorded video
    if (chunksRef.current.length > 0) {
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(videoBlob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'recording.webm'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      chunksRef.current = []
    }
  }

  return (
    <div
      className="right-content"
      style={{ height: '100vh', width: '84vw', display: 'flex', flexDirection: 'column' }}
    >
      <button onClick={startRecording}>Start Recording</button>
      <button onClick={stopRecording}>Stop Recording</button>
      <video hidden ref={videoRef} controls></video>
    </div>
  )
}

export default ScreenRecording
