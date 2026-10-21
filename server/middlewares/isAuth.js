import jwt from "jsonwebtoken"


const isAuth = async (req,res,next) => {
    const {token} = req.cookies || {}

    if(!token){
        return res.status(401).json({message:"Not authenticated: please log in"})
    }

    let verifyToken
    try {
        verifyToken = jwt.verify(token , process.env.JWT_SECRET)
    } catch (error) {
        // malformed, expired, or signed with another secret
        return res.status(401).json({message:"Invalid or expired token: please log in again"})
    }

    if(!verifyToken?.userId){
        return res.status(401).json({message:"Invalid or expired token: please log in again"})
    }
    req.userId = verifyToken.userId

    next()
}

export default isAuth
