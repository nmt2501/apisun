const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== LƯU LỊCH SỬ ================== */
// value: 1 = TÀI, 0 = XỈU
let history = [];
const MAX_HISTORY = 20;

/* ================== FETCH NỀN ================== */
async function fetchSunData() {
  try {
    const { data } = await axios.get(
      "https://sunwinsaygex-production.up.railway.app/api/sun"
    );
    if (!data || !data.phien) return;

    const value = data.tong >= 11 ? 1 : 0;

    if (!history.find(h => h.phien === data.phien)) {
      history.unshift({
        phien: data.phien,
        value,
        ket_qua: value === 1 ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });

      if (history.length > MAX_HISTORY) history.pop();

      console.log(`[AUTO] Phiên ${data.phien_hien_tai} => ${value ? "TÀI" : "XỈU"}`);
    }
  } catch {
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
      history.unshift({
        phien: data.phien,
        value,
        ket_qua: value === 1 ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });
      if (history.length > MAX_HISTORY) history.pop();
    }

    const pattern = history
      .map(h => (h.value === 1 ? "T" : "X"))
      .join("");

    /* ===== ƯU TIÊN THUẬT TOÁN MỚI ===== */
    let duDoanResult = thuatToanMoi.duDoan(history);

    /* ===== FALLBACK ===== */
    if (
      !duDoanResult ||
      duDoanResult.du_doan === "Chưa Đủ Dữ Liệu" ||
      duDoanResult.do_tin_cay < 55
    ) {
      const old = duDoanNangCao(history.map(h => h.value));
      duDoanResult = {
        du_doan: old.du_doan,
        do_tin_cay: Math.max(old.do_tin_cay, duDoanResult?.do_tin_cay || 0)
      };
    }

    res.json({
      phien: data.phien || 0,
      ket_qua: value === 1 ? "Tài" : "Xỉu",
      
      phien_hien_tai: data.phien_tiep_theo || 0,
      pattern,
      du_doan: duDoanResult.du_doan,
      do_tin_cay: duDoanResult.do_tin_cay
    });
  } catch {
    res.status(500).json({ error: "API Gốc Lỗi" });
  }
});

/* ================== THUẬT TOÁN MỚI ================== */

class ThuatToanTaiXiu {
  duDoan(lichSu) {
    if (lichSu.length < 6)
      return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

    const bets = this.batBet(lichSu);
    const xenKe = this.xenKe(lichSu);
    const theoDiem = this.theoDiem(lichSu);

    const votes = [bets, xenKe, theoDiem].filter(Boolean);

    let tai = votes.filter(v => v === "Tài").length;
    let xiu = votes.filter(v => v === "Xỉu").length;

    if (tai === xiu)
      return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

    return {
      du_doan: tai > xiu ? "Tài" : "Xỉu",
      do_tin_cay: Math.round((Math.max(tai, xiu) / votes.length) * 100)
    };
  }

  batBet(ls) {
    const first = ls[0].ket_qua;
    let len = 1;
    for (let i = 1; i < ls.length; i++) {
      if (ls[i].ket_qua === first) len++;
      else break;
    }
    if (len >= 3) return first;
    if (len >= 5) return first === "Tài" ? "Xỉu" : "Tài";
    return null;
  }

  xenKe(ls) {
    let ok = true;
    for (let i = 1; i < 6; i++) {
      if (ls[i].ket_qua === ls[i - 1].ket_qua) ok = false;
    }
    if (ok) return ls[0].ket_qua === "Tài" ? "Xỉu" : "Tài";
    return null;
  }

  theoDiem(ls) {
    const avg =
      ls.slice(0, 5).reduce((s, p) => s + p.d1 + p.d2 + p.d3, 0) / 5;
    if (avg > 12) return "Tài";
    if (avg < 9) return "Xỉu";
    return null;
  }
}

const thuatToanMoi = new ThuatToanTaiXiu();

/* ================== THUẬT TOÁN CŨ ================== */

function duDoanNangCao(data) {
  if (!data || data.length < 10)
    return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

  const votes = [
    phuongPhapChuoi(data),
    phuongPhapXuHuong(data),
    phuongPhapTanSuat(data),
    phuongPhapMarkov(data)
  ];

  const tai = votes.filter(v => v === "TÀI").length;
  const xiu = votes.filter(v => v === "XỈU").length;

  if (tai === xiu)
    return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

  return {
    du_doan: tai > xiu ? "Tài" : "Xỉu",
    do_tin_cay: Math.round((Math.max(tai, xiu) / votes.length) * 100)
  };
}

/* ===== 4 phương pháp cũ giữ nguyên ===== */

function phuongPhapChuoi(data) {
  let last = data.at(-1);
  let len = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] === last) len++;
    else break;
  }
  if (len >= 4) return last ? "XỈU" : "TÀI";
  return last ? "TÀI" : "XỈU";
}

function phuongPhapXuHuong(data) {
  const d = data.slice(-10);
  let s = 0;
  for (let i = 1; i < d.length; i++) s += d[i] === d[i - 1] ? 1 : -1;
  if (s > 2) return d.at(-1) ? "TÀI" : "XỈU";
  if (s < -2) return d.at(-1) ? "XỈU" : "TÀI";
  return d.filter(x => x).length >= d.length / 2 ? "TÀI" : "XỈU";
}

function phuongPhapTanSuat(data) {
  const d = data.slice(-20);
  return d.filter(x => x).length >= d.length / 2 ? "TÀI" : "XỈU";
}

function phuongPhapMarkov(data) {
  let m = [[0, 0], [0, 0]];
  for (let i = 1; i < data.length; i++) m[data[i - 1]][data[i]]++;
  return data.at(-1)
    ? m[1][1] >= m[1][0] ? "TÀI" : "XỈU"
    : m[0][0] >= m[0][1] ? "XỈU" : "TÀI";
}

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
