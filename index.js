const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== LƯU LỊCH SỬ ================== */
/* value: 1 = TÀI, 0 = XỈU */
let history = []; // LƯU CŨ -> MỚI
const MAX_HISTORY = 50;

/* ================== FETCH API GỐC ================== */
async function fetchSunData() {
  try {
    const { data } = await axios.get(
      "https://convinced-campaign-effects-plc.trycloudflare.com/api/tx",
      { timeout: 5000 }
    );
    if (!data || !data.phien) return;

    const value = data.tong >= 11 ? 1 : 0;

    // PUSH CUỐI → pattern đúng chiều
    if (!history.find(h => h.phien === data.phien)) {
      history.push({
        phien: data.phien,
        value,
        ket_qua: value ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });

      if (history.length > MAX_HISTORY) history.shift();

      console.log(`[AUTO] ${data.phien} => ${value ? "TÀI" : "XỈU"}`);
    }
  } catch {
    console.log("[AUTO] Lỗi fetch API gốc");
  }
}

setInterval(fetchSunData, 15000);
fetchSunData();

/* ================== TOOL ================== */
const toTX = kq => (kq === "Tài" ? "T" : "X");
const flip = v => (v === "T" ? "X" : "T");

/* ================== BUILD RUN ================== */
function buildRuns(pattern) {
  if (!pattern || pattern.length === 0) return [];
  const runs = [];
  let cur = pattern[0];
  let len = 1;

  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] === cur) len++;
    else {
      runs.push({ v: cur, l: len });
      cur = pattern[i];
      len = 1;
    }
  }
  runs.push({ v: cur, l: len });
  return runs;
}

function buildCau(pattern, take = 3) {
  const runs = buildRuns(pattern);
  if (runs.length === 0) return null;
  return runs.slice(-take).map(r => r.l).join("-");
}

/* ================== SUY CẦU 4 KÝ TỰ CUỐI ================== */
function inferFromLast4(pattern) {
  if (pattern.length < 4) return null;

  const last4 = pattern.slice(-4);
  let runs = [];
  let cur = last4[0], len = 1;

  for (let i = 1; i < last4.length; i++) {
    if (last4[i] === cur) len++;
    else {
      runs.push(len);
      cur = last4[i];
      len = 1;
    }
  }
  runs.push(len);

  return runs.join("-");
}

/* ================== THUẬT TOÁN DỰ ĐOÁN (NGUYÊN BẢN) ================== */
function predictByAlgorithm(pattern) {
  if (!pattern || pattern.length < 7) {
    return {
      du_doan: "Chưa Đủ Dữ Liệu",
      do_tin_cay: "0%",
      cau: buildCau(pattern)
    };
  }

  const runs = buildRuns(pattern);
  const last = runs[runs.length - 1];
  const cau = buildCau(pattern);
  const last4Cau = inferFromLast4(pattern);

  let score = 70;
  let next = last.v;
  let reasons = [];

  /* ===== BỆT ===== */
  if (last.l >= 6) {
    next = flip(last.v);
    score += 20;
    reasons.push("Bệt dài đảo chiều");
  }

  /* ===== BÁM ===== */
  else if (last.l >= 3 && last.l <= 5) {
    next = last.v;
    score += 15;
    reasons.push("Bám cầu");
  }

  /* ===== 1-1 ===== */
  if (pattern.slice(-4) === "TXTX" || pattern.slice(-4) === "XTXT") {
    next = flip(last.v);
    score += 10;
    reasons.push("Nhịp 1-1");
  }

  /* ===== CẦU KHÓ ===== */
  if (["1-3-1", "2-1-2", "3-1-2", "2-4-1"].includes(cau)) {
    next = flip(last.v);
    score += 15;
    reasons.push("Cầu khó đảo");
  }

  /* ===== SUY 4 KÝ TỰ CUỐI ===== */
  if (["2-1-1", "1-2-1", "3-1"].includes(last4Cau)) {
    next = flip(last.v);
    score += 10;
    reasons.push("Suy từ 4 ký tự cuối");
  }

  score = Math.min(96, score);

  return {
    du_doan: next === "T" ? "Tài" : "Xỉu",
    do_tin_cay: `${score}%`,
    cau,
    ly_do: reasons.join(" | ")
  };
}

/* ================== API ================== */
app.get("/api/tx/sun", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://sunwinsaygex-production.up.railway.app/api/sun",
      { timeout: 5000 }
    );

    const value = data.tong >= 11 ? 1 : 0;

    if (!history.find(h => h.phien === data.phien)) {
      history.push({
        phien: data.phien,
        value,
        ket_qua: value ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });
      if (history.length > MAX_HISTORY) history.shift();
    }

    const pattern = history.map(h => (h.value ? "T" : "X")).join("");
    const pred = predictByAlgorithm(pattern);

    res.json({
      phien: data.phien,
      ket_qua: value ? "Tài" : "Xỉu",
      phien_hien_tai: data.phien_hien_tai,
      pattern,
      du_doan: pred.du_doan,
      do_tin_cay: pred.do_tin_cay,
      cau: pred.cau,
      id: "BI NHOI - SUNWIN VIP PRO"
    });
  } catch {
    res.status(500).json({ error: "API Gốc Lỗi" });
  }
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("🚀 SUNWIN API RUNNING ON PORT", PORT);
});
