import { describe, it, expect, afterEach, vi } from "vitest"
import request from "supertest"
import mongoose from "mongoose"
import app from "../app.js"
import User from "../models/user.model.js"
import { authCookie, googleIdToken } from "./helpers.js"

const createUser = () => User.create({ name: "Asha", email: "asha@example.com", credits: 100 })

describe("isAuth middleware (GET /api/user/current-user)", () => {
    it("returns 401 when there is no cookie", async () => {
        const res = await request(app).get("/api/user/current-user")
        expect(res.status).toBe(401)
        expect(res.body.message).toMatch(/not authenticated/i)
    })

    it("returns 401 for a garbage token", async () => {
        const res = await request(app).get("/api/user/current-user").set("Cookie", "token=not-a-jwt")
        expect(res.status).toBe(401)
        expect(res.body.message).toMatch(/invalid or expired/i)
    })

    it("returns 401 for an expired token", async () => {
        const user = await createUser()
        const res = await request(app)
            .get("/api/user/current-user")
            .set("Cookie", authCookie(user._id, { expiresIn: -10 }))
        expect(res.status).toBe(401)
    })

    it("returns 401 for a token signed with a different secret", async () => {
        const user = await createUser()
        const res = await request(app)
            .get("/api/user/current-user")
            .set("Cookie", authCookie(user._id, { expiresIn: "7d" }, "some-other-secret"))
        expect(res.status).toBe(401)
    })

    it("returns 200 and the user for a valid token", async () => {
        const user = await createUser()
        const res = await request(app).get("/api/user/current-user").set("Cookie", authCookie(user._id))
        expect(res.status).toBe(200)
        expect(res.body._id).toBe(String(user._id))
        expect(res.body.email).toBe("asha@example.com")
        expect(res.body.credits).toBe(100)
    })

    it("returns 404 for a valid token of a deleted user", async () => {
        const res = await request(app)
            .get("/api/user/current-user")
            .set("Cookie", authCookie(new mongoose.Types.ObjectId()))
        expect(res.status).toBe(404)
    })
})

describe("auth cookies", () => {
    it("login sets an HttpOnly, Secure, SameSite=None token cookie", async () => {
        const res = await request(app)
            .post("/api/auth/google")
            .send({ idToken: googleIdToken({ name: "Asha", email: "asha@example.com" }) })
        expect(res.status).toBe(200)
        const cookie = res.headers["set-cookie"].find((c) => c.startsWith("token="))
        expect(cookie).toBeDefined()
        expect(cookie).toMatch(/HttpOnly/i)
        expect(cookie).toMatch(/Secure/i)
        expect(cookie).toMatch(/SameSite=None/i)
    })

    it("logout returns 200 and clears the token cookie with the same options", async () => {
        const res = await request(app).get("/api/auth/logout")
        expect(res.status).toBe(200)
        const cookie = res.headers["set-cookie"].find((c) => c.startsWith("token="))
        expect(cookie).toMatch(/^token=;/)
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/)
        expect(cookie).toMatch(/HttpOnly/i)
        expect(cookie).toMatch(/Secure/i)
        expect(cookie).toMatch(/SameSite=None/i)
    })
})

describe("POST /api/auth/google", () => {
    // Before the fix, googleAuth trusted `name` and `email` from the request body, so anyone who
    // POSTed {"email": "victim@gmail.com"} was logged in as that user.
    it("rejects a login that has no verified Google ID token", async () => {
        await User.create({ name: "Victim", email: "victim@gmail.com" })
        const res = await request(app).post("/api/auth/google").send({ email: "victim@gmail.com" })
        expect(res.status).toBe(401)
        expect(res.headers["set-cookie"]).toBeUndefined()
    })

    it("rejects an invalid Google ID token", async () => {
        const res = await request(app)
            .post("/api/auth/google")
            .send({ idToken: "forged-token", email: "victim@gmail.com" })
        expect(res.status).toBe(401)
        expect(res.headers["set-cookie"]).toBeUndefined()
    })

    it("rejects a token whose email is not verified", async () => {
        const res = await request(app)
            .post("/api/auth/google")
            .send({ idToken: googleIdToken({ email: "asha@example.com", email_verified: false }) })
        expect(res.status).toBe(401)
    })

    it("takes the email from the verified token, not from the body", async () => {
        await User.create({ name: "Victim", email: "victim@gmail.com", credits: 999 })
        const res = await request(app)
            .post("/api/auth/google")
            .send({
                idToken: googleIdToken({ name: "Asha", email: "asha@example.com" }),
                name: "Victim",
                email: "victim@gmail.com",
            })
        expect(res.status).toBe(200)
        expect(res.body.email).toBe("asha@example.com")
        expect(res.body.name).toBe("Asha")
        expect(res.body.credits).toBe(100)
    })

    it("logs an existing user back into the same account", async () => {
        const existing = await User.create({ name: "Asha", email: "asha@example.com", credits: 40 })
        const res = await request(app)
            .post("/api/auth/google")
            .send({ idToken: googleIdToken({ name: "Asha", email: "asha@example.com" }) })
        expect(res.status).toBe(200)
        expect(res.body._id).toBe(String(existing._id))
        expect(res.body.credits).toBe(40)
        expect(await User.countDocuments()).toBe(1)
    })
})

describe("config/firebaseAdmin.js (real module, no network)", () => {
    const loadReal = () => vi.importActual("../config/firebaseAdmin.js")

    afterEach(() => {
        delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    })

    it("throws FirebaseNotConfiguredError when the env var is missing", async () => {
        const { default: verify, FirebaseNotConfiguredError } = await loadReal()
        await expect(verify("any-token")).rejects.toBeInstanceOf(FirebaseNotConfiguredError)
    })

    it("throws FirebaseNotConfiguredError when the env var is not a service account", async () => {
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from("not json").toString("base64")
        const { default: verify, FirebaseNotConfiguredError } = await loadReal()
        await expect(verify("any-token")).rejects.toBeInstanceOf(FirebaseNotConfiguredError)
    })

    it("returns 500, not 401, when the server is not configured", async () => {
        const { default: verify, FirebaseNotConfiguredError } = await import("../config/firebaseAdmin.js")
        verify.mockRejectedValueOnce(new FirebaseNotConfiguredError("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set"))
        const res = await request(app).post("/api/auth/google").send({ idToken: "anything" })
        expect(res.status).toBe(500)
    })
})
