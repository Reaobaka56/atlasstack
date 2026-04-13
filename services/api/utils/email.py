import smtplib
from email.message import EmailMessage
import structlog
from core.config import settings

logger = structlog.get_logger()

def send_otp_email(to_email: str, otp_code: str):
    """
    Sends a 6-digit OTP code for password reset via configured SMTP.
    If SMTP_HOST is not configured, logs the OTP to the console instead.
    """
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP_HOST is not configured. Logging OTP instead of sending email.",
            to=to_email,
            otp_code=otp_code
        )
        return

    msg = EmailMessage()
    msg["Subject"] = "AtlasStack - Your Password Reset Code"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    body = f"""Hello,

Your password reset verification code is:

    {otp_code}

This code expires in 10 minutes. If you did not request a password reset, please ignore this email.

Best regards,
AtlasStack Team
"""
    msg.set_content(body)

    html_body = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e2e8f0; padding: 40px;">
        <div style="max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 48px; text-align: center;">
          <h2 style="color: #fff; font-size: 24px; margin-bottom: 8px;">Password Reset Code</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 32px;">Enter this code in AtlasStack to reset your password.</p>
          <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #fff; font-family: monospace;">{otp_code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 32px 0;" />
          <p style="color: #475569; font-size: 11px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """
    msg.add_alternative(html_body, subtype="html")

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.send_message(msg)
        server.quit()
        logger.info("OTP email sent", to=to_email)
    except Exception as e:
        logger.error("Failed to send OTP email", error=str(e), to=to_email)
