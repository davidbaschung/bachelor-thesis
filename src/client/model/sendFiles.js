console.log("SendFiles script loaded");
const BYTESPERCHUNK = 16000;        /* Bytes size for loading and queuing in buffer     */
const MAXBUFFEREDAMOUNT = 16000000; /* Buffer max size, for Chrome                      */
var filesToSendCount = 0;           /* Increment for files counting                     */
var securedSize = 0;                /* The data size successfully transmitted           */

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
async function sendFileAsync(file) {
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
        while (senderDataChannel == null)
            await asyncSleep(50);
        while (senderDataChannel.readyState != 'open')
            await asyncSleep(50);
        while (senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT && readyForSending)
            await asyncSleep(1);
        if ( ! readyForSending) {   /* When the loading stream is interrupted by connection loss (through kill-switch) */
            while ( ! readyForSending)
                await asyncSleep(100);
            var fileLookupIncrementingSize = 0;
            filesToSendCount = 0;
            while (fileLookupIncrementingSize + filesToSend[filesToSendCount].size <= securedSize) {
                fileLookupIncrementingSize += filesToSend[filesToSendCount].size;
                filesToSendCount++;
            }            
            offset = securedSize - fileLookupIncrementingSize;
            readNextSlice();
            return;
        }
        senderDataChannel.send(result);
        offset += result.byteLength;
        if (offset < filesToSend[filesToSendCount].size) {
            readNextSlice();
        } else {
            sendFilesAsyncCallback(filesToSend[filesToSendCount]);
        }
    };
    reader.onerror = (error) => {
        console.log("File Reader ERROR : ", error)
        setFeedback(false, "Reading error : the file doesn't exist on the hard drive", colors.RED);
    };
    reader.onabort = () => {console.log("File Reader aborted")};

    /* Internal loading of a file data chunk from the hard drive. */
    function readNextSlice() {
        var slice = filesToSend[filesToSendCount].slice(offset, offset + BYTESPERCHUNK);
        reader.readAsArrayBuffer(slice);
    }
    readNextSlice(); /* loading initialization */
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

/* Restores the lost DataChannel */
async function restoreDataChannel() {
    readyForSending = true;
}