import express from 'express';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Server } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);
// middleware
app.use(express.static(path.join(__dirname, 'public')));
// routes
app.get('/', (req, res) => {
    res.sendFile('/public/game.html', { root: __dirname });
});
const MAX_ROOMS = 10;
const PLAYERS_PER_ROOM = 2;
const roomDataArray = [];
let currRoomNo = 1;
io.on('connection', (socket) => {
    console.log('a user connected');
    //Increase currRoomNo if current room is full.
    const room = io.sockets.adapter.rooms.get('room-' + currRoomNo);
    if (room && room.size > 1)
        currRoomNo++;
    socket.join('room-' + currRoomNo);
    //Send this event to everyone in the room.
    io.sockets
        .in('room-' + currRoomNo)
        .emit('connectToRoom', 'You are in room no. ' + currRoomNo);
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    socket.on('drawCard', () => {
        console.log('drawCard method called');
    });
});
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));