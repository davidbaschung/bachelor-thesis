console.log("Utils script loaded");

/**
 * @param {String} element - An HTML element in the page
 * @returns The identified element
 */
function $(element) {
    return document.getElementById(element);
}

/**
 * Returns an HTML element relatively to another one
 * @param {String} xpath - Xpath expression targeting the path to a second element
 * @param {HTMLElement} context - The base element used to target the second one.
 * @returns The single second HTML element
 */
function xpath(xpath, context) {
    return document.evaluate(xpath, context, null, XPathResult.singleNodeValue, null).iterateNext();
}

/**
 * Copy the given string to the user's OS clipboard
 * @param {Strin} str - string to copy
 */
function copyToClipboard(str) {
    var l = document.createElement("textarea");
    l.innerHTML = str;
    document.body.appendChild(l);
    l.focus();
    l.select();
    document.execCommand("copy");
    document.body.removeChild(l);
}

/**
 * Asynchronous way to pause the execution
 * @param {number} timeMillis - waiting time in milliseconds
 * @returns A promise that the caller must "await"
 */
async function asyncSleep(timeMillis) {
    return new Promise((resolve => setTimeout(resolve,timeMillis)));
}

/**
 * Converts a certificate fingerprint to a code / passphrase of 4 words.
 * This requests the dictionary, then applies modulos to the fingerprint as many times
 * as there should be words to construct the code.
 * @param {String} hash - the hexadecimal fingerprint hash
 * @returns 
 */
function hashToPassphrase(hash) {
    console.log("hash : ", hash);
    var lines, request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            lines = this.responseText.split('\n');
            // console.log("lines extract : ",lines[0]+","+lines[1]+","+lines[2]);
        }
    };
    request.open("GET", "corncob_lowercase.txt", false);
    request.send();
    var code = "";
    var numberOfWords = 4;
    var hashNumber = parseInt( "0x" + hash.toUpperCase().replace(/[^a-zA-Z0-9]+/g, "") );
    var base = lines.length;
    var left =  hashNumber;
    for (var i=0; i<numberOfWords; i++) {
        var word = lines[left % base];
        if (word[word.length-1]=='\r' || word[word.length-1]=='\0')
            word = word.slice(0,word.length-1);       
        code += word + (i<numberOfWords-1?'-':'') ;
        left = Math.floor(left / base);
    }
    console.log("code : "+code);
    return code;
}