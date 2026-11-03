import jwt from "jsonwebtoken"
import crypto from "crypto"

// Same payload as config/token.js, signed with the fake test secret.
export const authCookie = (userId, options = { expiresIn: "7d" }, secret = process.env.JWT_SECRET) => {
    const token = jwt.sign({ userId: String(userId) }, secret, options)
    return `token=${token}`
}

// A token the mocked firebaseAdmin.js (tests/setup.js) accepts and decodes to these claims.
export const googleIdToken = (claims) =>
    "fake-google-id-token:" + Buffer.from(JSON.stringify({ email_verified: true, ...claims })).toString("base64url")

// What Razorpay sends back: HMAC-SHA256 of "orderId|paymentId" keyed with the key secret.
export const sign = (orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) =>
    crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
