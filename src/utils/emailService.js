import nodemailer from 'nodemailer';

// SMTP 설정 (메일플러그)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailplug.co.kr',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true, // 465 포트 사용 시 true
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * 임시 비밀번호 이메일 발송
 * @param {string} toEmail - 수신자 이메일
 * @param {string} tempPassword - 임시 비밀번호
 */
export async function sendTempPasswordEmail(toEmail, tempPassword) {
    const mailOptions = {
        from: `"엠아이토크" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: '[엠아이토크] 임시 비밀번호 안내',
        html: `
            <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    비밀번호 재설정 안내
                </h2>
                <p style="font-size: 14px; color: #333; line-height: 1.6;">
                    안녕하세요.<br><br>
                    요청하신 임시 비밀번호를 안내드립니다.
                </p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666; margin-bottom: 8px;">임시 비밀번호</p>
                    <p style="font-size: 24px; font-weight: bold; color: #3498db; letter-spacing: 2px; margin: 0;">
                        ${tempPassword}
                    </p>
                </div>
                <p style="font-size: 14px; color: #333; line-height: 1.6;">
                    위 임시 비밀번호로 로그인 후, 반드시 <strong>비밀번호를 변경</strong>해 주세요.
                </p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                    본 메일은 발신 전용이며, 문의사항은 관리자에게 연락해 주세요.
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[Email] 임시 비밀번호 이메일 발송 성공:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[Email] 이메일 발송 실패:', error);
        throw new Error('이메일 발송에 실패했습니다.');
    }
}
