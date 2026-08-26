import { AppError } from "../utils/errors.js";

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
  });
};

export const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

  if (err instanceof AppError) {
    const response = {
      error: err.code,
      message: err.message,
    };

    if (err.details) {
      response.details = err.details;
    }

    return res.status(err.statusCode).json(response);
  }

  if (err.code === "23505") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Resource already exists",
    });
  }

  if (err.code?.startsWith("23")) {
    return res.status(400).json({
      error: "DATABASE_ERROR",
      message: "Invalid data for database",
    });
  }

  return res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
};
