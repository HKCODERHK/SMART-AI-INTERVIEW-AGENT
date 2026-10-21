import jwt from "jsonwebtoken"
import crypto from "crypto"

// Same payload as config/token.js, signed with the fake test secret.
export const authCookie = (userId, options = { expiresIn: "7d" }, secret = process.env.JWT_SECRET) => {
    const token = jwt.sign({ userId: String(userId) }, secret, options)
    return `token=${token}`
}

// What Razorpay sends back: HMAC-SHA256 of "orderId|paymentId" keyed with the key secret.
export const sign = (orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) =>
    crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
