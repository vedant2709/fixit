import express from "express";
import {
  createBookingController,
  getBookingByIdController,
  getBookingsController,
  updateBookingStatusController,
} from "../controllers/bookings.js";

const router = express.Router();

router.post("/", createBookingController);
router.get("/", getBookingsController);
router.get("/:id", getBookingByIdController);
router.patch("/:id/status", updateBookingStatusController);

export default router;
