const User = require("../models/User");

const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: "Error verifying admin status" });
    }
};

module.exports = isAdmin;
