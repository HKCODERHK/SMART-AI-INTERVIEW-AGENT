import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import razorpay from "../services/razorpay.service.js";
import crypto from "crypto"

export const createOrder = async (req,res) => {
    try {
        const {planId, amount, credits} = req.body;
          if (!amount || !credits) {
      return res.status(400).json({ message: "Invalid plan data" });
    }

     const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options)

     await Payment.create({
      userId: req.userId,
      planId,
      amount,
      credits,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.json(order);

    
    } catch (error) {
         return res.status(500).json({message:`failed to create Razorpay order ${error}`})
    }
}


export const verifyPayment = async (req,res) => {
    try {
        const {razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature} = req.body

      const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    // constant-time compare; lengths must match first or timingSafeEqual throws
    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(String(razorpay_signature ?? ""));
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // One atomic step: only the request that flips "created" -> "paid" gets the document,
    // so parallel requests for the same order can never credit twice.
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, status: "created" },
      { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id } },
      { returnDocument: "after" }
    );

    if (!payment) {
      const existing = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
      if (existing?.status === "paid") {
        return res.json({ message: "Already processed" });
      }
      return res.status(404).json({ message: "Payment not found" });
    }

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(payment.userId, {
      $inc: { credits: payment.credits }
    },{returnDocument:"after"});

    res.json({
      success: true,
      message: "Payment verified and credits added",
      user: updatedUser,
    });

    } catch (error) {
         return res.status(500).json({message:`failed to verify Razorpay payment ${error}`})
    }
}