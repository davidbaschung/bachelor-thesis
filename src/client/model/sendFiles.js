console.log("SendFiles script loaded");

const bytesPerChunk = 16000;        /* Bytes size for loading and queuing in buffer */
const maxBufferedAmount = 16000000; /* Buffer max size, for Chrome                  */
var filesToSendCount = 0;           /* Increment for files counting                 */

/**
 * Begins sending of all files.
 * It's the only function that must be called outside the script.
 */
function sendFilesAsync() {
    var file = filesToSend[filesToSendCount];
    sendFileAsync(file);
}
/**
 * Callback after one file was sent.
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
        if (senderDataChannel == null) return;
        while (senderDataChannel.bufferedAmount + result.byteLength > maxBufferedAmount)
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
        setFeedback(false, "Reading error : the file doesn't exist on the hard drive", "red");
    };
    reader.onabort = () => {console.log("File Reader aborted")};

    /* Internal loading of a file data chunk from the hard drive. */
    function readNextSlice() {
        var slice = file.slice(offset, offset + bytesPerChunk);
        reader.readAsArrayBuffer(slice);
    }

    readNextSlice(0); /* loading initialization */
    console.log("exit SendFileAsync. Offset : ", offset);
}

/** Called when sending of all files has finished */
function resetFilesSending() {
    console.log("All files have been sent");
    filesToSendCount = 0;
}