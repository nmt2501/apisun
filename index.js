// server.js

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// ===================================
// === Trạng thái và Cấu hình API ===
// ===================================
let apiResponseData = {
    id: "@NguyenTung2907",
    phien: null,
    xuc_xac_1: null,
    xuc_xac_2: null,
    xuc_xac_3: null,
    tong: null,
    ket_qua: "",
    du_doan: "?",
    pattern: "",
    so_sanh: "Đang chờ kết quả..."
};

let currentSessionId = null;
let lastProcessedSessionId = null;
const patternHistory = [];
let currentPrediction = "?";

// LƯU TRỮ DỰ ĐOÁN THEO PHIÊN
const sessionPredictions = new Map();

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0dWFuZGVwemFpMjUwMiIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjE2MzQxMjIwMCwiYWZmSWQiOiJTdW53aW4iLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJlbWFpbCI6IiIsInRpbWVzdGFtcCI6MTc4MTUzMTgyMjI1OCwibG9ja0dhbWVzIjpbXSwiYW1vdW50IjowLCJsb2NrQ2hhdCI6ZmFsc2UsInBob25lVmVyaWZpZWQiOnRydWUsImlwQWRkcmVzcyI6IjEuNTQuNS4yMzEiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzEwLnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6ImFiOGY5NGM0LTI2MTYtNDI3NS05YzIzLTVhMjFkMDVhZmE4OSIsImVtYWlsVmVyaWZpZWQiOm51bGwsInJlZ1RpbWUiOjE3MTc5NDQ0NzQwNjQsInBob25lIjoiODQzODQ3MzMwNDMiLCJkZXBvc2l0Ijp0cnVlLCJ1c2VybmFtZSI6IlNDX25tdDI1MDIifQ.Lq-B-of3ILILbaMBajnzSKTIK2BBJzs7RnpagBBQXMw";
const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win"
};
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;
const MAX_PATTERN_HISTORY = 20;

// Các message khởi tạo
const initialMessages = [
    [
        1,
        "MiniGame",
        "SC_anhlocbuwin",
        "WangLin",
        {
            "info": "{\"ipAddress\":\"14.172.129.70\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0aWdlcl9idV93aW4iLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMTg2NjY3MDEsImFmZklkIjoiZGVmYXVsdCIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoic3VuLndpbiIsInRpbWVzdGFtcCI6MTc3MTIzMTgwMzQ5OCwibG9ja0dhbWVzIjpbXSwiYW1vdW50IjowLCJsb2NrQ2hhdCI6ZmFsc2UsInBob25lVmVyaWZpZWQiOmZhbHNlLCJpcEFkZHJlc3MiOiIxNC4xNzIuMTI5LjcwIiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNC5wbmciLCJwbGF0Zm9ybUlkIjoxLCJ1c2VySWQiOiJlZGE0NDAzYS03ZDllLTQ5NTUtYWVkMy0xMDU2YjVhMDUxM2YiLCJyZWdUaW1lIjoxNzU4ODAyMjMyNDM4LCJwaG9uZSI6IiIsImRlcG9zaXQiOnRydWUsInVzZXJuYW1lIjoiU0NfYW5obG9jYnV3aW4ifQ.4FT1xAunF09GJzm276zFrM9V2BYd_BPsO_4mcdcRh-w\",\"locale\":\"vi\",\"userId\":\"eda4403a-7d9e-4955-aed3-1056b5a0513f\",\"username\":\"SC_anhlocbuwin\",\"timestamp\":1771231803499,\"refreshToken\":\"30fcde93570147388b3f92df33d75663.3180ff6693d9473db4027954e57c92b3\"}",
            "signature": "8D0448B9546D9F26855DE6B2A6C6B8F420137E610755CD8DCF78AE54528DA479757B5287127E936C84440A2DE1349CCA41A37B6A4A0254639BD4FF660AA6455B19666EABFE7C7B81A10A499199A9C23DFC2DF2AE188C483D21B17075DCFE472AE4C684915476B1F7C5E56F98306E18435CC5771774D859EAFD0B26E8D3A30EE"
        }
    ],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// ===================================
// === THUẬT TOÁN DỰ ĐOÁN ===
// ===================================
class PredictionAlgorithm {
    generatePrediction(patternHistory) {
        let prediction;
        if (Math.random() < 0.55) {
            prediction = "Tài";
        } else {
            prediction = "Xỉu";
        }
        
        if (patternHistory && patternHistory.length > 0) {
            const taiCount = patternHistory.filter(p => p === 'T').length;
            const xiuCount = patternHistory.filter(p => p === 'X').length;
            
            if (xiuCount > taiCount + 3) {
                if (Math.random() < 0.7) {
                    prediction = "Tài";
                }
            } else if (taiCount > xiuCount + 3) {
                if (Math.random() < 0.6) {
                    prediction = "Xỉu";
                }
            }
        }
        
        return prediction;
    }
}

const predictionAlgorithm = new PredictionAlgorithm();

// ===================================
// === Quản lý dự đoán ===
// ===================================
function getOrCreatePrediction(sessionId) {
    if (sessionPredictions.has(sessionId)) {
        return sessionPredictions.get(sessionId);
    }
    
    const newPrediction = predictionAlgorithm.generatePrediction(patternHistory);
    sessionPredictions.set(sessionId, newPrediction);
    
    if (sessionPredictions.size > 50) {
        const firstKey = sessionPredictions.keys().next().value;
        sessionPredictions.delete(firstKey);
    }
    
    console.log(`[🎯] Tạo dự đoán mới cho phiên ${sessionId}: ${newPrediction}`);
    return newPrediction;
}

function isNewSession(sessionId) {
    return sessionId && sessionId !== lastProcessedSessionId;
}

function handleNewSession(sessionId) {
    if (!isNewSession(sessionId)) {
        return null;
    }
    
    console.log(`[🆔] Phiên mới: ${sessionId}`);
    lastProcessedSessionId = sessionId;
    
    const newPrediction = getOrCreatePrediction(sessionId);
    
    // CẬP NHẬT ĐƠN GIẢN - chỉ thay đổi phiên và dự đoán
    apiResponseData.phien = sessionId;
    apiResponseData.du_doan = newPrediction;
    apiResponseData.so_sanh = "Đang chờ kết quả mới...";
    
    console.log(`[🎯] Dự đoán cho phiên ${sessionId}: ${newPrediction}`);
    return newPrediction;
}

// ===================================
// === WebSocket Client ===
// ===================================
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;

function connectWebSocket() {
    if (ws) {
        ws.removeAllListeners();
        ws.close();
    }

    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });

    ws.on('open', () => {
        console.log('[✅] WebSocket connected.');
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(msg));
                }
            }, i * 600);
        });

        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, PING_INTERVAL);
    });

    ws.on('pong', () => {
        console.log('[📶] Ping OK.');
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[📨] Nhận message:', JSON.stringify(data).substring(0, 200));

            if (!Array.isArray(data) || typeof data[1] !== 'object') {
                return;
            }

            const { cmd, sid, d1, d2, d3, gBB } = data[1];

            // Xử lý phiên mới
            if (cmd === 1008 && sid) {
                currentSessionId = sid;
                console.log(`[🆔] Nhận phiên mới: ${sid}`);
                handleNewSession(sid);
            }

            // Xử lý kết quả game
            if (cmd === 1003 && gBB) {
                if (!d1 || !d2 || !d3) {
                    console.log('[❌] Dữ liệu xúc xắc không hợp lệ');
                    return;
                }

                console.log(`[🎲] Nhận kết quả: ${d1}, ${d2}, ${d3}`);
                const total = d1 + d2 + d3;
                const result = (total > 10) ? "T" : "X";

                // Cập nhật pattern history
                patternHistory.push(result);
                if (patternHistory.length > MAX_PATTERN_HISTORY) {
                    patternHistory.shift();
                }

                // Lấy dự đoán
                const sessionPrediction = getOrCreatePrediction(currentSessionId);
                const isPredictionCorrect = sessionPrediction === (result === 'T' ? 'Tài' : 'Xỉu');
                const successText = isPredictionCorrect ? "✅ ĐÚNG" : "❌ SAI";

                // CẬP NHẬT TRỰC TIẾP - đảm bảo hiển thị đầy đủ dữ liệu
                apiResponseData.xuc_xac_1 = d1;
                apiResponseData.xuc_xac_2 = d2;
                apiResponseData.xuc_xac_3 = d3;
                apiResponseData.tong = total;
                apiResponseData.ket_qua = (result === 'T') ? 'Tài' : 'Xỉu';
                apiResponseData.du_doan = sessionPrediction;
                apiResponseData.so_sanh = `Dự đoán: ${sessionPrediction} | Kết quả: ${successText}`;
                apiResponseData.pattern = patternHistory.join('');
                
                console.log(`🎲 Phiên ${apiResponseData.phien}: ${apiResponseData.xuc_xac_1}-${apiResponseData.xuc_xac_2}-${apiResponseData.xuc_xac_3} = ${apiResponseData.tong} (${apiResponseData.ket_qua})`);
                console.log(`🎯 Dự đoán: ${sessionPrediction} | ${successText}`);
                console.log(`📊 Pattern: ${apiResponseData.pattern}`);
                
                // Log để debug
                console.log('[📊] API Data:', JSON.stringify(apiResponseData));
            }
        } catch (e) {
            console.error('[❌] Lỗi xử lý message:', e.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[🔌] WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
        clearInterval(pingInterval);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
    });

    ws.on('error', (err) => {
        console.error('[❌] WebSocket error:', err.message);
        ws.close();
    });
}

// ===================================
// === API Endpoint ===
// ===================================
app.get('/sunlon', (req, res) => {
    console.log('[🌐] API được gọi, trả về:', JSON.stringify(apiResponseData));
    res.json(apiResponseData);
});

app.get('/', (req, res) => {
    res.send(`
        <h2>🎯 Kết quả Sunwin Tài Xỉu (API Phân Tích)</h2>
        <p><a href="/sunlon">Xem kết quả JSON tại /sunlon</a></p>
        <p><strong>Phiên hiện tại:</strong> ${apiResponseData.phien || 'Đang chờ...'}</p>
        <p><strong>Dự đoán hiện tại:</strong> ${apiResponseData.du_doan}</p>
        <p><strong>Kết quả gần nhất:</strong> ${apiResponseData.ket_qua || 'Chưa có'}</p>
        ${apiResponseData.tong ? `
            <p><strong>Xúc xắc:</strong> ${apiResponseData.xuc_xac_1} - ${apiResponseData.xuc_xac_2} - ${apiResponseData.xuc_xac_3}</p>
            <p><strong>Tổng:</strong> ${apiResponseData.tong}</p>
            <p><strong>So sánh:</strong> ${apiResponseData.so_sanh}</p>
            <p><strong>Pattern:</strong> ${apiResponseData.pattern}</p>
        ` : ''}
        <hr>
        <p><em>API tự động cập nhật mỗi 5-10 giây</em></p>
    `);
});

// ===================================
// === Khởi động Server ===
// ===================================
app.listen(PORT, () => {
    console.log(`[🌐] Server is running at http://localhost:${PORT}`);
    console.log(`[🎯] Thuật toán: Random 1 lần mỗi phiên - Giữ cố định đến hết phiên`);
    connectWebSocket();
});
