const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    try {
        const token = req.header('Authorization');
        
        if (!token) {
            return res.status(401).json({
                error: "Access denied",
                message: "No authentication token provided"
            });
        }

        // Remove 'Bearer ' prefix if present
        const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

        try {
            const verified = jwt.verify(tokenString, process.env.JWT_SECRET);
            req.userId = verified.userId;
            next();
        } catch (err) {
            res.status(401).json({
                error: "Invalid token",
                message: "Your session has expired or is invalid"
            });
        }
    } catch (error) {
        res.status(500).json({
            error: "Authentication error",
            message: error.message
        });
    }
};

module.exports = verifyToken;
