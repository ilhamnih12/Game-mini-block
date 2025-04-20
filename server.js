const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let lastUpdate = Date.now();
const UPDATE_INTERVAL = 33;

// Kirim update ke semua client setiap 33ms (~30 FPS)
let updateInterval = setInterval(() => {
    if (Date.now() - lastUpdate > UPDATE_INTERVAL) {
        sendPlayerUpdates();
        lastUpdate = Date.now();
    }
}, UPDATE_INTERVAL);

wss.on("connection", (ws) => {
    console.log("Pemain terhubung!");

    let playerId = null;

    ws.on("message", (message) => {
        let data = JSON.parse(message);

        if (data.type === "join") {
            playerId = data.id;
            players[playerId] = {
                name: data.name,
                texture: data.texture,
                x: data.x,
                y: data.y,
                z: data.z,
                rotation: { ...data.rotation },
                action: data.action || false,
                moving: false
            };
        }

        if (data.type === "move" && players[data.id]) {
            let prev = players[data.id];

            // Perbarui posisi
            prev.x = data.x;
            prev.y = data.y;
            prev.z = data.z;

            // Perbarui quaternion jika berbeda
            if (!prev.quaternion) prev.quaternion = { x: 0, y: 0, z: 0, w: 1 };

            if (data.quaternion &&
                (Math.abs(prev.quaternion.x - data.quaternion.x) > 0.001 ||
                 Math.abs(prev.quaternion.y - data.quaternion.y) > 0.001 ||
                 Math.abs(prev.quaternion.z - data.quaternion.z) > 0.001 ||
                 Math.abs(prev.quaternion.w - data.quaternion.w) > 0.001)) {
                prev.quaternion = { ...data.quaternion };
            }


            // Simpan aksi animasi (jalan atau tidak)
            prev.action = data.action;

            // Hitung apakah bergerak
            let isMoving = data.action === true;

            prev.moving = isMoving;

            // Broadcast ke semua player
            broadcast({
                type: "move",
                id: data.id,
                x: data.x,
                y: data.y,
                z: data.z,
                quaternion: { ...prev.quaternion },
                action: data.action,
                moving: isMoving
            });
        }
    });

    ws.on("close", () => {
        if (playerId) {
            delete players[playerId];
            broadcast({ type: "leave", id: playerId });
        }
        console.log("Pemain terputus:", playerId);
    });
});

// Kirim pesan ke semua client
function broadcast(message) {
    const msg = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// Kirim data semua pemain
function sendPlayerUpdates() {
    broadcast({ type: "update", players });
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    console.log("Mengirim index.html...");
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(3000, () => console.log("Server berjalan di port 3000"));
