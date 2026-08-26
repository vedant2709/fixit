export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super(400, "VALIDATION_ERROR", "Invalid request data");
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from, to) {
    super(
      400,
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from '${from}' to '${to}'`
    );
  }
}
