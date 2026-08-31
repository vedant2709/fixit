import express from "express";
import bookingRoutes from "./routes/bookings.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok health check route is working..." });
});

app.use("/bookings", bookingRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`booking-service running on port ${PORT}`);
});
