const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== LƯU LỊCH SỬ ================== */
// value: 1 = TÀI, 0 = XỈU
let history = [];
const MAX_HISTORY = 25;

/* ================== FETCH API GỐC ================== */
async function fetchSunData() {
  try {
    const { data } = await axios.get(
      "https://sunwinsaygex-production.up.railway.app/api/sun",
      { timeout: 5000 }
    );
    if (!data || !data.phien) return;

    const value = data.tong >= 11 ? 1 : 0;

    if (!history.find(h => h.phien === data.phien)) {
      history.unshift({
        phien: data.phien,
        value,
        ket_qua: value ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });

      if (history.length > MAX_HISTORY) history.pop();

      console.log(`[AUTO] ${data.phien} => ${value ? "TÀI" : "XỈU"}`);
    }
  } catch {
    console.log("[AUTO] Lỗi fetch API gốc");
  }
}

setInterval(fetchSunData, 15000);
fetchSunData();

/* ================== TOOL ================== */
const mapTX = v => (v === 1 ? "T" : "X");

/* ================== THUẬT TOÁN 1 – PATTERN / CẦU ================== */
function algoPattern(history) {
  if (history.length < 6)
    return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

  const pattern = history.map(h => mapTX(h.value)).join("");
  const last = pattern.at(-1);

  if (pattern.endsWith("TXTX") || pattern.endsWith("XTXT"))
    return { du_doan: last === "T" ? "Xỉu" : "Tài", do_tin_cay: 70 };

  let run = 1;
  for (let i = pattern.length - 2; i >= 0; i--) {
    if (pattern[i] === last) run++;
    else break;
  }

  if (run >= 3 && run <= 5)
    return { du_doan: last === "T" ? "Tài" : "Xỉu", do_tin_cay: 75 };

  if (run >= 6)
    return { du_doan: last === "T" ? "Xỉu" : "Tài", do_tin_cay: 80 };

  return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };
}

/* ================== THUẬT TOÁN 2 – MD5 STYLE (XU HƯỚNG) ================== */
function algoMD5(history) {
  if (history.length < 8)
    return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

  const recent = history.slice(0, 8).map(h => h.value);
  let score = 0;

  for (let i = 1; i < recent.length; i++) {
    score += recent[i] === recent[i - 1] ? 1 : -1;
  }

  if (score >= 3)
    return { du_doan: recent[0] ? "Tài" : "Xỉu", do_tin_cay: 72 };

  if (score <= -3)
    return { du_doan: recent[0] ? "Xỉu" : "Tài", do_tin_cay: 72 };

  return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };
}

/* ================== THUẬT TOÁN 3 – ĐIỂM XÚC XẮC ================== */
function algoDice(history) {
  if (history.length < 5)
    return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };

  const avg =
    history
      .slice(0, 5)
      .reduce((s, h) => s + h.d1 + h.d2 + h.d3, 0) / 5;

  if (avg >= 12)
    return { du_doan: "Tài", do_tin_cay: 70 };

  if (avg <= 9)
    return { du_doan: "Xỉu", do_tin_cay: 70 };

  return { du_doan: "Chưa Đủ Dữ Liệu", do_tin_cay: 0 };
}

/* ================== BẮT CẦU LOẠN ================== */
function isChaos(results) {
  const valid = results.filter(
    r => r.du_doan !== "Chưa Đủ Dữ Liệu" && r.do_tin_cay >= 55
  );

  if (valid.length === 0) return true;

  const first = valid[0].du_doan;
  return valid.some(r => r.du_doan !== first);
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
      history.unshift({
        phien: data.phien,
        value,
        ket_qua: value ? "Tài" : "Xỉu",
        d1: data.xuc_xac_1,
        d2: data.xuc_xac_2,
        d3: data.xuc_xac_3
      });
      if (history.length > MAX_HISTORY) history.pop();
    }

    const pattern = history.map(h => mapTX(h.value)).join("");

    const r1 = algoPattern(history);
    const r2 = algoMD5(history);
    const r3 = algoDice(history);

    if (isChaos([r1, r2, r3])) {
      return res.json({
        phien: data.phien,
        ket_qua: value ? "Tài" : "Xỉu",
        phien_hien_tai: data.phien_hien_tai,
        pattern,
        du_doan: "Chưa Đủ Dữ Liệu",
        do_tin_cay: "0%",
        trang_thai: "Cầu Loạn – Đứng Ngoài",
        id: "BI NHOI - SUNWIN VIP PRO"
      });
    }

    const final =
      [r1, r2, r3]
        .filter(r => r.du_doan !== "Chưa Đủ Dữ Liệu")
        .sort((a, b) => b.do_tin_cay - a.do_tin_cay)[0];

    res.json({
      phien: data.phien,
      ket_qua: value ? "Tài" : "Xỉu",
      phien_hien_tai: data.phien_hien_tai,
      pattern,
      du_doan: final.du_doan,
      do_tin_cay: `${final.do_tin_cay}%`,
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
