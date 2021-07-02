console.log("server script loaded");
const expressModule = require("express");
const socketModule = require("socket.io");
const utilsModule = require("./utils.js");
const app = expressModule();
app.use(expressModule.static("src/client"));
app.get("/", function (request, response) {
    response.redirect("https://"+url.substring(7,url.length));
})
// const httpsModule = require("https");
// const credentials = utilsModule.getCredentials("."); /* for local https server */

/**
 * Model for each room where the sender and the receiver can meet.
 * It contains the socket ID of the room host (sender) and its files metadata.
 * A room is mapped in transferMetaDataMap, a dictionary whose keys are receiver codes.
 */
class TransferMetaData {
    constructor(roomHostSocket, files) {
        this.roomHostSocket = roomHostSocket;
        this.files = files;
        this.size = 0;
        for (var f of files) {
            this.size += f.size;
        }
    }
}

var port = process.env.PORT;                /* HEROKU.com listening port                            */
if (port == null || port == "") {           /* Local port otherwise                                 */
    port = 4001;
}
var server = app.listen(port, function () { /* The server listens to the port                       */
    console.log("Server started");
});
var io = socketModule(server);              /* Incoming connections are managed by the socket server*/
var transferMetaDataMap = new Map();        /* The rooms map each receiver code to files metadata   */

/** 
 * Triggered when a clients connects itself to the server.
 * The socket.on reactions are defined and can successively handle tagged messages.
 */
io.on("connection", function (socket) {
    console.log("User Connected. Socket ID : " + socket.id);

    /* Creates a room on sender's request. Receivers can later join the room to obtain files metadata.*/
    socket.on('requestNewRoom', function(files, receiverCode) {
        console.log("new room created with code ",receiverCode," for socket "+socket.id);
        transferMetaDataMap.set(receiverCode, new TransferMetaData(socket, files));
        socket.emit('newRoomCreated');
    });

    /* Deletes the sender's room. A cancelling message is sent to the receiver.*/
    socket.on("abortUpload", function(receiverCode, receiverID) {
        console.log("Aborting upload");
        var transferMetaData = transferMetaDataMap.get(receiverCode);
        if (transferMetaData == undefined) return;
        socket.emit("uploadAborted");
        if (receiverID != undefined)
            socket.to(receiverID).emit("abortDownload");
        transferMetaDataMap.delete(receiverCode);
    });

    /**
     * The receiver joins a room by providing its receiver code.
     * The appropriate room is retrieved from the dictionary with the code.
     * If the code is right, the files metadats are sent back. Otherwise, a refusal message.
     */
    socket.on('joinRoom', function(inputedCode) {
        var transferMetaData = transferMetaDataMap.get(inputedCode);
        var accepted = false;
        if (transferMetaData != undefined) accepted = true;
        console.log((accepted?"Correct":"Wrong")+" code ("+inputedCode+") received by socket "+socket.id+", request "+(accepted?"accepted":"refused")+".");
        if ( ! accepted) {
            socket.emit("codeRefused");
            return;
        }
        transferMetaDataMsg = {
            files : transferMetaData.files,
            size : transferMetaData.size
        }
        var host = transferMetaData.roomHostSocket
        socket.emit("codeAccepted", transferMetaDataMsg);
        var receiverID = socket.id;
        host.emit("receiverJoined", receiverID);
    })

    /* A download initialization request is relayed from the receiver to the sender. The code is controlled again. */
    socket.on("initDownload", function(inputedCode) {
        console.log("download initialization request from socket "+socket.id);
        var transferMetaData = transferMetaDataMap.get(inputedCode)
        if (transferMetaData == undefined) return;
        var receiverID = socket.id;
        socket.to(transferMetaData.roomHostSocket.id).emit("initDownload",receiverID);
    });

    /* An SDP offer is relayed from the sender to the receiver */
    socket.on("offerSDP", function (offerSDP, receiverID) {
        var senderID = socket.id;
        socket.to(receiverID).emit("offerSDP", offerSDP, senderID);
        console.log("Offer SDP : \nsender id : ",socket.id," receiver id : ",receiverID);
    });

    /* An SDP answer is relayed from the receiver to the sender */
    socket.on("answerSDP", function (answerSDP, senderID) {
        var receiverID = socket.id;
        socket.to(senderID).emit("answerSDP", answerSDP, receiverID);
        console.log("Answer SDP : receiver id : ",socket.id," sender id : ",senderID);
    });

    /**
     * An authentication failure message is relayed from the sender to the receiver.
     * This will allow the receiver to make sure it gave its code to the sender.
     */
    socket.on("receiverAuthenticationFailed", function(receiverID) {
        socket.to(receiverID).emit("receiverAuthenticationFailed");
    })

    /* An ICE Candidate is relayed from the sender to the receiver */
    socket.on("IceCandidateA", function (IceCandidateA, receiverID) {
        socket.to(receiverID).emit("IceCandidateA", IceCandidateA);
        console.log("Ice candidate A :\nsocket id : ",socket.id," receiver id : ",receiverID);
    });

    /* An ICE Candidate is relayed from the receiver to the sender */
    socket.on("IceCandidateB", function (IceCandidateB, senderID) {
        socket.to(senderID).emit("IceCandidateB", IceCandidateB);
        console.log("Ice candidate B :\nsocket id : ",socket.id," sender id : ",senderID);
    });

    /* The receivers download status is relayed to the sender */
    socket.on("transferStatus", function (newStatus, senderID) {
        socket.to(senderID).emit("transferStatus", newStatus);
    })

    socket.on("restoreConnection", function (isHost) {
        console.log("Restoring connection. Socket ID : ",socket.ID," , isHost : ",isHost);
        var transferMetaData = transferMetaDataMap.get(inputedCode);
        if (transferMetaData == undefined) return;
        if (isHost) transferMetaData.roomHostSocket = socket.id;
        else {
            checkIfHostReconnected(0);
        }
    });

    function checkIfHostReconnected(count) {
        if (transferMetaData.roomHostSocket.connected == true) {
            socket.to(transferMetaData.roomHostSocket).emit("restartSignaling", socket.id);
        } else {
            if (count<20)
                asyncSleep(1000).then(() => {
                    checkIfHostReconnected(++count);
                });
        }
    }
});
