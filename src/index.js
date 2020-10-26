const express = require('express');
const app = express();
const http = require('http');
const Filter = require('bad-words');
const socketio = require('socket.io');
const path = require('path');
const server = http.createServer(app);
const { generateMessage, generateLocationMessage, toTitleCase } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const publicDirPath = path.join(__dirname, '../public');
const io = socketio(server);

const port = process.env.PORT || 3000;

app.use(express.static(publicDirPath));

io.on('connection', (socket) => {
    console.log('web socket');

    socket.on('join', (options, callback) => {
        const {error, user} = addUser({id: socket.id, ...options});
        if(error){
            return callback(error);
        }
        socket.join(user.room);

        socket.emit('message', generateMessage('Admin', `Welcome ${toTitleCase(user.username)} to ${user.room}`));
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${toTitleCase(user.username)} has joined ${toTitleCase(user.room)}!`));
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    });

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();

        if (filter.isProfane(message)) {
            return callback('Foul words are not allowed!');
        }
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    });

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user){
            io.to(user.room).emit('message', generateMessage('Admin', `${toTitleCase(user.username)} has left ${toTitleCase(user.room)}!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

server.listen(port, () =>
    console.log(`App is listening on port ${port}.`)
);