import nodemailer from "nodemailer"

interface OTPSession {
  email: string
  otp: string
  expiresAt: number
  attempts: number
}

// In-memory storage for OTP sessions (in production, use Redis or database)
const otpSessions = new Map<string, OTPSession>()

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
  },
})

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendOTP(email: string): Promise<boolean> {
  try {
    const otp = generateOTP()
    const sessionId = Math.random().toString(36).substring(2, 15)
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    // Store OTP session
    otpSessions.set(sessionId, {
      email,
      otp,
      expiresAt,
      attempts: 0,
    })

    // Send email
    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: "AI Tweet Bot - Giriş Kodu",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">AI Tweet Bot</h2>
          <p>Giriş kodunuz:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #1f2937; font-size: 32px; margin: 0; letter-spacing: 4px;">${otp}</h1>
          </div>
          <p style="color: #6b7280;">Bu kod 5 dakika içinde geçerliliğini yitirecektir.</p>
          <p style="color: #6b7280; font-size: 12px;">Bu e-postayı siz talep etmediyseniz, lütfen görmezden gelin.</p>
        </div>
      `,
    })

    return sessionId
  } catch (error) {
    console.error("Failed to send OTP:", error)
    return false
  }
}

export function verifyOTP(sessionId: string, otp: string): boolean {
  const session = otpSessions.get(sessionId)

  if (!session) {
    return false
  }

  // Check if expired
  if (Date.now() > session.expiresAt) {
    otpSessions.delete(sessionId)
    return false
  }

  // Check attempts limit
  if (session.attempts >= 3) {
    otpSessions.delete(sessionId)
    return false
  }

  // Increment attempts
  session.attempts++

  // Check OTP
  if (session.otp === otp) {
    otpSessions.delete(sessionId)
    return true
  }

  return false
}

export function checkAuth(request: Request): boolean {
  const cookie = request.headers.get("cookie")
  return cookie?.includes("auth=true") || false
}

export function requireAuth() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export function isValidAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  return adminEmail ? email.toLowerCase() === adminEmail.toLowerCase() : false
}
