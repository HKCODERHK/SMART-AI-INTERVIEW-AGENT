import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../app.js"
import User from "../models/user.model.js"
import Payment from "../models/payment.model.js"
import razorpay from "../services/razorpay.service.js"
import { authCookie, sign } from "./helpers.js"

describe("POST /api/payment/order", () => {
    let user

    beforeEach(async () => {
        user = await User.create({ name: "Asha", email: "asha@example.com", credits: 0 })
    })

    it.each([
        ["amount", { planId: "basic", credits: 50 }],
        ["credits", { planId: "basic", amount: 100 }],
    ])("returns 400 without %s and does not call Razorpay", async (_, body) => {
        const res = await request(app)
            .post("/api/payment/order")
            .set("Cookie", authCookie(user._id))
            .send(body)
        expect(res.status).toBe(400)
        expect(razorpay.orders.create).not.toHaveBeenCalled()
        expect(await Payment.countDocuments()).toBe(0)
    })

    it("creates a Razorpay order in paise and saves a 'created' payment", async () => {
        const res = await request(app)
            .post("/api/payment/order")
            .set("Cookie", authCookie(user._id))
            .send({ planId: "basic", amount: 100, credits: 50 })

        expect(res.status).toBe(200)
        expect(res.body.id).toBe("order_test_1")
        expect(razorpay.orders.create).toHaveBeenCalledTimes(1)
        expect(razorpay.orders.create).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 10000, currency: "INR" })
        )

        const payment = await Payment.findOne({ razorpayOrderId: "order_test_1" })
        expect(payment).not.toBeNull()
        expect(payment.status).toBe("created")
        expect(String(payment.userId)).toBe(String(user._id))
        expect(payment.amount).toBe(100)
        expect(payment.credits).toBe(50)
    })

    it("returns 401 when not logged in", async () => {
        const res = await request(app).post("/api/payment/order").send({ amount: 100, credits: 50 })
        expect(res.status).toBe(401)
        expect(razorpay.orders.create).not.toHaveBeenCalled()
    })
})

describe("POST /api/payment/verify", () => {
    let user
    const orderId = "order_1"
    const paymentId = "pay_1"

    beforeEach(async () => {
        user = await User.create({ name: "Asha", email: "asha@example.com", credits: 0 })
        await Payment.create({
            userId: user._id,
            planId: "basic",
            amount: 100,
            credits: 50,
            razorpayOrderId: orderId,
            status: "created",
        })
    })

    const verify = (body) =>
        request(app).post("/api/payment/verify").set("Cookie", authCookie(user._id)).send(body)

    const validBody = () => ({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
    })

    const credits = async () => (await User.findById(user._id)).credits

    it("accepts a valid signature, marks the payment paid and adds credits", async () => {
        const res = await verify(validBody())

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.user.credits).toBe(50)

        const payment = await Payment.findOne({ razorpayOrderId: orderId })
        expect(payment.status).toBe("paid")
        expect(payment.razorpayPaymentId).toBe(paymentId)
        expect(await credits()).toBe(50)
    })

    it("rejects a tampered signature with 400 and changes nothing", async () => {
        const body = validBody()
        const last = body.razorpay_signature.at(-1) === "0" ? "1" : "0"
        body.razorpay_signature = body.razorpay_signature.slice(0, -1) + last

        const res = await verify(body)

        expect(res.status).toBe(400)
        expect((await Payment.findOne({ razorpayOrderId: orderId })).status).toBe("created")
        expect(await credits()).toBe(0)
    })

    it("rejects a signature made for a different payment id", async () => {
        const res = await verify({ ...validBody(), razorpay_signature: sign(orderId, "pay_other") })
        expect(res.status).toBe(400)
        expect(await credits()).toBe(0)
    })

    it("rejects a signature of a different length with 400 (no crash)", async () => {
        const res = await verify({ ...validBody(), razorpay_signature: "abc" })
        expect(res.status).toBe(400)
        expect(await credits()).toBe(0)
    })

    it("returns 404 for an unknown order with a valid signature for it", async () => {
        const res = await verify({
            razorpay_order_id: "order_unknown",
            razorpay_payment_id: paymentId,
            razorpay_signature: sign("order_unknown", paymentId),
        })
        expect(res.status).toBe(404)
        expect(await credits()).toBe(0)
    })

    it("credits only once when the same request is sent twice in a row", async () => {
        const first = await verify(validBody())
        const second = await verify(validBody())

        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        expect(second.body.message).toBe("Already processed")
        expect(await credits()).toBe(50)
    })

    it("credits only once when identical requests arrive at the same time", async () => {
        const responses = await Promise.all([verify(validBody()), verify(validBody())])

        expect(responses.map((r) => r.status)).toEqual([200, 200])
        const messages = responses.map((r) => r.body.message).sort()
        expect(messages).toEqual(["Already processed", "Payment verified and credits added"])
        expect(await credits()).toBe(50)
    })

    it("returns 401 when not logged in", async () => {
        const res = await request(app).post("/api/payment/verify").send(validBody())
        expect(res.status).toBe(401)
        expect(await credits()).toBe(0)
    })
})
