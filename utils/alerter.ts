// utils/alerter.ts
import nodemailer from 'nodemailer';
import log from './logger';

class AlertManager {
    private transporter: nodemailer.Transporter;
    private lastAlertTime = 0;
    private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown

    constructor() {
        // Fixed: createTransport (not createTransporter)
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });

        // Alternative: For regular Gmail accounts, use this instead:
        // this.transporter = nodemailer.createTransport({
        //     service: 'gmail',
        //     auth: {
        //         user: process.env.GMAIL_USER,
        //         pass: process.env.GMAIL_APP_PASSWORD
        //     }
        // });
    }

    async sendCrashAlert(error: string, context?: string) {
        const now = Date.now();

        // Prevent spam by limiting alerts to once per 5 minutes
        if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
            log.info('Alert suppressed due to cooldown period');
            return;
        }

        try {
            const emailContent = `
🚨 LYRICS API SERVER ALERT 🚨

Time: ${new Date().toISOString()}
Error: ${error}
${context ? `Context: ${context}` : ''}

The server has encountered an issue and may restart automatically.

---
This is an automated alert from your Lyrics API server.
            `.trim();

            await this.transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: 'info@nicevois.com',
                subject: '🚨 Lyrics API Server Alert',
                text: emailContent,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <h2 style="color: #d73027;">🚨 LYRICS API SERVER ALERT</h2>
                        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                        <p><strong>Error:</strong> <code style="background: #f5f5f5; padding: 2px 4px;">${error}</code></p>
                        ${context ? `<p><strong>Context:</strong> ${context}</p>` : ''}
                        <p>The server has encountered an issue and may restart automatically.</p>
                        <hr>
                        <small>This is an automated alert from your Lyrics API server.</small>
                    </div>
                `
            });

            this.lastAlertTime = now;
            log.info('✅ Crash alert sent successfully to info@nicevois.com');

        } catch (emailError) {
            log.error(`❌ Failed to send alert email: ${emailError}`);
        }
    }

    async testConnection() {
        try {
            await this.transporter.verify();
            log.info('✅ Email transporter connection verified');

            // Send test email
            await this.transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: 'info@nicevois.com',
                subject: 'Test - Email Setup Working',
                text: 'If you receive this, the email alert system is working correctly!'
            });

            log.info('✅ Test email sent successfully');
            return true;
        } catch (error) {
            log.error(`❌ Email setup test failed: ${error}`);
            return false;
        }
    }
}

export const alertManager = new AlertManager();