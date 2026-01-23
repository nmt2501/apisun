const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== LƯU LỊCH SỬ ================== */
// 1 = TÀI, 0 = XỈU
let history = [];
const MAX_HISTORY = 50;

/* ================== FETCH NỀN ================== */
async function fetchSunData() {
  try {
    const { data } = await axios.get(
      "https://sunwinsaygex-production.up.railway.app/api/sun"
    );

    if (!data || !data.phien) return;

    const value = data.tong >= 11 ? 1 : 0;

    if (!history.find(h => h.phien === data.phien)) {
      history.push({ phien: data.phien, value });
      if (history.length > MAX_HISTORY) history.shift();

      console.log(
        `[AUTO] Phiên ${data.phien} => ${value === 1 ? "TÀI" : "XỈU"}`
      );
    }
  } catch (err) {
    console.log("[AUTO] Lỗi fetch API gốc");
  }
}

setInterval(fetchSunData, 20000);
fetchSunData();

/* ================== API ================== */
app.get("/api/tx/sun", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://sunwinsaygex-production.up.railway.app/api/sun"
    );

    const value = data.tong >= 11 ? 1 : 0;

    if (!history.find(h => h.phien === data.phien)) {
      history.push({ phien: data.phien, value });
      if (history.length > MAX_HISTORY) history.shift();
    }

    const pattern = history.map(h => (h.value === 1 ? "T" : "X")).join("");
    const dataPredict = history.map(h => h.value);

    const duDoanResult = duDoanNangCao(dataPredict);

    res.json({
      phien: data.phien || 0,
      xuc_xac_1: data.xuc_xac_1 || 0,
      xuc_xac_2: data.xuc_xac_2 || 0,
      xuc_xac_3: data.xuc_xac_3 || 0,
      tong: data.tong || 0,
      ket_qua: value === 1 ? "Tài" : "Xỉu",

      phien_hien_tai: data.phien || 0,
      pattern,
      du_doan: duDoanResult.du_doan,
      do_tin_cay: duDoanResult.do_tin_cay
    });
  } catch (err) {
    res.status(500).json({ error: "API Gốc Lỗi" });
  }
});

/* ================== THUẬT TOÁN ================== */

function duDoanNangCao(data) {
  if (!data || data.length < 10) {
    return {
      du_doan: "Chưa Đủ Dữ Liệu",
      do_tin_cay: 0
    };
  }

  const k1 = phuongPhapChuoi(data);
  const k2 = phuongPhapXuHuong(data);
  const k3 = phuongPhapTanSuat(data);
  const k4 = phuongPhapMarkov(data);

  return tongHopKetQua(k1, k2, k3, k4);
}

function tongHopKetQua(a, b, c, d) {
  const votes = [a, b, c, d];

  const tai = votes.filter(v => v === "TÀI").length;
  const xiu = votes.filter(v => v === "XỈU").length;

  if (tai === xiu) {
    return {
      du_doan: "Chưa Đủ Dữ Liệu",
      do_tin_cay: 0
    };
  }

  const winVotes = Math.max(tai, xiu);
  const duDoan = tai > xiu ? "Tài" : "Xỉu";

  return {
    du_doan: duDoan,
    do_tin_cay: Math.round((winVotes / votes.length) * 100)
  };
}

/* ====== 4 PHƯƠNG PHÁP ====== */

function phuongPhapChuoi(data) {
  let last = data[data.length - 1];
  let len = 0;

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] === last) len++;
    else break;
  }

  if (len >= 4) return last === 1 ? "XỈU" : "TÀI";
  if (len <= 2) return last === 1 ? "TÀI" : "XỈU";
  return last === 1 ? "TÀI" : "XỈU";
}

function phuongPhapXuHuong(data) {
  const d = data.slice(-10);
  let score = 0;

  for (let i = 1; i < d.length; i++) {
    score += d[i] === d[i - 1] ? 1 : -1;
  }

  if (score > 2) return d[d.length - 1] === 1 ? "TÀI" : "XỈU";
  if (score < -2) return d[d.length - 1] === 1 ? "XỈU" : "TÀI";

  return d.filter(x => x === 1).length >= d.length / 2 ? "TÀI" : "XỈU";
}

function phuongPhapTanSuat(data) {
  const d = data.slice(-20);
  const tai = d.filter(x => x === 1).length;
  return tai >= d.length / 2 ? "TÀI" : "XỈU";
}

function phuongPhapMarkov(data) {
  let m = [
    [0, 0],
    [0, 0]
  ];

  for (let i = 1; i < data.length; i++) {
    m[data[i - 1]][data[i]]++;
  }

  const cur = data[data.length - 1];

  if (cur === 1) return m[1][1] >= m[1][0] ? "TÀI" : "XỈU";
  return m[0][0] >= m[0][1] ? "XỈU" : "TÀI";
}

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
