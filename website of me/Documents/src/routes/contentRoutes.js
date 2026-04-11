const express = require("express");
const {
  createContent,
  deleteContent,
  listContent,
  updateContentItem
} = require("../controllers/contentController");

module.exports = function createContentRoutes({ requireAdmin }) {
  const router = express.Router();

  router.get("/", requireAdmin, listContent);
  router.post("/", requireAdmin, createContent);
  router.put("/", requireAdmin, updateContentItem);
  router.delete("/", requireAdmin, deleteContent);

  return router;
};
