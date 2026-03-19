import { Router } from "express";
import { ProductController } from "controller/product.controller.js";
import { authMiddleware } from "middleware/authMiddleware.js";
import { authorizeRole } from "middleware/roleMiddleware.js";
import { ProductValidator } from "valildators/product.validator.js";
import { validate } from "middleware/validate.middleware.js";
import { upload } from "middleware/upload.middleware.js";
import { parseFormData } from "middleware/parseFormData.middleware.js";
import { authorizeProductOwnerOrAdmin } from "middleware/authorizeProductOwnerOrAdmin .middleware.js";

const router = Router();
const controller = new ProductController();

//public route
router.get("/", controller.findAll);
router.get("/search", controller.search);
router.get("/category/:id", controller.getByCategoryId);
router.get(
  "/:id",
  validate(ProductValidator.getProductByIdSchema),
  controller.findById,
);

//Authenticated Route
router.get(
  "/paginated",
  authMiddleware,
  controller.getPaginated.bind(controller),
);

//Admin and Seller Route
router.post(
  "/",
  authMiddleware,
  authorizeRole("admin", "seller"),
  upload.single("image"),
  parseFormData,
  validate(ProductValidator.createProductSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  authorizeProductOwnerOrAdmin,
  authorizeRole("admin", "seller"),
  upload.single("image"),
  parseFormData,
  validate(ProductValidator.updateProductSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  authorizeProductOwnerOrAdmin,
  authorizeRole("admin", "seller"),
  validate(ProductValidator.getProductByIdSchema),
  controller.delete,
);

// router.post(
//   "/upload-image",
//   authMiddleware,
//   authorizeRole("admin"),
//   upload.single("image"),
//   controller.uploadImage,
// );

export default router;
