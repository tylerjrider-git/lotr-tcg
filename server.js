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

// a map of lists.
/*
games['4676'] = [ "playerId1", "playerId2", etc ]
*/
let games = {}; // global games state.
let currentGameId;

io.on('connection', (socket) => {

    console.log('A new user connected:', socket.id);

    socket.on('message', (data) => {
        console.log("Got a message: %s, data:", data, data.details);
        socket.emit('messageAck', data);
    });

    socket.on('cardEvent', (data) => {
        console.log("Got a card Event: %s (gameID: %d)", JSON.stringify(data, null, 2), socket.gameId);
        // Proxy to other client(s)
        socket.to(socket.gameId).emit('cardEvent', data);
    });

    // Broadcast to "room" the eventInformation
    socket.on('gameEvent', (eventData) => {
        // console.debug("Forwarding game event from %s to others in %s",
        //     socket.id, socket.gameId);
        socket.to(socket.gameId).emit('gameEvent', eventData);
    });

    // Request to join a game.
    socket.on('joinGame', (gameId, playerName) => {
        console.log(`${playerName} joined game ${gameId}`)

        // Create a new game.
        if (!games[gameId]) {
            console.log("Creating a new game")
            games[gameId] = []
        }

        if (games[gameId].length >= 2) {
            console.log("Already 2 users in game. Cannot join")
            return;
        }
        // Add user to game.
        games[gameId].push({ socketId: socket.id, playerName })

        // Emit a gameJoined event back to user.
        socket.gameId = gameId;
        socket.join(gameId);
        // send number of players too
        socket.emit('gameJoined', { gameId: gameId, numPlayersInLobby: games[gameId].length});

        socket.to(gameId).emit('playerJoined', playerName)
    });



    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Find and remove the player from their game
        for (let gameId in games) {
            games[gameId] = games[gameId].filter(player => player.socketId !== socket.id);

            // If this was the last player in the game, delete the game
            if (games[gameId].length === 0) {
                delete games[gameId];
                console.log("Last user left gameId: %d", gameId)
            } else {
                // Optionally, inform other players that someone disconnected
                socket.to(gameId).emit('playerLeft', socket.id);
            }
        }
    });
});

const SERVER_PORT = 3074;
const SERVER_IP = '0.0.0.0';
server.listen(SERVER_PORT, SERVER_IP, () => {
    console.log('Server running on http://%s:%d', SERVER_IP, SERVER_PORT);
});

// here is where the game "events" need to be processed and sent back to both players. e.g. game state synchronization.
// Things like (drew card, discarded a card, reshuffled, played companion, played condition, played manuever/ etc.)