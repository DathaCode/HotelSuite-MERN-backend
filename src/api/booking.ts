import express from "express";
import {
  createBooking,
  getAllBookingsForHotel,
  getAllBookings,
} from "../application/booking";

const router = express.Router();

// Route to create a new booking
router.post("/", createBooking);

// Route to get all bookings for a specific hotel
router.get("/hotel/:hotelId", getAllBookingsForHotel);

// Route to get all bookings (for admin view, etc.)
router.get("/", getAllBookings);

export default router;
