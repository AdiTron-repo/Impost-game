const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Android needs this file to link the Play Store app to this site (Digital Asset Links).
app.get("/.well-known/assetlinks.json", (req, res) => {
  res.type("application/json").sendFile(path.join(__dirname, "public", "assetlinks.json"), (err) => {
    if (err) res.status(404).end();
  });
});
app.use(express.static(path.join(__dirname, "public")));

const WORDS = {
  Food: ["pizza", "chocolate", "sandwich", "biryani", "mango", "noodles"],
  Animal: ["elephant", "tiger", "peacock", "dolphin", "camel", "penguin"],
  Place: ["library", "airport", "castle", "hospital", "lighthouse", "stadium"],
  Object: ["guitar", "umbrella", "mirror", "telescope", "backpack", "microphone"],
  Vehicle: ["submarine", "bicycle", "helicopter", "train", "tractor", "rocket"],
  Nature: ["volcano", "monsoon", "desert", "rainbow", "waterfall", "glacier"],
  Sport: ["cricket", "football", "badminton", "chess", "swimming", "kabaddi"],
  Event: ["wedding", "festival", "birthday", "concert", "exam", "picnic"],
};
const MIN = 3, MAX = 5, ROUNDS = 2;
const HOLD_MS = 90 * 1000; // how long a disconnected player keeps their seat
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

// Players are identified by a stable id (pid) kept on their device, not by the socket,
// so a player can reconnect on a new socket and get their seat back.
function send(room) {
  const n = room.order.length || 1;
  const base = {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, online: p.online, voted: p.id in room.votes })),
    turn: room.phase === "clues" ? room.order[room.t % n] : null,
    round: Math.min(Math.floor(room.t / n) + 1, ROUNDS),
    rounds: ROUNDS,
    clues: room.clues,
    result: room.result,
    min: MIN,
  };
  const playing = room.phase !== "lobby";
  for (const p of room.players) {
    if (!p.sid) continue;
    io.to(p.sid).emit("state", {
      ...base,
      you: {
        id: p.id,
        imposter: playing && p.id === room.imposter,
        word: playing && p.id !== room.imposter ? room.word : null,
        hint: playing && p.id === room.imposter ? room.category : null,
      },
    });
  }
}

function backToLobby(room, notice) {
  Object.assign(room, { phase: "lobby", order: [], t: 0, clues: [], votes: {}, result: null });
  send(room);
  if (notice) room.players.forEach((p) => p.sid && io.to(p.sid).emit("notice", notice));
}

function removePlayer(room, pid) {
  const left = room.players.find((p) => p.id === pid);
  if (!left) return;
  clearTimeout(left.timer);
  room.players = room.players.filter((p) => p.id !== pid);
  if (!room.players.length) return void delete rooms[room.code];
  if (room.hostId === pid) room.hostId = (room.players.find((p) => p.online) || room.players[0]).id;
  if (room.phase === "lobby") send(room);
  else backToLobby(room, `${left.name} left, so the game was reset.`);
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
  const me = () => (myRoom() ? myRoom().players.find((p) => p.id === socket.data.pid) : null);

  function bind(room, player) {
    clearTimeout(player.timer);
    player.sid = socket.id;
    player.online = true;
    socket.data.room = room.code;
    socket.data.pid = player.id;
    send(room);
  }

  function enter(room, name, pid) {
    const player = { id: pid, name, sid: null, online: true, timer: null };
    room.players.push(player);
    bind(room, player);
  }

  socket.on("create", ({ name, token }, cb) => {
    name = clean(name, 12); const pid = clean(token, 60);
    if (!name || !pid) return cb({ error: "Enter a name first." });
    const code = newCode();
    rooms[code] = { code, hostId: pid, players: [], phase: "lobby", order: [], t: 0, clues: [], votes: {}, result: null };
    enter(rooms[code], name, pid);
    cb({});
  });

  socket.on("join", ({ name, code, token }, cb) => {
    name = clean(name, 12); const pid = clean(token, 60);
    const room = rooms[clean(code, 4).toUpperCase()];
    if (!name || !pid) return cb({ error: "Enter a name first." });
    if (!room) return cb({ error: "No room with that code." });
    const existing = room.players.find((p) => p.id === pid);
    if (existing) { bind(room, existing); return cb({}); }
    if (room.phase !== "lobby") return cb({ error: "That game has already started." });
    if (room.players.length >= MAX) return cb({ error: "That room is full." });
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return cb({ error: "That name is taken in this room." });
    enter(room, name, pid);
    cb({});
  });

  // Called by the app after a dropped connection (phone slept, app switched, network change).
  socket.on("resume", ({ code, token }, cb) => {
    const room = rooms[clean(code, 4).toUpperCase()];
    const player = room && room.players.find((p) => p.id === clean(token, 60));
    if (!player) return cb({ error: "Room expired." });
    bind(room, player);
    cb({});
  });

  socket.on("start", () => {
    const room = myRoom();
    if (!room || room.hostId !== socket.data.pid || room.phase !== "lobby" || room.players.length < MIN) return;
    room.category = pick(Object.keys(WORDS));
    room.word = pick(WORDS[room.category]);
    room.imposter = pick(room.players).id;
    room.order = shuffle(room.players.map((p) => p.id));
    Object.assign(room, { t: 0, clues: [], votes: {}, result: null, phase: "clues" });
    send(room);
  });

  socket.on("clue", (text) => {
    const room = myRoom(), player = me();
    text = clean(text, 40);
    if (!room || !player || room.phase !== "clues" || !text) return;
    if (room.order[room.t % room.order.length] !== player.id) return;
    room.clues.push({ name: player.name, text, round: Math.floor(room.t / room.order.length) + 1 });
    room.t++;
    if (room.t >= room.order.length * ROUNDS) room.phase = "voting";
    send(room);
  });

  socket.on("vote", (targetId) => {
    const room = myRoom(), player = me();
    if (!room || !player || room.phase !== "voting" || targetId === player.id) return;
    if (!room.players.some((p) => p.id === targetId)) return;
    room.votes[player.id] = targetId;
    if (Object.keys(room.votes).length === room.players.length) finishVoting(room);
    send(room);
  });

  socket.on("again", () => {
    const room = myRoom();
    if (room && room.hostId === socket.data.pid && room.phase === "result") backToLobby(room);
  });

  socket.on("leave", () => {
    const room = myRoom(), player = me();
    if (!room || !player) return;
    socket.data.room = null;
    removePlayer(room, player.id);
  });

  socket.on("disconnect", () => {
    const room = myRoom(), player = me();
    if (!room || !player || player.sid !== socket.id) return; // a newer connection already took over
    player.sid = null;
    player.online = false;
    player.timer = setTimeout(() => removePlayer(room, player.id), HOLD_MS);
    send(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Listening on " + PORT));
