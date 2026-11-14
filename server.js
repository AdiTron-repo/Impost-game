const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const WORDS = [
  "pizza", "elephant", "guitar", "volcano", "library", "umbrella", "submarine",
  "cricket", "monsoon", "airport", "chocolate", "mirror", "bicycle", "castle",
  "desert", "football", "hospital", "rainbow", "telescope", "wedding",
  "backpack", "festival", "lighthouse", "microphone", "sandwich", "tiger"
];
const MIN = 3, MAX = 5, ROUNDS = 2;
const rooms = {};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

function newCode() {
  let c;
  do {
    c = Array.from({ length: 4 }, () => pick([..."ABCDEFGHJKLMNPQRSTUVWXYZ"])).join("");
  } while (rooms[c]);
  return c;
}

function send(room) {
  const n = room.order.length || 1;
  const base = {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, voted: p.id in room.votes })),
    turn: room.phase === "clues" ? room.order[room.t % n] : null,
    round: Math.min(Math.floor(room.t / n) + 1, ROUNDS),
    rounds: ROUNDS,
    clues: room.clues,
    result: room.result,
    min: MIN,
  };
  const playing = room.phase !== "lobby";
  for (const p of room.players) {
    io.to(p.id).emit("state", {
      ...base,
      you: {
        id: p.id,
        imposter: playing && p.id === room.imposter,
        word: playing && p.id !== room.imposter ? room.word : null,
      },
    });
  }
}

function backToLobby(room, notice) {
  Object.assign(room, { phase: "lobby", order: [], t: 0, clues: [], votes: {}, result: null });
  send(room);
  if (notice) room.players.forEach((p) => io.to(p.id).emit("notice", notice));
}

function finishVoting(room) {
  const counts = {};
  room.players.forEach((p) => (counts[p.id] = 0));
  Object.values(room.votes).forEach((id) => counts[id]++);
  const top = Math.max(...Object.values(counts));
  const tops = Object.keys(counts).filter((id) => counts[id] === top);
  const votedOut = tops.length === 1 ? tops[0] : null; // a tie means nobody is voted out
  const name = (id) => room.players.find((p) => p.id === id).name;
  room.result = {
    winner: votedOut === room.imposter ? "crew" : "imposter",
    votedOut: votedOut ? name(votedOut) : null,
    imposter: name(room.imposter),
    word: room.word,
    tally: room.players.map((p) => ({ name: p.name, votes: counts[p.id] })),
  };
  room.phase = "result";
}

io.on("connection", (socket) => {
  const myRoom = () => rooms[socket.data.room];

  function enter(room, name) {
    room.players.push({ id: socket.id, name });
    socket.data.room = room.code;
    send(room);
  }

  socket.on("create", ({ name }, cb) => {
    name = clean(name, 12);
    if (!name) return cb({ error: "Enter a name first." });
    const code = newCode();
    rooms[code] = { code, hostId: socket.id, players: [], phase: "lobby", order: [], t: 0, clues: [], votes: {}, result: null };
    enter(rooms[code], name);
    cb({});
  });

  socket.on("join", ({ name, code }, cb) => {
    name = clean(name, 12);
    const room = rooms[clean(code, 4).toUpperCase()];
    if (!name) return cb({ error: "Enter a name first." });
    if (!room) return cb({ error: "No room with that code." });
    if (room.phase !== "lobby") return cb({ error: "That game has already started." });
    if (room.players.length >= MAX) return cb({ error: "That room is full." });
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return cb({ error: "That name is taken in this room." });
    enter(room, name);
    cb({});
  });

  socket.on("start", () => {
    const room = myRoom();
    if (!room || room.hostId !== socket.id || room.phase !== "lobby" || room.players.length < MIN) return;
    room.word = pick(WORDS);
    room.imposter = pick(room.players).id;
    room.order = shuffle(room.players.map((p) => p.id));
    Object.assign(room, { t: 0, clues: [], votes: {}, result: null, phase: "clues" });
    send(room);
  });

  socket.on("clue", (text) => {
    const room = myRoom();
    text = clean(text, 40);
    if (!room || room.phase !== "clues" || !text) return;
    if (room.order[room.t % room.order.length] !== socket.id) return;
    const me = room.players.find((p) => p.id === socket.id);
    room.clues.push({ name: me.name, text, round: Math.floor(room.t / room.order.length) + 1 });
    room.t++;
    if (room.t >= room.order.length * ROUNDS) room.phase = "voting";
    send(room);
  });

  socket.on("vote", (targetId) => {
    const room = myRoom();
    if (!room || room.phase !== "voting" || targetId === socket.id) return;
    if (!room.players.some((p) => p.id === targetId)) return;
    room.votes[socket.id] = targetId;
    if (Object.keys(room.votes).length === room.players.length) finishVoting(room);
    send(room);
  });

  socket.on("again", () => {
    const room = myRoom();
    if (room && room.hostId === socket.id && room.phase === "result") backToLobby(room);
  });

  socket.on("disconnect", () => {
    const room = myRoom();
    if (!room) return;
    const left = room.players.find((p) => p.id === socket.id);
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (!room.players.length) return void delete rooms[room.code];
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    if (room.phase === "lobby") send(room);
    else backToLobby(room, `${left.name} left, so the game was reset.`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Listening on " + PORT));
