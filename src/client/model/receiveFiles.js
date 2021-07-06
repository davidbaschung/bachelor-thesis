console.log("ReceiveFiles script loaded");

var filesToReceiveCount = 0;    /* Increment for files counting                                     */
var currentReceiveBuffer = [];  /* Buffer containing the chunks of the currently downloading file   */
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
 * @param {ArrayBuffer} chunk - a small chunk of data bytes.
 */
function receiveChunks(chunk) {
    var file = filesToReceive[filesToReceiveCount];
    var length = chunk.byteLength;
    totalReceivedSize += length;
    var newStatus = (totalReceivedSize/totalSizeToReceive*100).toFixed(1);
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

    if (receivedSize + length < file.size) {
        var chunkReader = new Response(chunk).body.getReader();
        chunkReader.read().then(result => writer.write(result.value))
            .catch ((error) => {console.log(error); return;});
        if ( ! ( file.size > 100 * Math.pow(10,6)) )
            currentReceiveBuffer.push(chunk);
        receivedSize += length;
        nextFile = false;
    } else {
        console.log("file size : ",file.size,", blob size : ",new Blob(currentReceiveBuffer).size);
        var remainingSize = file.size - receivedSize;
        var remainingChunk = chunk.slice(0,remainingSize);
        var nextFileChunk = chunk.slice(remainingSize, chunk.byteLength);
        var remainingReader = new Response(remainingChunk).body.getReader();
        remainingReader.read().then(function (result) {
            window.writer.write(result.value)
            window.writer.close();
        }).catch ((error) => {console.log(error); return;});
        if ( ! (file.size > 100 * Math.pow(10,6))) {
            currentReceiveBuffer.push(remainingChunk);
            createLink(file, filesToReceiveCount, false);
        } else {
            createLink(file, filesToReceiveCount, true);
        }
        filesToReceiveCount++;
        nextFile = true;      
        currentReceiveBuffer = [];
        if ( ! file.size > 100 * Math.pow(10,6))
            currentReceiveBuffer.push(nextFileChunk);
        receivedSize = nextFileChunk.byteLength;
        if (filesToReceiveCount == filesToReceive.length) {
            console.log("All files have been downloaded");
            if (updateTransferStatus(true, newStatus+"% downloaded", true))
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