console.log("ReceiveFiles script loaded");

var filesToReceiveCount = 0;    /* Increment for files counting                                     */
var currentReceiveBuffer = [];  /* Buffer containing the chunks of the currently downloading file   */
                                /* Used for download link only, not for streamed file-writing.      */
var receivedSize = 0;           /* Received bytes size for the currently downloading file           */
var totalReceivedSize = 0;      /* Received bytes size for all files to download                    */
var nextFile = true;            /* True if the next file download has begun.                        */
var fileStream;                 /* Writes the streamed data to the the hard drive while downloading */

/**
 * Called by the dataChannel on reception of some file data, cut out in small chunks.
 * First, the transfer status is updated, displayed in percentages, and shared to the sender.
 * The data is pushed to the data buffer for one file, if received size smaller than file size.
 * Else, one file has been downloaded. We create a download link for it.
 * The remaining data belongs to the next file to download, we set it up.
 * If the files count is complete, we reset the environment.
 * Files > 100MB are streamed, but not kept for preview.
 * @param {ArrayBuffer} loadOfChunks - a small chunk of data bytes.
 */
function receiveChunks(loadOfChunks) {
    /* Streaming setup */
    var file = filesToReceive[filesToReceiveCount];
    var length = loadOfChunks.byteLength;
    totalReceivedSize += length;
    var newStatus = (totalReceivedSize/totalSizeToReceive*100).toFixed(3);
    if (updateTransferStatus(true, newStatus+"% downloaded", false)) {
        socket.emit("transferStatus", newStatus, currentSenderID);
    }
    if (nextFile && ! window.WritableStream) {
        streamSaver.WritableStream = WritableStream;
        window.WritableStream = WritableStream;
    }
    if (nextFile) {
        fileStream = streamSaver.createWriteStream(file.name);
        window.writer = fileStream.getWriter();
    }

    if (receivedSize + length < file.size) {    /* download of a file still in progress     */
        var chunkReader = new Response(loadOfChunks).body.getReader();
        chunkReader.read().then(result => writer.write(result.value))
            .catch ((error) => {console.log(error); return;});
        if ( ! ( file.size > 100 * Math.pow(10,6)) )
            currentReceiveBuffer.push(loadOfChunks);
        receivedSize += length;
        nextFile = false;
    } else {     /* download of a file (last steps) + download of next file (first steps)   */
        console.log("The file n° ",filesToReceiveCount," has just been downloaded.");
        var remainingSize = file.size - receivedSize;
        var remainingChunks = loadOfChunks.slice(0,remainingSize);
        var nextFileChunks = loadOfChunks.slice(remainingSize, loadOfChunks.byteLength);
        var remainingReader = new Response(remainingChunks).body.getReader();
        remainingReader.read().then(function (result) {
            window.writer.write(result.value)
            window.writer.close();
        }).catch ((error) => {console.log(error); return;});
        if ( ! (file.size > 100 * Math.pow(10,6))) {
            currentReceiveBuffer.push(remainingChunks);
            createLink(file, filesToReceiveCount, false);
        } else {
            createLink(file, filesToReceiveCount, true);
        }
        filesToReceiveCount++;
        nextFile = true;      
        currentReceiveBuffer = [];
        if ( file.size < 100 * Math.pow(10,6))
            currentReceiveBuffer.push(nextFileChunks);
        receivedSize = nextFileChunks.byteLength;
        if (filesToReceiveCount == filesToReceive.length) {
            console.log("All files have been downloaded");
            if (updateTransferStatus(true, newStatus+"% downloaded<br/>Try our desktop app!<br/>↓", true))
                socket.emit("transferStatus", newStatus, currentSenderID);
            resetFilesReceiving();
            receiverDataChannel.close();
        }
    }
}

/* Resets the data reception environment. */
function resetFilesReceiving() {
    filesToReceiveCount = 0;
    currentReceiveBuffer = [];
    receivedSize = 0;
    totalReceivedSize = 0;
}