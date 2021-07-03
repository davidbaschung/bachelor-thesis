console.log("Client script loaded");

var url = window.location.href;					/* the URL to contact the signaling server 				*/
if (/Electron/i.test(navigator.userAgent)) {	/* for the Desktop-app, the URL must be indicated 		*/
	url = "https://travail-de-bachelor.herokuapp.com";
} else if ( ! /Chrome|CriOS|Edge|Edg|EdgiOS/.test(navigator.userAgent)) {
	alert("You need to use Google Chrome or Microsoft Edge to use this application");
} else {
	if ( ! url.includes("localhost"))
		if ( ! url.slice(0,5).includes("https")) {
			url = "https://" + url.slice(7,url.length);	/* on the navigator, the URL is redirected to https		*/
			a = create('a',"");
			a.href = url;
			a.click();
		}
}

var socket = io.connect(url);

/* encryption algorithm for the certificates */
var encryptionAlgorithm = {
	name: 'RSASSA-PKCS1-v1_5',
	hash: 'SHA-256',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1])
}

/* STUN and TURN servers */
var iceServers = [
	{ urls: "stun:stun.services.mozilla.com" },
	{ urls: "stun:stun.l.google.com:19302" },
	{
		"iceTransportPolicy": "relay",
		"urls": "turn:51.15.228.16:3478",
		"username": "p2psecurefiletransfer",
		"credential": "quickerthancloudtransfer"
	}
];

/**
 * Extracts the fingerprint string from an sdp object
 * @param {sdp} sdpObject - SDP offer or answer
 * @return {string} fingerprint - hexadecimal fingerprint as string
 */
function getSDPFingerprint(sdpObject) {
	var sdpProperties = sdpObject.sdp.split("\n");
	var i=0, j=0;
	var tag = "a=fingerprint";
	while ( ! (sdpProperties[i].substring(0,tag.length)==tag) )
		i++;
	while ( ! (sdpProperties[i].substring(j,j+1)==" ") )
		j++;
	j++;
	var fingerprint = sdpProperties[i].substring(j,sdpProperties[i].length);
	return fingerprint;
}
