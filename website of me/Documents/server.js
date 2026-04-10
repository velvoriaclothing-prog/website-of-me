require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const createApp = require("./src/app");
const { sessionFromSocket } = require("./src/sessionManager");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const io = new Server({
  cors: {
    origin: true,
    credentials: true
  },
  maxHttpBufferSize: 25 * 1024 * 1024
});

io.use((socket, next) => {
  const session = sessionFromSocket(socket.handshake);
  socket.request.session = session;
  next();
});

const app = createApp(io);
const server = http.createServer(app);

io.attach(server);

server.listen(PORT, HOST, () => {
  console.log(`Gamers Arena running on http://${HOST}:${PORT}`);
});
