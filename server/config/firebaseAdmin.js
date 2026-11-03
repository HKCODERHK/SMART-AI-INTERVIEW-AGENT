import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

export class FirebaseNotConfiguredError extends Error {}

// The service-account JSON comes from FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 so it fits in one env var).
const getFirebaseAuth = () => {
    if (!getApps().length) {
        const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
        if (!encoded) {
            throw new FirebaseNotConfiguredError("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set")
        }
        let credential
        try {
            credential = cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")))
        } catch (error) {
            throw new FirebaseNotConfiguredError(`FIREBASE_SERVICE_ACCOUNT_BASE64 is not a valid service account: ${error.message}`)
        }
        initializeApp({ credential })
    }
    return getAuth()
}

// Checks the signature, expiry and project of a Firebase ID token and returns its claims.
const verifyGoogleIdToken = async (idToken) => getFirebaseAuth().verifyIdToken(idToken)

export default verifyGoogleIdToken
