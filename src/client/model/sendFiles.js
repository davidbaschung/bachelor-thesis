console.log("SendFiles script loaded");
//TODO
const BYTESPERCHUNK = 16000;        /* Bytes size for loading and queuing in buffer */
const MAXBUFFEREDAMOUNT = 16000000; /* Buffer max size, for Chrome                  */
var filesToSendCount = 0;           /* Increment for files counting                 */
var currentFile = null;             /* Currently sended file, for eventual recovery */
var recoveredBuffer = [];           /* Recovery list for data in datachannel buffer */
var securedSize = 0;                /* The data size successfully transmitted       */

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
        // console.log("New load. offset : ",offset);
        var result = event.target.result;
        // await asyncSleep(50); // TODO keep?
        while (senderDataChannel == null) {
            // console.log("channel still null");
            await asyncSleep(50);
        }
        while (senderDataChannel.readyState != 'open') {
            // console.log("channel still not open");
            await asyncSleep(50);
        }
        while (senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT && readyForSending)
            await asyncSleep(10);
        // if ( ! readyForSending /*&& recoveredBuffer.length==0 && offset!=0*/) { /* When the loading stream is interrupted by connection loss (through kill-switch) */
            
            while ( ! readyForSending)// || senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT)
                await asyncSleep(100);
        // }
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
    console.log("Restoring Data Channel");
    while ( senderDataChannel.readyState != 'open') await asyncSleep(100);
    recoveredBuffer.forEach( (e) => {
        // console.log(e);
        senderDataChannel.send(e);
    });
    const RECOVERYAMOUNT = offset - securedSize;
            console.log("Buffer Recovery activated. securedSize:",securedSize);
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
            // console.log("T0:",offset-senderDataChannel.bufferedAmount,", securedSize:",securedSize);
            var recoveryOffset = securedSize;
            recoveryReader.onload = (recoveryEvent) => {
                recoveryResult = recoveryEvent.target.result;
                // console.log("another recovery loading. offset:",offset," bufferedAmount:",senderDataChannel.bufferedAmount," OFFSET_T0:",OFFSET_T0," bytelength:",recoveryResult.byteLength);
                recoveredBuffer.push(recoveryResult);
                recoveryOffset += recoveryResult.byteLength;
                // if (recoveredAmount<100000)
                var recoveredAmount = recoveryOffset-securedSize;
                if (recoveredAmount < RECOVERYAMOUNT) { // TODO bon nombre push?
                    // console.log("recoveredAmount:",recoveredAmount," on ",RECOVERYAMOUNT,". Loading next slice");
                    recoverNextSlice();
                }
            }; 
            function recoverNextSlice() {
                var recoverySlice = currentFile.slice(recoveryOffset, recoveryOffset + BYTESPERCHUNK);
                recoveryReader.readAsArrayBuffer(recoverySlice);
            }
            recoverNextSlice();
            // for (var i=0; i<SLICESCOUNT; i++) {
            //     var chunkLocation = OFFSET_T0 + i * BYTESPERCHUNK;
            //     var recSlice = file.slice(chunkLocation, chunkLocation+BYTESPERCHUNK);
            //     recoveryReader.readAsArrayBuffer(recSlice);
            // }
            // reader = new FileReader();
            console.log("Just recovered Buffer : ",recoveredBuffer," length:",recoveredBuffer.length);
            // while (senderDataChannel == null) await asyncSleep(50);
    recoveredBuffer = [];
    // while (senderDataChannel.bufferedAmount + result.byteLength > MAXBUFFEREDAMOUNT && readyForSending)
    await asyncSleep(100);
    readyForSending = true;
}