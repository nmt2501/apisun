const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const API_GOC =
  "https://trails-wish-motel-legacy.trycloudflare.com/api/tx";

let lastPhien = null;
let lastPrediction = null;

let history = [];

let patternHistory = [];

let lastProcessedPhien = null;

let processedPhien = null;

let stats = {
  tong_phien: 0,
  thang: 0,
  thua: 0
};

function analyzePattern(pattern) {
  const arr = pattern.split("");

  if (arr.length < 5) {
    return {
      du_doan: "Chưa đủ dữ liệu",
      do_tin_cay: "0%",
      ly_do: `Cần tối thiểu 5 phiên (${arr.length}/5)`
    };
  }

  const signals = [];
  const reasons = [];

  // =====================
  // ENTROPY (độ loạn)
  // =====================
  const recent = arr.slice(-10);
  const tCount = recent.filter(x => x === "T").length;
  const xCount = recent.length - tCount;

  const entropyBalance = Math.abs(tCount - xCount);

  if (entropyBalance <= 1) {
    return {
      du_doan: "Không rõ cầu",
      do_tin_cay: "0%",
      ly_do: "Cầu quá nhiễu (entropy cao)"
    };
  }

  // =====================
  // STREAK / BỆT
  // =====================
  let last = arr[arr.length - 1];
  let streak = 1;

  for (let i = arr.length - 2; i >= 0; i--) {
    if (arr[i] === last) streak++;
    else break;
  }

  if (streak >= 3) {
    signals.push({
      side: last,
      score: Math.min(60, streak * 12)
    });

    signals.push({
      side: last === "T" ? "X" : "T",
      score: Math.min(40, streak * 8)
    });

    reasons.push(`Bệt ${last}${streak}`);
  }

  // =====================
  // ZIGZAG (1-1)
  // =====================
  let zigzag = true;

  for (let i = arr.length - 6; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      zigzag = false;
      break;
    }
  }

  if (zigzag) {
    signals.push({
      side: last === "T" ? "X" : "T",
      score: 35
    });

    reasons.push("ZigZag 1-1");
  }

  // =====================
  // BLOCK PATTERN 2-2 / 3-3
  // =====================
  const last4 = arr.slice(-4).join("");
  const last6 = arr.slice(-6).join("");

  if (last4 === "TTXX" || last4 === "XXTT") {
    signals.push({ side: "T", score: 30 });
    signals.push({ side: "X", score: 30 });
    reasons.push("Block 2-2");
  }

  if (last6 === "TTTXXX" || last6 === "XXXTTT") {
    signals.push({ side: "T", score: 40 });
    signals.push({ side: "X", score: 40 });
    reasons.push("Block 3-3");
  }

  // =====================
  // MEAN REVERSION (đảo cầu)
  // =====================
  const recent10 = arr.slice(-10);
  const t = recent10.filter(x => x === "T").length;
  const x = recent10.length - t;

  if (t >= 8) {
    signals.push({ side: "X", score: 50 });
    reasons.push("Quá T → đảo X");
  }

  if (x >= 8) {
    signals.push({ side: "T", score: 50 });
    reasons.push("Quá X → đảo T");
  }

  // =====================
  // MOMENTUM BREAK
  // =====================
  if (streak >= 5) {
    signals.push({
      side: last === "T" ? "X" : "T",
      score: 65
    });

    reasons.push("Momentum Break");
  }

  // =====================
  // MARKOV (1-step)
  // =====================
  let TT = 0, TX = 0, XT = 0, XX = 0;

  for (let i = 0; i < arr.length - 1; i++) {
    const pair = arr[i] + arr[i + 1];

    if (pair === "TT") TT++;
    if (pair === "TX") TX++;
    if (pair === "XT") XT++;
    if (pair === "XX") XX++;
  }

  const lastPair = arr[arr.length - 2] + arr[arr.length - 1];

  let markovT = 0;
  let markovX = 0;

  if (lastPair.startsWith("T")) {
    const total = TT + TX || 1;
    markovT = TT / total;
    markovX = TX / total;
  } else {
    const total = XT + XX || 1;
    markovT = XT / total;
    markovX = XX / total;
  }

  signals.push({
    side: markovT > markovX ? "T" : "X",
    score: Math.max(markovT, markovX) * 80
  });

  reasons.push("Markov Prob");

  // =====================
  // TỔNG HỢP
  // =====================
  let scoreT = 0;
  let scoreX = 0;

  for (const s of signals) {
    if (s.side === "T") scoreT += s.score;
    else scoreX += s.score;
  }

  const total = scoreT + scoreX;

  if (total < 40) {
    return {
      du_doan: "Không rõ cầu",
      do_tin_cay: "0%",
      ly_do: "Tín hiệu yếu"
    };
  }

  let confidence = Math.round(
    (Math.max(scoreT, scoreX) / total) * 100
  );

  // =====================
  // CALIBRATION (chống ảo)
  // =====================
  confidence = Math.max(50, Math.min(95, confidence));

  return {
    du_doan: scoreT > scoreX ? "Tài" : "Xỉu",
    do_tin_cay: confidence + "%",
    ly_do: reasons.join(" | ")
  };
}

app.get("/api/sun", async (req, res) => {
  try {
    const response = await fetch(API_GOC);

    if (!response.ok) {
      throw new Error(`API gốc lỗi: ${response.status}`);
    }

    const data = await response.json();

    // Dự đoán cho phiên kế tiếp
    const result = analyzePattern(
        patternHistory.join("")
    );

    const du_doan = result.du_doan;
    const do_tin_cay = result.do_tin_cay;
    const ly_do = result.ly_do;

let danh_gia = "⏳ Chưa phân tích";

if (
  lastPhien !== null &&
  Number(data.phien) !== Number(lastPhien) &&
  lastProcessedPhien !== data.phien
) {

  if (data.phien !== processedPhien) {

    patternHistory.push(
      data.ket_qua === "Tài" ? "T" : "X"
    );

    patternHistory = patternHistory.slice(-50);

    processedPhien = data.phien;
  }

  if (
    lastPrediction &&
    lastPrediction !== "Chưa đủ dữ liệu" &&
    lastPrediction !== "Không rõ cầu"
  ) {

    danh_gia =
      lastPrediction === data.ket_qua
        ? "✅ Thắng"
        : "❌ Thua";

    if (lastPrediction === data.ket_qua) {
      stats.thang++;
    } else {
      stats.thua++;
    }
  }

  history.unshift({
    phien: data.phien,
    du_doan:
      !lastPrediction ||
      lastPrediction === "Chưa đủ dữ liệu"
        ? "⏳ Chưa có dự đoán"
        : lastPrediction === "Tài"
        ? "🔴 Tài"
        : "🔵 Xỉu",
    ket_qua:
      data.ket_qua === "Tài"
        ? "🔴 Tài"
        : "🔵 Xỉu",
    danh_gia,
    xuc_xac: [
      data.xuc_xac_1,
      data.xuc_xac_2,
      data.xuc_xac_3
    ],
    tong: data.tong,
    thoi_gian: data.thoi_gian
  });

  history = history.slice(0, 10);

  lastProcessedPhien = data.phien;
}

    // Lưu dự đoán cho phiên hiện tại
    lastPhien = data.phien;
    lastPrediction = du_doan;

    stats.tong_phien = stats.thang + stats.thua;

    const tongTran = stats.thang + stats.thua;

    res.json({
      id: "Bi X Tùng",
      phien: data.phien,
      ket_qua: data.ket_qua,
      xuc_xac: [
        data.xuc_xac_1,
        data.xuc_xac_2,
        data.xuc_xac_3
      ],
      tong: data.tong,
      phien_hien_tai: Number(data.phien) + 1,
      pattern: patternHistory.join(""),
      du_doan,
      do_tin_cay,
      ly_do,
      thong_ke: {
        tong_phien: stats.tong_phien,
        thang: stats.thang,
        thua: stats.thua,
        ti_le:
          tongTran === 0
            ? "0%"
            : (
                (stats.thang / tongTran) *
                100
              ).toFixed(2) + "%"
      }
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/api/sun/history", (req, res) => {
  res.json({
    id: "Bi X Tùng",
    so_phien: history.length,
    lich_su: history
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
