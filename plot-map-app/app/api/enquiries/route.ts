import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("-----------------------------------------");
    console.log("NEW ENQUIRY RECEIVED:");
    console.log(JSON.stringify(body, null, 2));
    console.log("-----------------------------------------");
    
    // Attempt to send email notification using SMTP
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL;
    const receiverEmail = process.env.RECIEVER_EMAIL;
    const mockEmail = process.env.MOCK_EMAIL === "true";

    if (mockEmail) {
      console.log("MOCK_EMAIL is true, skipping actual email send.");
    } else if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFromEmail || !receiverEmail) {
      console.warn("Email notification skipped: SMTP credentials not fully configured.");
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: smtpFromEmail,
          to: receiverEmail,
          subject: `New Plot Enquiry — Plot ${body.plotId}`,
          text: `
A new enquiry has been submitted for Plot ${body.plotId}.

Name: ${body.name}
Email: ${body.email}
Mobile Number: ${body.mobile}
Address: ${body.address}
Timestamp: ${new Date().toLocaleString()}
          `.trim(),
        });
        
        console.log("Email notification sent successfully.");
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Do not throw; we still want to return a 200 OK to the user since their submission was recorded.
      }
    }

    return NextResponse.json({ success: true, message: "Enquiry logged successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error processing enquiry:", error);
    return NextResponse.json({ success: false, message: "Invalid request payload" }, { status: 400 });
  }
}
