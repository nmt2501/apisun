const express = require("express");

const app = express();
const PORT = 3000;

const API_GOC =
  "https://trails-wish-motel-legacy.trycloudflare.com/api/tx";

let lastPhien = null;
let lastPrediction = null;

let history = [];

let patternHistory = [];

let lastProcessedPhien = null;

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
  // TỰ TÌM PATTERN
  // =====================

  for (let len = 2; len <= 8; len++) {

    const current = arr.slice(-len).join("");

    let nextT = 0;
    let nextX = 0;

    for (let i = 0; i < arr.length - len - 1; i++) {

      const sample =
        arr.slice(i, i + len).join("");

      if (sample === current) {

        const next = arr[i + len];

        if (next === "T") nextT++;
        if (next === "X") nextX++;
      }
    }

    const total = nextT + nextX;

    if (total < 3) continue;

    if (nextT > nextX) {

      signals.push({
        side: "T",
        score: Math.round(
          (nextT / total) * 100
        )
      });

      reasons.push(
        `Pattern ${current} => T (${nextT}/${total})`
      );

    } else if (nextX > nextT) {

      signals.push({
        side: "X",
        score: Math.round(
          (nextX / total) * 100
        )
      });

      reasons.push(
        `Pattern ${current} => X (${nextX}/${total})`
      );
    }
  }

  // =====================
  // BỆT
  // =====================

  let streak = 1;

  const last = arr[arr.length - 1];

  for (
    let i = arr.length - 2;
    i >= 0;
    i--
  ) {
    if (arr[i] === last) streak++;
    else break;
  }

  if (streak >= 4) {

    signals.push({
      side: last,
      score: Math.min(
        50,
        streak * 10
      )
    });

    signals.push({
      side: last === "T" ? "X" : "T",
      score: Math.min(
        35,
        streak * 5
      )
    });

    reasons.push(
      `Bệt ${last}${streak}`
    );
  }

  // =====================
  // MARKOV
  // =====================

  let TT = 0;
  let TX = 0;
  let XT = 0;
  let XX = 0;

  for (let i = 0; i < arr.length - 1; i++) {

    const pair =
      arr[i] + arr[i + 1];

    if (pair === "TT") TT++;
    if (pair === "TX") TX++;
    if (pair === "XT") XT++;
    if (pair === "XX") XX++;
  }

  if (last === "T") {

    if (TT > TX) {

      signals.push({
        side: "T",
        score: 30
      });

      reasons.push(
        `Markov T→T (${TT})`
      );

    } else {

      signals.push({
        side: "X",
        score: 30
      });

      reasons.push(
        `Markov T→X (${TX})`
      );
    }

  } else {

    if (XX > XT) {

      signals.push({
        side: "X",
        score: 30
      });

      reasons.push(
        `Markov X→X (${XX})`
      );

    } else {

      signals.push({
        side: "T",
        score: 30
      });

      reasons.push(
        `Markov X→T (${XT})`
      );
    }
  }

  // =====================
  // TỔNG HỢP
  // =====================

  let scoreT = 0;
  let scoreX = 0;

  for (const s of signals) {

    if (s.side === "T")
      scoreT += s.score;

    if (s.side === "X")
      scoreX += s.score;
  }

  const totalScore =
    scoreT + scoreX;

  if (totalScore < 50) {
    return {
      du_doan: "Không rõ cầu",
      do_tin_cay: "0%",
      ly_do: "Không đủ tín hiệu"
    };
  }

  const winner =
    scoreT > scoreX
      ? "Tài"
      : "Xỉu";

  const confidence =
    Math.round(
      (
        Math.max(
          scoreT,
          scoreX
        ) /
        totalScore
      ) * 100
    );

  return {
    du_doan: winner,
    do_tin_cay:
      confidence + "%",
    ly_do: reasons.join(" | "),
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

  patternHistory.push(
    data.ket_qua === "Tài" ? "T" : "X"
  );

  patternHistory = patternHistory.slice(-50);

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
  console.log(
    `Server running: http://localhost:${PORT}/api/sun`
  );
});
