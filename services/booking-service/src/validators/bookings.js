import Joi from "joi";

const createBookingSchema = Joi.object({
  service_type: Joi.string()
    .valid("plumber", "electrician", "cleaner")
    .required(),

  slot_time: Joi.date().iso().greater("now").required(),

  address: Joi.string().trim().min(1).max(500).required(),
});

export const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      'pending',
      'assigned',
      'en_route',
      'in_progress',
      'completed',
      'cancelled'
    )
    .required(),
});

export const bookingIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export default createBookingSchema;
