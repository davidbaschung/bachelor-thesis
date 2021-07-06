console.log("Receiver script loaded");

var receiverConnection;	/* Receiver RTCPeerConnection 			*/
var receiverCertificate;/* Receiver Authentication Certificate	*/
var currentSenderID;	/* Sender Socket ID  					*/
var receiverDataChannel;/* Receiver P2P DataChannel 			*/

/**
 * Sends the inputed receiver-code to the server to get files metadata.
 * @param {String} inputedCode 
 */
function requireFilesMetada(inputedCode) {
	socket.emit("joinRoom", inputedCode);
	console.log("Receiver code inputed was sent");
}
/**
 * Sends a download initialization request to the sender. (through server)
 * Provides the previously inputed receiver-code again.
 * @param {String} inputedCode - receiver code inputed
 */
function download(inputedCode) {
	console.log("Request download initialization");
	socket.emit("initDownload", inputedCode);
}

/* The server refused the inputed code, a red notice is displayed on the page */
socket.on("codeRefused", function() {
	console.log("Socket : Code refused, download rejected");
	setFeedback(true, "Code refused", colors.RED)
});
/** 
 * The server accepted the inputed code. The files and their size are listed in green on the page.
 * Creates a certificate and displays the sender code.
 * Changes the [OK] button to a [download] button
 */
socket.on("codeAccepted", function(transferMetaData) {
	RTCPeerConnection.generateCertificate(encryptionAlgorithm).then(function(certificate) {
		receiverCertificate = certificate;
		var senderCode = hashToPassphrase(certificate.getFingerprints()[0].value);
		setCodeLabel(senderCode, false);
	});
	console.log("Socket : Code accepted, download possible");
	var sizeMsg, s;
	s = totalSizeToReceive = transferMetaData.size;
	switch (true) {
		case (s<1000) : sizeMsg = s + " bytes"; break;
		case (s<Math.pow(10,6)) : sizeMsg = Number((s/Math.pow(10,3)).toFixed(2))+" Kb"; break;
		case (s<Math.pow(10,9)) : sizeMsg = Number((s/Math.pow(10,6)).toFixed(2))+" Mb"; break;
		case (s<Math.pow(10,12)) : sizeMsg = Number((s/Math.pow(10,9)).toFixed(2))+" Gb"; break;
		default : "1 Tb or more";
	}
	var message = "Code accepted, files to download ("+sizeMsg+") :<ul>";
	filesToReceive = [];
	for (f of transferMetaData.files) {
		message+="<li>"+f.name+"</li>";
		filesToReceive.push(f);
	}
	message += "</ul></div>";
	setFeedback(true, message, colors.GREEN);
	setReceiverCodeButtonAction(actions.DOWNLOAD);
});

/* Called if the sender user intentionally cancelled the download (Reset). A yellow notice is displayed on the page. */
socket.on('abortDownload', function() {
	console.log("Socket : Download cancelled by the sender");
	setFeedback(true, "The download was aborted by the sender", colors.YELLOW)
	setCodeLabel("",false);
	if (window.writer != null)
		window.writer.close();
});

/** 
 * Delivers an SDP offer from the sender.
 * Controls the Certificate : derives the code from the fingerprint provided
 * in the SDP offer and compares it to the inputed receiver code.
 * Creates immediately a peer connection and pass it the SDP offer with the certificate.
 * Sends an SDP answer back.
 */
socket.on("offerSDP", function (offerSDP, senderID) {
	console.log("Socket : Received SDP offer");
	var inputedReceiverCode = getInput(true);
	// inputedReceiverCode = "fakeWrongCodeForCerticateTesting";
	if (hashToPassphrase(getSDPFingerprint(offerSDP)) != inputedReceiverCode) {
		setFeedback(true, "The sender's authentication certificate is not valid.",colors.RED);
		return;
	}
	console.log("The fingerprint authentication succeeded");
	currentSenderID = senderID;
	receiverConnection = new RTCPeerConnection({
		iceServers: iceServers,
		certificates: [receiverCertificate]
		});
	receiverConnection.onicecandidate = onIceCandidateRTC_B;
	receiverConnection.oniceconnectionstatechange = iceConnectionStateChange_B;//= (event) => console.log("RTC : ICE state : ",event.target.connectionState);
	receiverConnection.ondatachannel = receiveDataChannelRTC;
	receiverConnection.setRemoteDescription(offerSDP);
	receiverConnection.createAnswer(
		function (answerSDP) {
			receiverConnection.setLocalDescription(answerSDP);
			socket.emit("answerSDP", answerSDP, currentSenderID);
		},
		function (error) {
			console.log(error);
		}
	);
});

/** Delivered from the sender if the authentication failed.
 * Might happen if the sender wrongly entered the sender code.
 * A red notice is displayed on the page.
 */
socket.on("receiverAuthenticationFailed", function() {
	console.log("Socket : receiver authentication failed");
	var failed = create("div","Your authentication failed. Did you communicate your code to the sender?");
	failed.setAttribute("id", "receiverAuthenticationFailed");
	failed.setAttribute("class", "red smallHighlight");
	getFeedback(true).appendChild(failed);
})

/** Delivers an ICE candidate from the receiver to the local connection. */
socket.on("IceCandidateA", function (IceCandidateA) {
	console.log("Socket : received ICE Candidate A");
	if (receiverConnection == null) return;
	receiverConnection.addIceCandidate(IceCandidateA)
	.then(
		function() {
			console.log("RTC : addIceCandidateA Success");
		},
		function(error) {
			console.log("RTC : addIceCandidateA FAILED : ", error);
		}
	);
});

/**
 * Called by the local RTCPeerConnection on candidate creation.
 * This sends the created ICE candidate to the sender.
 * @param {RTCPeerConnectionIceEvent} event - Networking ICE event, contains an RTCIceCandidate
 */
function onIceCandidateRTC_B(event) {
	console.log("RTC : IceCandidateB created, it will be sent");
	if (receiverConnection == null) return;
	if (event.candidate) {
		socket.emit("IceCandidateB", event.candidate, currentSenderID);
	}
}

/**
 * Setups the DataChannel offered by the sender. Exclusive to the receiver.
 * Attributes appropriate functions to react to DataChannel events.
 * @param {RTCDataChannelEvent} event 
 */
function receiveDataChannelRTC(event) {
	console.log("RTC : receiverDataChannel received");
	receiverDataChannel = event.channel;
	receiverDataChannel.binaryType = "arraybuffer";
	receiverDataChannel.onmessage = receiveMessageDC;
	receiverDataChannel.onopen = openReceivingDC;
	receiverDataChannel.onclose = closeReceivingDC;
	receiverDataChannel.onerror = (error) => {console.log("RTC : receiverDataChannel ERROR : ", error)};
}

/* Notifys the download opening. Called by a DataChannel event. */
function openReceivingDC() {
	console.log("DataChannel : open Receiving");
}

/* Receive a message containing chunks of files data. Called by a DataChannel event. */
function receiveMessageDC(message) {
	receiveChunks(message.data);
}

/* Closes the DataChannel and the connection. Called by the DataChannel on closing. */
function closeReceivingDC() {
	console.log("DataChannel : close receiving and reinitialize connection");
	receiverDataChannel.close();
	receiverConnection.close();
	receiverConnection = null;
	currentSenderID = null;
	receiverDataChannel = null;
}

/**
 * Re-establishes the socket connection based on the room existence.
 * Waits for the sender to reconnect first, and then rejoins and restart the download.
 * @param {Event} event - peer-to-peer connection state
 */
function iceConnectionStateChange_B(event) {
	const MAXCOUNT = 600;
	function checkConnectivity(count) {
		if (receiverConnection==null || receiverConnection==undefined) 
			return;
		console.log("RTC : ICE state : ",event.target.connectionState);
		var state = receiverConnection.iceConnectionState;
		if ( ! ( state == "connected" ) ) {
			if (count < MAXCOUNT) {
				asyncSleep(1000).then(() => {
					if (count>=10 && count%5==0) {
						socket = io.connect(url);
						socket.emit("restoreConnection", getInput(true), false);
						console.log("Socket : new socket created");
					}
					checkConnectivity(++count);
				});
			} else {
				closeReceivingDC();
				setFeedback(true,"The connection failed, download cancelled.",colors.RED);
			}
		}
	}
	checkConnectivity(0);
}

/* When the host reconnected, we reset the P2P connection. */
socket.on("socketsReconnected", function(senderID) {
	currentSenderID = senderID;
	console.log("Sockets : updated sender socket : ",senderID,"\n relaunching download");
	socket.emit("initDownload", inputedCode);
});