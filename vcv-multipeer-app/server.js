const { name } = require('ejs');
const express = require('express')
const app = express()
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
  socket.on('join-room', (roomId, userId, name) => {
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId, name);
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

// -------Participate List-------//

const users = {}

io.on('connection', socket => {
  socket.on('participate-user', name => {
    users[socket.id] = name
    socket.broadcast.emit('participate-connected', name)
  })
  socket.on('disconnect', () => {
    socket.broadcast.emit('participate-disconnected', users[socket.id])
    delete users[socket.id]
  })
})



// ----Participate List End----//


server.listen(process.env.PORT||3030, () => {
    console.log("Server runnig on port 3030!");
})
