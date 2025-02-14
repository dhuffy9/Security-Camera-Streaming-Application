// Get references to the video elements
const localVideo = document.getElementById('localVideo');
const serverVideo = document.getElementById('serverVideo');

// Set up a MediaSource for the server video stream
const mediaSource = new MediaSource();
serverVideo.src = URL.createObjectURL(mediaSource);
let sourceBuffer;
let bufferQueue = [];

mediaSource.addEventListener('sourceopen', () => {
  // Create a SourceBuffer. Make sure the mime type matches what MediaRecorder outputs.
  const mimeType = 'video/webm; codecs="vp8, opus"';
  if (MediaSource.isTypeSupported(mimeType)) {
    sourceBuffer = mediaSource.addSourceBuffer(mimeType);
    sourceBuffer.mode = 'sequence';

    // When the sourceBuffer is done updating, process any queued chunks
    sourceBuffer.addEventListener('updateend', () => {
      if (bufferQueue.length > 0 && !sourceBuffer.updating) {
        sourceBuffer.appendBuffer(bufferQueue.shift());
      }
    });
  } else {
    console.error('MIME type not supported:', mimeType);
  }
});

// Access the user's webcam
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then((stream) => {
    // Show the local stream in the first video element
    localVideo.srcObject = stream;

    // Configure MediaRecorder with the same mime type
    const options = { mimeType: 'video/webm; codecs="vp8, opus"' };
    const mediaRecorder = new MediaRecorder(stream, options);
    
    // Open a WebSocket connection to the server
    const socket = new WebSocket('ws://localhost:8000/ws');
    socket.binaryType = 'arraybuffer';
    
    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    // When a data chunk is available from the MediaRecorder, send it to the server
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        event.data.arrayBuffer().then((buffer) => {
          socket.send(buffer);
          console.log('Sent video chunk, size:', buffer.byteLength);
        });
      }
    };

    // Start recording, with a new chunk every 1 second
    mediaRecorder.start(1000);

    // When receiving data (echoed back by the server), add it to the SourceBuffer
    socket.onmessage = (event) => {
      if (sourceBuffer) {
        const chunk = new Uint8Array(event.data);
        if (!sourceBuffer.updating) {
          sourceBuffer.appendBuffer(chunk);
        } else {
          // If busy, queue the chunk for later appending
          bufferQueue.push(chunk);
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

  })
  .catch((err) => {
    console.error('Error accessing media devices:', err);
  });