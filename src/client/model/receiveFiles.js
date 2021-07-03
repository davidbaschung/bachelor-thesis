console.log("ReceiveFiles script loaded");

var filesToReceiveCount = 0;    /* Increment for files counting                                     */
var currentReceiveBuffer = [];  /* Buffer containing the chunks of the currently downloading file   */
var receivedSize = 0;           /* Received bytes size for the currently downloading file           */
var totalReceivedSize = 0;      /* Received bytes size for all files to download                    */

/**
 * Called by the dataChannel on reception of some file data, cut out in small chunks.
 * First, the transfer status is updated, displayed in percentages, and shared to the sender.
 * The data is pushed to the data buffer for one file, if smaller than the file size.
 * Else, one file has been downloaded. We create a download link for it.
 * The remaining data belongs to the next file to download, we set it up.
 * If the files count is complete, we reset the environment.
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
    if (receivedSize + length < file.size) {
        currentReceiveBuffer.push(chunk);
        receivedSize += length;
    } else {
        var remainingSize = file.size - receivedSize;
        var remainingChunk = chunk.slice(0,remainingSize);
        var nextFileChunk = chunk.slice(remainingSize, chunk.byteLength);
        currentReceiveBuffer.push(remainingChunk);
        createLink(file, filesToReceiveCount);
        filesToReceiveCount++;
        currentReceiveBuffer = [];
        currentReceiveBuffer.push(nextFileChunk);
        receivedSize = nextFileChunk.byteLength;
        if (filesToReceiveCount == filesToReceive.length) {
            console.log("all files have been downloaded");
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