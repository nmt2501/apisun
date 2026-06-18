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

    if (arr.length < 10) {
        return {
            du_doan: arr[arr.length - 1] === "T" ? "Tài" : "Xỉu",
            do_tin_cay: "51%",
            ly_do: "Ít dữ liệu"
        };
    }

    // =====================
    // WEIGHT
    // =====================

    const WEIGHT = {
        markov1: 0.20,
        markov2: 0.25,
        markov3: 0.20,
        pattern: 0.20,
        streak: 0.10,
        balance: 0.05
    };

    let scoreT = 0;
    let scoreX = 0;

    // =====================
    // MARKOV 1
    // =====================

    let TT = 0, TX = 0, XT = 0, XX = 0;

    for (let i = 0; i < arr.length - 1; i++) {
        const pair = arr[i] + arr[i + 1];

        if (pair === "TT") TT++;
        if (pair === "TX") TX++;
        if (pair === "XT") XT++;
        if (pair === "XX") XX++;
    }

    const last = arr[arr.length - 1];

    let p1T = 0.5;
    let p1X = 0.5;

    if (last === "T") {
        const total = TT + TX || 1;
        p1T = TT / total;
        p1X = TX / total;
    } else {
        const total = XT + XX || 1;
        p1T = XT / total;
        p1X = XX / total;
    }

    scoreT += p1T * WEIGHT.markov1;
    scoreX += p1X * WEIGHT.markov1;

    // =====================
    // MARKOV 2
    // =====================

    const map2 = {};

    for (let i = 0; i < arr.length - 2; i++) {
        const key = arr[i] + arr[i + 1];

        if (!map2[key]) {
            map2[key] = { T: 0, X: 0 };
        }

        map2[key][arr[i + 2]]++;
    }

    const key2 =
        arr[arr.length - 2] +
        arr[arr.length - 1];

    if (map2[key2]) {
        const total =
            map2[key2].T +
            map2[key2].X;

        scoreT +=
            (map2[key2].T / total) *
            WEIGHT.markov2;

        scoreX +=
            (map2[key2].X / total) *
            WEIGHT.markov2;
    } else {
        scoreT += 0.5 * WEIGHT.markov2;
        scoreX += 0.5 * WEIGHT.markov2;
    }

    // =====================
    // MARKOV 3
    // =====================

    const map3 = {};

    for (let i = 0; i < arr.length - 3; i++) {
        const key =
            arr[i] +
            arr[i + 1] +
            arr[i + 2];

        if (!map3[key]) {
            map3[key] = { T: 0, X: 0 };
        }

        map3[key][arr[i + 3]]++;
    }

    const key3 =
        arr[arr.length - 3] +
        arr[arr.length - 2] +
        arr[arr.length - 1];

    if (map3[key3]) {
        const total =
            map3[key3].T +
            map3[key3].X;

        scoreT +=
            (map3[key3].T / total) *
            WEIGHT.markov3;

        scoreX +=
            (map3[key3].X / total) *
            WEIGHT.markov3;
    } else {
        scoreT += 0.5 * WEIGHT.markov3;
        scoreX += 0.5 * WEIGHT.markov3;
    }

    // =====================
    // PATTERN FREQUENCY
    // =====================

    const patternLen = 4;

    const lastPattern =
        arr.slice(-patternLen).join("");

    let nextT = 0;
    let nextX = 0;

    for (
        let i = 0;
        i < arr.length - patternLen;
        i++
    ) {
        const p =
            arr.slice(i, i + patternLen).join("");

        if (p === lastPattern) {
            if (arr[i + patternLen] === "T")
                nextT++;
            else
                nextX++;
        }
    }

    const patternTotal =
        nextT + nextX;

    if (patternTotal > 0) {
        scoreT +=
            (nextT / patternTotal) *
            WEIGHT.pattern;

        scoreX +=
            (nextX / patternTotal) *
            WEIGHT.pattern;
    } else {
        scoreT += 0.5 * WEIGHT.pattern;
        scoreX += 0.5 * WEIGHT.pattern;
    }

    // =====================
    // STREAK LEARNING
    // =====================

    let streak = 1;

    for (
        let i = arr.length - 2;
        i >= 0;
        i--
    ) {
        if (arr[i] === last) streak++;
        else break;
    }

    if (streak >= 3) {
        scoreT +=
            (last === "T" ? 0.65 : 0.35) *
            WEIGHT.streak;

        scoreX +=
            (last === "X" ? 0.65 : 0.35) *
            WEIGHT.streak;
    } else {
        scoreT += 0.5 * WEIGHT.streak;
        scoreX += 0.5 * WEIGHT.streak;
    }

    // =====================
    // BALANCE
    // =====================

    const recent =
        arr.slice(-20);

    const tCount =
        recent.filter(
            x => x === "T"
        ).length;

    const xCount =
        recent.length - tCount;

    const balanceTotal =
        tCount + xCount;

    scoreT +=
        ((xCount + 1) /
            (balanceTotal + 2)) *
        WEIGHT.balance;

    scoreX +=
        ((tCount + 1) /
            (balanceTotal + 2)) *
        WEIGHT.balance;

    // =====================
    // RESULT
    // =====================

    const total =
        scoreT + scoreX;

    const probT =
        scoreT / total;

    const probX =
        scoreX / total;

    let confidence =
        Math.round(
            Math.max(probT, probX) * 100
        );

    confidence =
        Math.max(
            51,
            Math.min(95, confidence)
        );

    return {
        du_doan:
            probT > probX
                ? "Tài"
                : "Xỉu",

        do_tin_cay:
            confidence + "%",

        score: {
            T: Number(
                probT.toFixed(4)
            ),
            X: Number(
                probX.toFixed(4)
            )
        },

        thong_ke: {
            markov1: true,
            markov2: true,
            markov3: true,
            pattern: true,
            streak,
            history:
                arr.length
        }
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
