// resend.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
// console.log("Resend API Key:", process.env.RESEND_API_KEY);
/**
 * Sends an OTP email to a user
 * @param to - recipient email (e.g., user@gmail.com)
 * @param otp - 6-digit OTP or token
 * @returns Resend API response
 */
export const sendOTPEmail = async (to: string, otp: string) => {
  try {
    const response = await resend.emails.send({
      from: "Yoeun Seyha <yoeunseyha11@gmail.com>", // Must be verified
      to,
      subject: "Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center;">
          <h2>Verify your account</h2>
          <p>Use the OTP below to complete your registration:</p>
          <h1 style="color: #4CAF50;">${otp}</h1>
          <p style="font-size: 0.9rem;">This code expires in 5 minutes.</p>
        </div>
      `,
    });

    console.log("OTP email sent:", response);
    return response;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error("Failed to send email");
  }
};

/**
 * Generates a 6-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
