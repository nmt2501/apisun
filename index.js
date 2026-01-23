const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// lưu pattern T/X
let history = [];
const MAX_HISTORY = 20;

app.get("/api/taixiu", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://sunvip-bh9k.onrender.com/api/taixiu/sun"
    );

    const kq = data.tong >= 11 ? "T" : "X";

    // tránh trùng phiên
    if (!history.find(h => h.phien === data.phien)) {
      history.push({ phien: data.phien, kq });
      if (history.length > MAX_HISTORY) history.shift();
    }

    const pattern = history.map(h => h.kq).join("");

    res.json({
      phien: data.phien || 0,
      xuc_xac_1: data.xuc_xac_1 || 0,
      xuc_xac_2: data.xuc_xac_2 || 0,
      xuc_xac_3: data.xuc_xac_3 || 0,
      tong: data.tong || 0,
      ket_qua: kq === "T" ? "tai" : "xiu",

      phien_hien_tai: data.phien || 0,
      pattern: pattern,
      du_doan: kq === "T" ? "tai" : "xiu",
      do_tin_cay: "75%"
    });
  } catch (e) {
    res.status(500).json({ error: "API nguồn lỗi" });
  }
});

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
