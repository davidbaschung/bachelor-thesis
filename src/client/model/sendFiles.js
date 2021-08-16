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
        // console.log("New load. offset : ",offset);
        var result = event.target.result;
        // await asyncSleep(50); // TODO keep?
        while (senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT && readyForSending)
            await asyncSleep(10);
        if ( ! readyForSending /*&& recoveredBuffer.length==0 && offset!=0*/) { /* When the loading stream is interrupted by connection loss (through kill-switch) */
            const OFFSET_T0 = offset - senderDataChannel.bufferedAmount;
            console.log("Buffer Recovery activated.  offset:",offset," bufferedAmount:",senderDataChannel.bufferedAmount," OFFSET_T0:",OFFSET_T0);
            const RECOVERYAMOUNT = senderDataChannel.bufferedAmount;
            // function waitClosed(timeMillis) {
            //     if (reader.readyState == reader.LOADING) {
            //         asyncSleep(timeMillis).then( () => {
            //             waitClosed(timeMillis);
            //         });
            //     }
            // }
            // waitClosed(50);
            // reader = null;
            var recoveryReader = new FileReader();
            var recoveryOffset = OFFSET_T0; //TODO simplifier
            recoveryReader.onload = (recoveryEvent) => {
                recoveryResult = recoveryEvent.target.result;
                // console.log("another recovery loading. offset:",offset," bufferedAmount:",senderDataChannel.bufferedAmount," OFFSET_T0:",OFFSET_T0," bytelength:",recoveryResult.byteLength);
                recoveredBuffer.push(recoveryResult);
                if (recoveryOffset-OFFSET_T0 < RECOVERYAMOUNT) {
                    recoveryOffset += recoveryResult.byteLength;
                    recoverNextSlice();
                }
            };
            function recoverNextSlice() {
                var recoverySlice = file.slice(recoveryOffset, recoveryOffset + BYTESPERCHUNK);
                recoveryReader.readAsArrayBuffer(recoverySlice);
            }
            recoverNextSlice();
            // for (var i=0; i<SLICESCOUNT; i++) {
            //     var chunkLocation = OFFSET_T0 + i * BYTESPERCHUNK;
            //     var recSlice = file.slice(chunkLocation, chunkLocation+BYTESPERCHUNK);
            //     recoveryReader.readAsArrayBuffer(recSlice);
            // }
            // reader = new FileReader();
            console.log("Just recovered Buffer : ",recoveredBuffer);
            while ( ! readyForSending ) await asyncSleep(100);
        }
        while (senderDataChannel == null) {
            console.log("channel still null");
            await asyncSleep(50);
        }
        while (senderDataChannel.readyState != 'open') {
            console.log("channel still not open");
            await asyncSleep(50);
        }
        senderDataChannel.send(result);
        offset += result.byteLength;
        if (offset < file.size) {
            readNextSlice();
        } else {
            console.log("Offset : ", offset, " , File size : ", file.size);
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
    readNextSlice(); /* loading initialization */
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
async function restoreDataChannel() {
    console.log("Restoring Data Channel. Recovered Buffer : ", recoveredBuffer);
    while ( senderDataChannel.readyState != 'open') await asyncSleep(100);
    for (var e in recoveredBuffer)
        senderDataChannel.send(e);
    recoveredBuffer = [];
    readyForSending = true;
}