// safe qrcode.js
const express = require("express");
const router = express.Router();
const passport = require("passport");

const initModels = require("../models/init-models");
const sequelize = require("../config/db/db_sequelise");
const models = initModels(sequelize);

function uploadDisabled(req, res, next) {
  console.log("⚠ Upload middleware skipped (Render local-disk mode).");
  req.file = null;
  req.files = [];
  next();
}

router.get("/", passport.authenticate("jwt", { session: false }), async (req, res) => {
  try {
    const codes = await models.foodprint_qrcode.findAll();
    res.json({ success: true, data: codes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/create",
  passport.authenticate("jwt", { session: false }),
  uploadDisabled,
  async (req, res) => {
    try {
      const { qrcode_company_name, qrcode_message } = req.body;
      const qr = await models.foodprint_qrcode.create({
        qrcode_company_name,
        qrcode_message,
        image_url: null
      });
      res.json({ success: true, message: "Created (upload disabled)", data: qr });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

router.post("/edit/:id",
  passport.authenticate("jwt", { session: false }),
  uploadDisabled,
  async (req, res) => {
    try {
      const qr = await models.foodprint_qrcode.findByPk(req.params.id);
      if (!qr) return res.status(404).json({ success: false, error: "Not found" });
      await qr.update({ qrcode_message: req.body.qrcode_message });
      res.json({ success: true, message: "Updated (upload disabled)" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

router.post("/delete/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const qr = await models.foodprint_qrcode.findByPk(req.params.id);
      if (!qr) return res.status(404).json({ success: false, error: "Not found" });
      await qr.destroy();
      res.json({ success: true, message: "Deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

module.exports = router;
