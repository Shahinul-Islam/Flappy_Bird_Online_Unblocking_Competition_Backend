const cron = require("node-cron");
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const nodemailer = require("nodemailer");
const Score = require("./models/Score");
require("dotenv").config();

// Email transporter with TLS
const transporter = nodemailer.createTransport({
	host: "smtp.yourprovider.com",
	port: 587,
	secure: false,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
	tls: {
		rejectUnauthorized: false, // Accept self-signed certificates if necessary
	},
});

async function exportAndEmailOldScores() {
	try {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const oldScores = await Score.find({ createdAt: { $lt: thirtyDaysAgo } });

		if (oldScores.length === 0) {
			console.log("No scores older than 30 days to export.");
			return;
		}

		const parser = new Parser({
			fields: ["username", "email", "score", "createdAt"],
		});
		const csv = parser.parse(oldScores);

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: process.env.EMAIL_RECEIVER,
			subject: "Exported Scores Older Than 30 Days",
			text: "Attached is the CSV of scores older than 30 days.",
			attachments: [{ filename: "old_scores.csv", content: csv }],
		};

		await transporter.sendMail(mailOptions);
		console.log("Old scores emailed successfully.");

		await Score.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
		console.log("Old scores deleted from database.");
	} catch (error) {
		console.error("Error in exportAndEmailOldScores:", error);
	}
}

// Schedule task to run daily at midnight
cron.schedule("0 0 * * *", exportAndEmailOldScores);
