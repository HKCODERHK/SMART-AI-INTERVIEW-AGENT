import genToken from "../config/token.js"
import verifyGoogleIdToken, { FirebaseNotConfiguredError } from "../config/firebaseAdmin.js"
import User from "../models/user.model.js"


export const googleAuth = async (req,res) => {
    try {
        const {idToken} = req.body
        if(!idToken || typeof idToken !== "string"){
            return res.status(401).json({message:"Google ID token is required"})
        }

        // name and email come only from the verified token, never from the request body
        let decoded
        try {
            decoded = await verifyGoogleIdToken(idToken)
        } catch (error) {
            if(error instanceof FirebaseNotConfiguredError){
                throw error
            }
            return res.status(401).json({message:"Invalid or expired Google ID token"})
        }

        const email = decoded.email
        if(!email || decoded.email_verified === false){
            return res.status(401).json({message:"Google account email is not verified"})
        }
        const name = decoded.name || email.split("@")[0]

        let user = await User.findOne({email})
        if(!user){
            user = await User.create({
                name , 
                email
            })
        }
        let token = await genToken(user._id)
        res.cookie("token" , token , {
            httpOnly:true,
            secure:true,
            sameSite:"none",
            maxAge:7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(user)



    } catch (error) {
        return res.status(500).json({message:`Google auth error ${error}`})
    }
    
}

export const logOut = async (req,res) => {
    try {
        await res.clearCookie("token" , {
            httpOnly:true,
            secure:true,
            sameSite:"none"
        })
        return res.status(200).json({message:"LogOut Successfully"})
    } catch (error) {
         return res.status(500).json({message:`Logout error ${error}`})
    }
    
}
