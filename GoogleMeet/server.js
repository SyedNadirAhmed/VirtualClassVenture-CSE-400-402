// const { Socket } = require('dgram');
// const express = require('express');
// const app = express();
// const server = require('http').Server(app);
// const io = require('socket.io')(server);
// const { v4: uuidv4 } = require('uuid');
// const { ExpressPeerServer } = require('peer');
// const peerServer = ExpressPeerServer(server, {
//     debug: true
// });
// app.set('view engine', 'ejs');
// app.use(express.static("public"));


// app.use('/peerjs', peerServer);

// app.get('/', (req, res) => {
//     res.redirect(`/${uuidv4()}`);
// })
// // /${uuidv4()} generate a unique roomId

// app.get('/:room', (req, res) => {
//     res.render('room', { roomId: req.params.room });
// })
// // here :room is a parameter



// // socket code given below
// io.on('connection', socket => {
//     socket.on('join-room', (roomId) => {
//         console.log('Joined in the room');
//         socket.join(roomId);
//         socket.to(roomId).broadcast.emit('user-connected');
//     })
// })
// server.listen(4000, ()=> {
//     console.log("Server running on port 4000");
// })







// Cleaver Programmar
const express = require('express')
const app = express()
// const cors = require('cors')
// app.use(cors())
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
const { v4: uuidV4 } = require('uuid')

app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId);
    // messages
    socket.on('message', (message) => {
      //send message to the same room
      io.to(roomId).emit('createMessage', message)
  }); 

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

server.listen(process.env.PORT||3030, () => {
    console.log("Server runnig on port 3030!");
})
