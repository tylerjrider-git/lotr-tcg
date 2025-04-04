const express = require('express'); // HTTP server
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

console.log("Server is starting");

app.use(express.static('public'))

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");
  });

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('message', (data) => {
        console.log("Got a message: %s, data:", data, data.details);
        io.emit('messageAck', data);
    });

    socket.on('cardEvent', (data) => {
        console.log("Got a card Event: %s", data);
        io.emit('cardEventAck', data);
    })

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});


server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});


// here is where the game "events" need to be processed and sent back to both players. e.g. game state synchronization.
// Things like (drew card, discarded a card, reshuffled, played companion, played condition, played manuever/ etc.)