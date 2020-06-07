module.exports= (io,socket) => {
    socket.on('send', function(data){
        const id = data.id;
        const messageDetail = data.messageDetail;
        messageDetail.time = Date.now();
        socket.emit(messageDetail.from+'Acknoledge', {
            status: 'Sent',
            to: id,
            index: messageDetail.index
        });
        io.emit(id, {messageDetail: messageDetail});
    });
    socket.on("UpdateStatus", data => {
        io.emit(data.from+'Acknoledge', data);
    });
}