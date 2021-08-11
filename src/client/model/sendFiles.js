console.log("SendFiles script loaded");
//TODO
const BYTESPERCHUNK = 16000;        /* Bytes size for loading and queuing in buffer */
const MAXBUFFEREDAMOUNT = 16000000; /* Buffer max size, for Chrome                  */
var filesToSendCount = 0;           /* Increment for files counting                 */
var recoveredBuffer = [];                /* Recovery list for data in datachannel buffer */

/**
 * Begins sending of all files.
 * It's the only function that must be called outside the script.
 */
function sendFilesAsync() {
    var file = filesToSend[filesToSendCount];
    sendFileAsync(file);
}

/**
 * Sends one file completely.
 * Loads the file in small chunks, and buffers them in the DataChannel for sending.
 * @param {File} file - The file to send
 */
function sendFileAsync(file) {
    if (senderDataChannel == null || file == undefined) return;
    console.log("Sending of file "+file.name+" begins");
    var offset = 0;
    var reader = new FileReader();
    /**
     * Asynchronous callback, fired when a data chunk has just been loaded by
     * the reader with readAsArrayBuffer(...)
     * @param {ProgressEvent} event - Contains the loaded targeted data
     */
    reader.onload = async function(event) {
        var result = event.target.result;
        if ( ! readyForSending) { /* When the loading stream is interrupted by connection loss (through kill-switch) */
            console.log("Buffer Recovery activated");
            recoveredBuffer = [];
            const OFFSET_T0 = offset - senderDataChannel.bufferedAmount;
            const SLICESCOUNT = senderDataChannel.bufferedAmount/BYTESPERCHUNK;
            for (var i=0; i<SLICESCOUNT; i++) {
                chunkLocation = OFFSET_T0 + i * BYTESPERCHUNK;
                var recoveryReader = new FileReader();
                recoveryReader.onload = (rec) => recoveredBuffer.push(rec);
                var slice = file.slice(chunkLocation, chunkLocation+BYTESPERCHUNK);
                recoveryReader.readAsArrayBuffer(slice);
            }
            while ( ! readyForSending )
                await asyncSleep(50);
        }
        if (senderDataChannel == null) return;
        while (senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT)
                await asyncSleep(50);
        senderDataChannel.send(result);
        offset += result.byteLength;
        if (offset < file.size) {
            readNextSlice(offset);
        } else {
            sendFilesAsyncCallback(file);
        }
    };
    reader.onerror = (error) => {
        console.log("File Reader ERROR : ", error)
        setFeedback(false, "Reading error : the file doesn't exist on the hard drive", colors.RED);
    };
    reader.onabort = () => {console.log("File Reader aborted")};

    /* Internal loading of a file data chunk from the hard drive. */
    function readNextSlice() {
        var slice = file.slice(offset, offset + BYTESPERCHUNK);
        reader.readAsArrayBuffer(slice);
    }

    readNextSlice(0); /* loading initialization */
    console.log("Sending of file "+file.name+" finished");
}

/**
 * Callback after that one file was sent.
 * Sends the next file or closes sending if all files were sent.
 * @param {File} file - The file whose sending just finished
 */
function sendFilesAsyncCallback(file) {
    console.log("Sending of file "+file.name+" finished");
    filesToSendCount++;
    if (filesToSendCount<filesToSend.length)
        sendFilesAsync();
    else {
        resetFilesSending();
    }
}

/* Called when sending of all files has finished */
function resetFilesSending() {
    console.log("All files have been sent");
    filesToSendCount = 0;
}

/* Restores the recovered data from the DataChannel buffer */
function restoreDataChannel() {
    console.log("Restoring Data Channel. Recovered Buffer : ", recoveredBuffer);
    for (var e in recoveredBuffer)
        senderDataChannel.send(e);
    readyForSending = true;
}