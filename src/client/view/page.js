console.log("Page script loaded");

var filesToSend = [];       /* Files list to send, as in the sender box                     */
var filesToReceive = [];    /* Files list to receive, as in the receiver's feedback panel   */
var totalSizeToReceive;     /* Size in bytes for all files to receive                   	*/
var validated = false;      /* Validated files list state, often used too                   */
var updateStatus = true;    /* Timeout flag for download status refreshment                 */

const roles = {             /* A tag available for each peer can be choosed using roles     */
    SENDER:1,
    RECEIVER:2
}
const actions = {           /* Actions for the button next to the receiver code input       */
    RECEIVERCODE:1,
    DOWNLOAD:2,
    DOWNLOADING:3
}
const colors = {            /* Color tags in CSS stylesheet                                 */
    YELLOW:"yellow",
    GREEN:"green",
    RED:"red"
}

/**
 * Creates a new HTML element
 * @param {String} nodeString - Type of the element to create
 * @param {String} content - innerHTML content to insert
 * @returns The element of the given type
 */
function create(nodeString, content) {
    var newNode = document.createElement(nodeString);
    newNode.innerHTML = content;
    return newNode;
}

/**
 * Sets up the page for the sender or the receiver upon role assignment.
 * @param {String} role - sender or receiver
 */
function setRole(role) {
    var fileName;
    switch(role) {
        case roles.SENDER : fileName = "sender.html"; break;
        case roles.RECEIVER : fileName = "receiver.html";
    }    
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            $("mainView").innerHTML = this.responseText;
        }
    };
    request.open("GET", "view/"+fileName, false);
    request.send();
}

/* Resets the receiver environment, when the receiver input is clicked */
function clickReceiverField() {
    $("receiverCodeInput").value="";
    setReceiverCodeButtonAction(actions.RECEIVERCODE);
    setCodeLabel("", false);
    setFeedback(true,"","");
}

/**
 * Manages the receiver input in the receiver code field. (even [Enter])
 * @param {KeayboardEvent} event - An event fired on every keystroke
 */
function inputInReceiverField(event) {
    if (event.keyCode == 13) { $('receiverCodeButton').click(); }
}

/**
 * Executes the action of the receiver code button
 * (get files list [OK], init download [download], or disabled [downloading])
 * @param {Number} action - to execute, constant
 */
function receiverCodeButton(action) {
    switch (action) {
        case actions.RECEIVERCODE :
            requireFilesMetada( getInput(true) ); break;
        case actions.DOWNLOAD :
            download( getInput(true) );
            var failed = $("receiverAuthenticationFailed")
            if (failed != null) failed.remove();
    }
}
/**
 * Changes the action and labels of the receiver code button
 * @param {Number} action - to set up for ulterior execution
 */
function setReceiverCodeButtonAction(action) {
    var button = $('receiverCodeButton');
    button.enable;
    button.classList = "inputButton";
    switch (action) {
        case actions.RECEIVERCODE :
            button.innerHTML = "OK",
            button.setAttribute("onclick","receiverCodeButton(actions.RECEIVERCODE)");
            break;
        case actions.DOWNLOAD :
            button.innerHTML = "Download !",
            button.classList.add(colors.GREEN),
            button.setAttribute("onclick","receiverCodeButton(actions.DOWNLOAD)");
            break;
        case actions.DOWNLOADING :
            button.innerHTML = "Downloading",
            button.disable;
    }
}

/**
 * Gets the receiver/sender code in the code input field
 * @param {Boolean} isReceiver - 'true' targets the receiver
 * @returns the code string
 */
function getInput(isReceiver) {
    var label = isReceiver ? $("receiverCodeInput") : $("senderCodeInput");
    return label.value;
}

/**
 * Sets information notices as HTML in the feedback panel
 * @param {Boolean} isReceiver - 'true' targets the receiver
 * @param {HTMLElement} message - HTML content to set
 * @param {String} highlightColor - panel background color
 */
function setFeedback(isReceiver, message, highlightColor) {    
	var label = isReceiver? $('receiverFeedback') : $('senderFeedback');
	label.innerHTML = message;
    var divContainer = xpath("./parent::*", label);
    divContainer.classList = "";
    if ( ! highlightColor=="")
        divContainer.classList.add("smallHighlight", highlightColor);
}

/**
 * Gets the sender / receiver feedback HTML element
 * @param {Boolean} isReceiver - 'true' targets the receiver
 * @returns the whole feedback panel
 */
function getFeedback(isReceiver) {
    return isReceiver? $('receiverFeedback') : $('senderFeedback');
}

/**
 * Creates a download link for a list item and displays it in blue.
 * @param {File} file - The target file to download
 * @param {Number} index - The targeted list item index
 */
function createLink(file, index) {
    var blob = new Blob(currentReceiveBuffer);
    var expression = ".//li["+(index+1)+"]";
    var li = xpath(expression,$("receiverFeedback"));
    var downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.textContent = file.name;
    downloadLink.download = file.name;
    downloadLink.classList="highlightedLink";
    downloadLink.click();
    li.innerHTML = "";
    li.append(downloadLink);
}

/**
 * Displays a text about the download status, below the receiver feedback.
 * The status refreshing is done periodically every 0.5 second.
 * @param {Boolean} isReceiver - True to update receiver's status, false for sender.
 * @param {String} text - The text to write in the status
 * @param {Boolean} instantaneous - Update without waiting next time frame.
 * @returns - Wether the displayed status was updated or not
 */
function updateTransferStatus(isReceiver, text, instantaneous) {
    if ( ! updateStatus && ! instantaneous && isReceiver) return false;
    updateStatus = false;
    asyncSleep(500).then( function() {
        updateStatus = true;
    });
    var tag = isReceiver ? "receiverStatus" : "senderStatus";
    var status = $(tag);
    if (status == null) {
        status = document.createElement("div");
        status.setAttribute("id",tag);
        status.setAttribute("bold","");
        var containerTag = isReceiver ? "receiverFeedback" : "senderFeedback";
        if ( ! isReceiver)
            setFeedback(false,"",colors.GREEN);
        var label = $(containerTag);
        label.appendChild(status);
    }
    status.innerHTML = "Status : " + text;
    return true;
}

/**
 * Hovering during a drag-and-drop of the files on the sender box
 * @param {DragEvent} event - Mouse Dragging info
 */
function dragOverAction(event) {
    event.stopPropagation();
    event.preventDefault();
    if (validated) return;
    $('drop1').classList.add("dragOver");
}
/**
 * Leaving the box during a drag-and-drop of the files
 * @param {DragEvent} event - Mouse Dragging info
 */
function dragLeaveAction(event)  {
    event.stopPropagation();
    event.preventDefault();
    if (validated) return;
    $('drop1').classList.remove("dragOver");
}
/**
 * Releasing the mouse button after a drag-and-drop
 * @param {DragEvent} event - Mouse Dragging info
 */
function dropAction(event) {
    event.stopPropagation();
    event.preventDefault();
    if (validated) return;
    $('drop1').classList.remove("dragOver");
    addFiles(event.dataTransfer.files);
    
}

/* Click on the sender box and select files    */
function browseFiles() {
    if (validated) return;
    var fileInput = create('input', null);
    fileInput.type = 'file';
    fileInput.setAttribute('multiple', true);
    fileInput.addEventListener('change', function() {
        addFiles(fileInput.files);
    });
    fileInput.click();
}

/**
 * Add the files to the files to load list and displays them as an
 * unordered list in the sender box (by drag-and-drop or click).
 * @param {FileList} files - Metadatas list for all files to send
 */
function addFiles(files) {
    loop1 :
    for (var i=0; i<files.length; i++) {
        var file = files[i];
        for (var j=0; j<filesToSend.length; j++) {
            if (filesToSend[j].name === file.name) {
                continue loop1;
            }
        }
        filesToSend = filesToSend.concat(file);
        var filesList = xpath("./ul", $('drop1'));
        var node = create('li', file.name);
        filesList = filesList.appendChild(node);
    }
    $('validate').removeAttribute("disabled");
}

/**
 * The validate button launches the sender script for sending the files,
 * it will send them to the server.
 * Disables also the validate button and the sender box.
 */
function validateButton() {
    validated = true;
    $('drop1').classList.add("disabled");
    $('validate').setAttribute("disabled","true");
    launchClientSender();
}

/**
 * Reinitializes the list of files to send and clears the sender box.
 * Tells the server to clear the room and notify the receiver of the interruption.
 * If a download is running, cancels the download completely.
 */
function resetButton() {
    validated = false;
    filesToSend = [];
    $('filesList').innerHTML = "<ul></ul>";
    $('drop1').classList.remove("disabled");
	var label = $('receiverCode');
    abortUpload(label.innerHTML);
	setResetButtonLabel("reset");
    setCodeLabel("",true);
    $('senderCodeInput').value = "" ;
    setFeedback(false, "","");
    closeSendingDC();
}
/* Changes the label of the reset button (but the action always cancels everything) */
function setResetButtonLabel(label) {
    var button = $('reset');
    switch (label) {
        case 'reset' :
            button.innerHTML = "Reset"; break;
        case 'cancel' :
            button.innerHTML = "Cancel download"; break;
    }
}

/**
 * Displays the sender or receiver code on the page.
 * This function is used for both the receiver and the sender codes.
 * @param {String} code - Sender / receiver code to display
 * @param {String} isReceiver - Sender / receiver <div> container identifier
 */
function setCodeLabel(code, isReceiver) {
    var containerID = isReceiver ? "receiverCodeContainer" : "senderCodeContainer";
	var container = $(containerID);
	var codeLabel = xpath(".//*/label",container);
    var infoLabel = xpath("./div",container);
    if (code=="") {
        codeLabel.innerHTML = "[ ]";
        codeLabel.classList.remove("highlight", colors.YELLOW);
        infoLabel.innerHTML = "";
    } else {
        codeLabel.innerHTML = code;
        codeLabel.classList.add("highlight", colors.YELLOW);
        copyToClipboard(code);
        infoLabel.innerHTML = "<b>Code copied to the clipboard.</b>";
    }
}