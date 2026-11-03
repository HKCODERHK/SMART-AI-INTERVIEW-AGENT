import { beforeAll, afterEach, afterAll, vi } from "vitest"
import mongoose from "mongoose"
import { MongoMemoryServer } from "mongodb-memory-server"

// Fake secrets only. Tests never read .env.
process.env.JWT_SECRET = "test-jwt-secret"
process.env.RAZORPAY_KEY_ID = "rzp_test_fake"
process.env.RAZORPAY_KEY_SECRET = "test-razorpay-secret"
process.env.OPENROUTER_API_KEY = "test-openrouter-key"

// No real Razorpay: orders.create returns a fake order and records its arguments.
vi.mock("../services/razorpay.service.js", () => ({
    default: {
        orders: {
            create: vi.fn(async (options) => ({
                id: "order_test_1",
                amount: options.amount,
                currency: "INR",
            })),
        },
    },
}))

// No real OpenRouter: nothing reaches the internet.
vi.mock("../services/openRouter.service.js", () => ({
    askAi: vi.fn(async () => "{}"),
}))

// No real Firebase: a token made by googleIdToken() in helpers.js decodes to its claims,
// anything else is rejected the way firebase-admin rejects a bad token.
vi.mock("../config/firebaseAdmin.js", () => {
    class FirebaseNotConfiguredError extends Error {}
    const prefix = "fake-google-id-token:"
    return {
        FirebaseNotConfiguredError,
        default: vi.fn(async (idToken) => {
            if (!idToken.startsWith(prefix)) {
                throw Object.assign(new Error("Decoding Firebase ID token failed"), { code: "auth/argument-error" })
            }
            return JSON.parse(Buffer.from(idToken.slice(prefix.length), "base64url").toString("utf8"))
        }),
    }
})

let mongo

beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
})

afterEach(async () => {
    const collections = await mongoose.connection.db.collections()
    for (const collection of collections) {
        await collection.deleteMany({})
    }
})

afterAll(async () => {
    await mongoose.disconnect()
    await mongo?.stop()
})
