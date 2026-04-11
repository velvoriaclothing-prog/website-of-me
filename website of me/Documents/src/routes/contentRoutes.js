const express = require("express");

function createContentRoutes(controller, requireAdmin) {
  const router = express.Router();

  router.get("/public", controller.getPublicContent);
  router.get("/pages/:slug", controller.getPage);
  router.get("/:page", controller.getPageContent);
  router.get("/", requireAdmin, controller.getAll);
  router.post("/:page", requireAdmin, controller.upsertPageContent);
  router.put("/:page", requireAdmin, controller.upsertPageContent);
  router.post("/", requireAdmin, controller.createItem);
  router.put("/:type/:id", requireAdmin, controller.updateItem);
  router.delete("/:type/:id", requireAdmin, controller.deleteItem);

  return router;
}

module.exports = createContentRoutes;
