import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/connectDb.js"
import app from "./app.js"
import dns from "node:dns";

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

const PORT = process.env.PORT || 6000
app.listen(PORT , ()=>{
    console.log(`Server running on port ${PORT}`)
    connectDb()
})
