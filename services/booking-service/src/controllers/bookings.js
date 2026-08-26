import createBookingSchema, { updateBookingStatusSchema, bookingIdSchema } from "../validators/bookings.js";
import {
  createBooking as createBookingModel,
  getBookingById,
  getBookings,
  updateBookingStatus,
} from "../models/bookings.js";
import { ValidationError } from "../utils/errors.js";
import { isValidTransition } from "../utils/stateMachine.js";

export const createBookingController = async (req, res, next) => {
  try {
    const { error, value } = createBookingSchema.validate(req.body);

    if (error) {
      throw new ValidationError(
        error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      );
    }

    const booking = await createBookingModel(value);

    return res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};

export const getBookingsController = async (req, res, next) => {
  try {
    const { status, service_type } = req.query;

    const bookings = await getBookings({
      status,
      service_type,
    });

    return res.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const getBookingByIdController = async (req, res, next) => {
  try {
    const { error, value } = bookingIdSchema.validate(req.params);

    if (error) {
      throw new ValidationError(
        error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      );
    }

    const { id } = value;

    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Booking not found",
      });
    }

    return res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatusController = async (req, res, next) => {
  try {
    const { error: paramsError, value: paramsValue } = bookingIdSchema.validate(req.params);

    if (paramsError) {
      throw new ValidationError(
        paramsError.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      );
    }

    const { id } = paramsValue;

    const { error, value } = updateBookingStatusSchema.validate(req.body);

    if (error) {
      throw new ValidationError(
        error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      );
    }

    const { status } = value;

    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Booking not found",
      });
    }

    if (!isValidTransition(booking.status, status)) {
      return res.status(400).json({
        error: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition from '${booking.status}' to '${status}'`,
      });
    }

    const updatedBooking = await updateBookingStatus(id, status);

    return res.status(200).json(updatedBooking);
  } catch (error) {
    next(error);
  }
};
