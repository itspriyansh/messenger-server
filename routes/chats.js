const Message = require('../models/message');
const Status = require('../models/status');
const timeout = 10000;

module.exports= (io,socket,sockets) => {
    const sendAcknoledgement = (id, data, mySocket) => {
        if(!mySocket) {
            Status.create(data);
            return;
        }
        mySocket.emit(id+'Acknoledge', data);
        let ackSent = false;
        const waitForResponse = setTimeout(() => {
            if(!ackSent) {
                Status.create(data);
            }
        }, timeout);
        mySocket.on(`AcknoledgementReceived-${JSON.stringify(data)}`, newData => {
            if(JSON.stringify(newData) === JSON.stringify(data)) {
                ackSent = true;
                clearTimeout(waitForResponse);
            }
        });
    }

    socket.on('send', function(data){
        const id = data.id;
        const messageDetail = data.messageDetail;
        messageDetail.time = Date.now();
        sendAcknoledgement(messageDetail.from, {
            status: 'Sent',
            from: messageDetail.from,
            to: id,
            index: messageDetail.index
        }, socket);
        const receiverSocket = io.sockets.clients().sockets[sockets[id]];
        if(receiverSocket) {
            receiverSocket.emit(id, {messageDetail: messageDetail});

            let acknoledgeMentReceived = false;
            const waitForAck = setTimeout(() => {
                if(!acknoledgeMentReceived) {
                    Message.create({...messageDetail, to: id});
                }
            },timeout);
            receiverSocket.on("UpdateStatus", data => {
                if(data.from === messageDetail.from
                    && data.index === messageDetail.index
                    && data.to === id) {
                        acknoledgeMentReceived = true;
                        clearTimeout(waitForAck);
                    }
            });
        } else {
            Message.create({...messageDetail, to: id});
        }
    });
    socket.on("UpdateStatus", data => {
        sendAcknoledgement(data.from, data, io.sockets.clients().sockets[sockets[data.from]]);
    });
    socket.on("end", () => {
        socket.disconnect();
    });
}