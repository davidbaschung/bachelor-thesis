/* This file can be used to create an https server as a localhost during development */

var fs = require("fs");
var forge = require("node-forge"); /* Certificate generation done with the node-forge library */
forge.options.usePureJavaScript = true;
exports.getCredentials = getCredentials;

/**
 * Reads the local X.509 stored certificate. Creates them if non-existent.
 * @param {String} folderPath - path of the stored key and certificate
 * @returns the key and certificates that can be used in an https server
 */
function getCredentials(folderPath) {
    var credentials = null;
    try {
        credentials = {
            key: fs.readFileSync(folderPath+"/key.pem"),
            cert: fs.readFileSync(folderPath+"/cert.pem")
        }
        if (forge.pki.certificateFromPem(credentials.cert).validity.notAfter < new Date()) {
            console.log("The credentials are outdated");
            credentials = createCredentials(folderPath);
        } else {
            console.log("The credentials have been returned");
        }
    } catch (error) {
        console.log("The X.509 key and certificates were not found in the folder '"+folderPath+"'");
        credentials = createCredentials(folderPath);
    } finally {
        console.log("Credentials returned");
        return credentials;
    }
}

/**
 * Creates a local X.509 certificate.
 * @param {String} folderPath - path for the key and certificate to create
 * @returns 
 */
function createCredentials(folderPath) {
    var certificate = forge.pki.createCertificate();
    var keyPair = forge.pki.rsa.generateKeyPair();
    certificate.publicKey = keyPair.publicKey;
    certificate.privateKey = keyPair.privateKey;
    certificate.serialNumber = "1";
    var currentTime = new Date();
    var expirationTime = new Date(currentTime.getTime());
    expirationTime.setFullYear(currentTime.getFullYear() +1);
    certificate.validity.notBefore = currentTime;
    certificate.validity.notAfter = expirationTime;
    certificate.setSubject( [{name : "commonName", value : "David Baschung"}] );
    certificate.setIssuer( [{name : "commonName", value : "David Baschung"}] );
    certificate.sign(keyPair.privateKey);
    var credentials = {
        key : forge.pki.privateKeyToPem(keyPair.privateKey),
        cert: forge.pki.certificateToPem(certificate)
    }
    fs.writeFileSync(folderPath+"/key.pem", credentials.key);
    fs.writeFileSync(folderPath+"/cert.pem", credentials.cert);
    console.log("New Credentials created");
    return credentials;
}