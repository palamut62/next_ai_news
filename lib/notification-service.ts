export class NotificationService {
  static async sendTelegramNotification(message: string, chatId: string, botToken: string) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to send Telegram notification:", error)
      throw error
    }
  }

  static async sendEmailNotification(
    subject: string,
    message: string,
    toEmail: string,
    fromEmail: string,
    smtpConfig: {
      host: string
      port: number
      username: string
      password: string
    },
  ) {
    // In a real app, you would use a service like Nodemailer or SendGrid
    console.log("Email notification would be sent:", {
      subject,
      message,
      to: toEmail,
      from: fromEmail,
    })
  }

  static async createNotification(notification: {
    type: string
    title: string
    message: string
    severity: "info" | "success" | "warning" | "error"
    metadata?: any
  }) {
    // In a real app, this would save to your database
    console.log("Notification created:", notification)

    // Send to external services if configured
    // await this.sendTelegramNotification(...)
    // await this.sendEmailNotification(...)
  }
}
