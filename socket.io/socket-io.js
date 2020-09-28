exports.init = function (io, app) {
  io.sockets.on('connection', function (socket) {
    try {
      socket.on('custom-message', function (credentials, message, parameter) {
        socket.broadcast.emit('custom-message', message, parameter);
      });

      socket.on('covid-join-room', function (message) {
        try {
          socket.join('covid_room:' + message.room);

          io.to('covid_room:' + message.room).emit('covid-test', {
            status: true,
          });
        } catch (error) {
          console.warn(error);
        }
      });

      socket.on('register-join-room', function (message) {
        try {
          socket.join(message.room);

          io.to(message.room).emit('register-test', {
            status: true,
          });
        } catch (error) {
          console.warn(error);
        }
      });

      socket.on('booking-page-join-room', function (message) {
        try {
          socket.join(message.room);

          io.to(message.room).emit('booking-page-test', {
            status: true,
          });
        } catch (error) {
          console.warn(error);
        }
      });

      socket.on('acuityClick', function (id) {
        socket.broadcast.emit('acuityClick', id);
      });

    } catch (error) {
      console.error(error);
    }
  });
}