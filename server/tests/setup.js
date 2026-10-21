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
