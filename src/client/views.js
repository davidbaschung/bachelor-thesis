console.log("React script loaded");
'use strict'; //TODO

class PeerView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {role:"user"};
    }

    render() {
        if (this.state.role=="user") {
            return (
                <div class="outerZone">
                    <h3>I want to </h3>
                    <button margin='' onClick={()=>this.setState({role:'sender'})}>Send</button>
                    <button margin='' onClick={()=>this.setState({role:'receiver'})}>Receive</button>
                    <h3>files among a peer user.</h3>
                </div>
            )
        }
        if (this.state.role=="receiver") {
            return (
                <div class="outerZone">
                    <div class="titleZone">
                        <label>If you're the receiver : </label>
                    </div>
                    <div class="innerZone">
                        <label class="gridLabel">Input the sender's code to receive files : </label>
                        <div class="grid">
                            <input id="receiverCodeInput" type="text" placeholder="code-from-the-sender" onclick="clickReceiverField()" onkeydown="inputInReceiverField(event)" />
                            <button id="receiverCodeButton" class="inputButton" onclick="receiverCodeButton(event, 'receiverCode')">OK</button>
                        </div>
                        <div id="senderCodeContainer">
                            <h4>
                                Code for the sender(s) : <br /><br />
                                <label id="senderCode" bold>[ ]</label>
                            </h4>
                            <div></div>
                        </div>
                        <br />
                        <div><label id="receiverFeedback"></label></div>
                    </div>
                </div>
            )
        }
        if (this.state.role=="sender") {
            return (
                <div class="outerZone">
                    <div class="titleZone">
                        <label>If you're the sender : </label>
                    </div>
                    <div class="innerZone">
                        <label class="pagewidth">Drag files (or click) on the <a style={{color:'green'}} bold>box</a> below to send them to someone.</label>
                        <div id='drop1' class='drop' onClick={()=>browseFiles()} onDragOver={()=>dragOverAction(event)} onDragLeave={()=>dragLeaveAction(event)} onDrop={()=>dropAction(event)}>
                            <ul id="filesList">
                            </ul>
                        </div>
                        <button id="validate" onClick={()=>validateButton()} margin="" disabled="true">Validate</button>
                        <button id="reset" onClick={()=>resetButton()} margin="">Reset</button>
                        <div id="receiverCodeContainer">
                            <h4>
                                Code for the receiver(s) : <br /><br />
                                <label id="receiverCode" bold>[ ]</label>
                            </h4>
                            <div></div>
                        </div>
                        <br />
                        <label>Send this code to the receiver(s).</label>
                        <div class="innerZone">
                            <label class="gridLabel">Input the receiver's code before he launches the download's. Remain connected </label>
                                <input id="senderCodeInput" type="text" placeholder="code-from-the-receiver" large onClick={()=>$('senderCodeInput').value=''}/>
                        </div>
                        <br />
                        <div><label id="senderFeedback"></label></div>
                    </div>
                </div>
            )
        }
    }
}

var mainViewDiv = $("mainView");
ReactDOM.render(React.createElement(PeerView), mainViewDiv);