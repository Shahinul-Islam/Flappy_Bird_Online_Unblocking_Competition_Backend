const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const scoreRoutes = require("./routes/scores");

// Load environment variables
dotenv.config();

const app = express();

// Middleware for security headers
app.use(helmet());

// Middleware for CORS
app.use(cors());

// Middleware for parsing JSON
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: "Too many requests, please try again later.",
});
app.use(limiter);

// Health check route
app.get("/", (req, res) => {
    res.status(200).json({ status: "OK", message: "Server is running" });
});

// API routes
app.use("/api/scores", scoreRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: "Something went wrong!", 
        details: err.message 
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
