const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/post.controller");
const identity = require("../middlewares/identity.middleware");

router.post("/", identity, ctrl.create);
router.get("/", identity, ctrl.list);
router.get("/search", identity, ctrl.search); // avant /:id
router.get("/:id", identity, ctrl.getById);
router.put("/:id", identity, ctrl.update);
router.delete("/:id", identity, ctrl.remove);

module.exports = router;
