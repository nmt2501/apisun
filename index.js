const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== LƯU LỊCH SỬ ================== */
// 1 = TÀI, 0 = XỈU
let history = [];
const MAX_HISTORY = 50;

/* ================== API ================== */
app.get("/api/tx/sun", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://sunvip-bh9k.onrender.com/api/taixiu/sun"
    );

    const value = data.tong >= 11 ? 1 : 0;

    // tránh trùng phiên
    if (!history.find(h => h.phien === data.phien)) {
      history.push({ phien: data.phien, value });
      if (history.length > MAX_HISTORY) history.shift();
    }

    // pattern T/X
    const pattern = history.map(h => (h.value === 1 ? "T" : "X")).join("");

    // dữ liệu cho thuật toán
    const dataPredict = history.map(h => h.value);

    // dự đoán
    const duDoanRaw = duDoanNangCao(dataPredict);

    // xử lý output theo yêu cầu
    let duDoanFinal = "Chưa Đủ Dữ Liệu";
    let doTinCay = 0;

    if (duDoanRaw === "TÀI") {
      duDoanFinal = "Tài";
      doTinCay = 85;
    } else if (duDoanRaw === "XỈU") {
      duDoanFinal = "Xỉu";
      doTinCay = 85;
    }

    res.json({
      phien: data.phien || 0,
      xuc_xac_1: data.xuc_xac_1 || 0,
      xuc_xac_2: data.xuc_xac_2 || 0,
      xuc_xac_3: data.xuc_xac_3 || 0,
      tong: data.tong || 0,
      ket_qua: value === 1 ? "Tài" : "Xỉu",

      phien_hien_tai: data.phien || 0,
      pattern: pattern,
      du_doan: duDoanFinal,
      do_tin_cay: doTinCay
    });
  } catch (err) {
    res.status(500).json({ error: "API Gốc Lỗi" });
  }
});

/* ================== THUẬT TOÁN ================== */

function duDoan(data) {
  if (!data || data.length < 10) return "Không Đủ Dữ Liệu";

  const k1 = phuongPhapChuoi(data);
  const k2 = phuongPhapXuHuong(data);
  const k3 = phuongPhapTanSuat(data);
  const k4 = phuongPhapMarkov(data);

  return tongHopKetQua(k1, k2, k3, k4);
}

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
  return d.filter(x => x === 1).length > d.length / 2 ? "TÀI" : "XỈU";
}

function phuongPhapTanSuat(data) {
  const d = data.slice(-20);
  const t = d.filter(x => x === 1).length;
  return t >= d.length / 2 ? "TÀI" : "XỈU";
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

function tongHopKetQua(a, b, c, d) {
  const arr = [a, b, c, d];
  let tai = arr.filter(x => x === "TÀI").length;
  let xiu = arr.filter(x => x === "XỈU").length;
  if (tai > xiu) return "TÀI";
  if (xiu > tai) return "XỈU";
  return d;
}

function duDoanNangCao(data) {
  return duDoan(data);
}

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
