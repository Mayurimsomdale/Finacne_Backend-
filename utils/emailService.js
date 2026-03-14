// backend/utils/emailService.js
import Mailjet from 'node-mailjet';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Mailjet
const mailjet = new Mailjet({
  apiKey: process.env.MJ_JOB_PUBLIC || '3b8512eb2b73b35feac0f52c367c10e5',
  apiSecret: process.env.MJ_JOB_PRIVATE || '3a2c1fdd8ef8410c29c3290623dd19ad'
});

// Email configuration
const EMAIL_CONFIG = {
  fromEmail: process.env.EMAIL_USER || 'info@instagrp.com',
  fromName: 'InstaCrp HR Department',
  hrEmail: process.env.HR_EMAIL || 'humanresources@instagrp.com',
  contactEmail: process.env.CONTACT_EMAIL || 'info@instagrp.com'
};

/**
 * Send email using Mailjet
 */
const sendEmail = async ({ to, subject, htmlContent, textContent }) => {
  try {
    const request = mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: EMAIL_CONFIG.fromEmail,
              Name: EMAIL_CONFIG.fromName
            },
            To: [
              {
                Email: to,
                Name: to.split('@')[0]
              }
            ],
            Subject: subject,
            TextPart: textContent,
            HTMLPart: htmlContent
          }
        ]
      });

    const result = await request;
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true, messageId: result.body.Messages[0].To[0].MessageID };
  } catch (error) {
    console.error('❌ Email sending failed:', error.statusCode, error.message);
    throw error;
  }
};

/**
 * 1. Registration Confirmation Email (Pending Approval)
 */
export const sendRegistrationConfirmationEmail = async (employeeData) => {
  const { email, first_name, last_name, employee_id } = employeeData;

  const subject = '✅ Registration Received - Pending Approval';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .status-badge { display: inline-block; padding: 8px 16px; background: #fbbf24; color: #92400e; border-radius: 20px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Registration Received!</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${first_name} ${last_name}</strong>,</p>
          
          <p>Thank you for submitting your registration with InstaCrp! We have successfully received your application.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #667eea;">📋 Application Details</h3>
            <p><strong>Employee ID:</strong> ${employee_id || 'Will be assigned upon approval'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Status:</strong> <span class="status-badge">⏳ Pending Approval</span></p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <h3>📌 What Happens Next?</h3>
          <ol>
            <li>Our HR team will review your application and documents</li>
            <li>You will receive an email notification once your application is reviewed</li>
            <li>The review process typically takes 1-2 business days</li>
          </ol>

          <div style="background: #e0e7ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📧 Important:</strong> Please keep this email for your records. You will receive another email once your registration is approved or if additional information is needed.</p>
          </div>

          <p>If you have any questions or concerns, please don't hesitate to contact us at <a href="mailto:${EMAIL_CONFIG.hrEmail}">${EMAIL_CONFIG.hrEmail}</a>.</p>

          <p>Best regards,<br>
          <strong>HR Department</strong><br>
          InstaCrp</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} InstaCrp. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>Contact us: ${EMAIL_CONFIG.contactEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Registration Received - Pending Approval
    
    Dear ${first_name} ${last_name},
    
    Thank you for submitting your registration with InstaCrp! We have successfully received your application.
    
    Application Details:
    - Employee ID: ${employee_id || 'Will be assigned upon approval'}
    - Email: ${email}
    - Status: Pending Approval
    - Submitted: ${new Date().toLocaleDateString()}
    
    What Happens Next?
    1. Our HR team will review your application and documents
    2. You will receive an email notification once your application is reviewed
    3. The review process typically takes 1-2 business days
    
    If you have any questions, please contact us at ${EMAIL_CONFIG.hrEmail}.
    
    Best regards,
    HR Department
    InstaCrp
  `;

  return await sendEmail({ to: email, subject, htmlContent, textContent });
};

/**
 * 2. Registration Approved Email
 */
export const sendApprovalEmail = async (employeeData) => {
  const { email, first_name, last_name, employee_id, joining_date, department, position } = employeeData;

  const subject = '🎉 Registration Approved - Welcome to InstaCrp!';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        .status-badge { display: inline-block; padding: 8px 16px; background: #d1fae5; color: #065f46; border-radius: 20px; font-weight: bold; font-size: 14px; }
        .welcome-banner { background: #ecfdf5; border: 2px solid #10b981; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎊 Congratulations!</h1>
          <p style="margin: 0; font-size: 18px;">Your Registration Has Been Approved</p>
        </div>
        <div class="content">
          <div class="welcome-banner">
            <h2 style="color: #10b981; margin: 0;">Welcome to InstaCrp Family! 🎉</h2>
          </div>

          <p>Dear <strong>${first_name} ${last_name}</strong>,</p>
          
          <p>We are delighted to inform you that your registration has been <strong>approved</strong>! Welcome aboard to InstaCrp.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #10b981;">👤 Your Employee Details</h3>
            <p><strong>Employee ID:</strong> ${employee_id}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Department:</strong> ${department}</p>
            <p><strong>Position:</strong> ${position}</p>
            <p><strong>Joining Date:</strong> ${new Date(joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Status:</strong> <span class="status-badge">✅ Approved</span></p>
          </div>

          <h3>📋 Next Steps</h3>
          <ol>
            <li><strong>Save your Employee ID:</strong> ${employee_id} - You'll need this for future reference</li>
            <li><strong>Check your joining date:</strong> ${new Date(joining_date).toLocaleDateString()}</li>
            <li><strong>Prepare required documents:</strong> Original copies of submitted documents</li>
            <li><strong>Orientation details:</strong> You will receive a separate email with onboarding information</li>
          </ol>

          <div style="background: #fef3c7; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ Important:</strong> Please arrive on your joining date with all original documents. Contact HR if you need to reschedule.</p>
          </div>

          <p>We're excited to have you as part of our team! If you have any questions before your joining date, feel free to reach out to us.</p>

          <p>Looking forward to working with you!</p>

          <p>Best regards,<br>
          <strong>HR Department</strong><br>
          InstaCrp</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} InstaCrp. All rights reserved.</p>
          <p>Questions? Contact HR: ${EMAIL_CONFIG.hrEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Congratulations! Your Registration Has Been Approved
    
    Dear ${first_name} ${last_name},
    
    We are delighted to inform you that your registration has been approved! Welcome aboard to InstaCrp.
    
    Your Employee Details:
    - Employee ID: ${employee_id}
    - Email: ${email}
    - Department: ${department}
    - Position: ${position}
    - Joining Date: ${new Date(joining_date).toLocaleDateString()}
    - Status: Approved
    
    Next Steps:
    1. Save your Employee ID: ${employee_id}
    2. Check your joining date: ${new Date(joining_date).toLocaleDateString()}
    3. Prepare required documents (original copies)
    4. Wait for onboarding information email
    
    We're excited to have you as part of our team!
    
    Best regards,
    HR Department
    InstaCrp
    
    Contact: ${EMAIL_CONFIG.hrEmail}
  `;

  return await sendEmail({ to: email, subject, htmlContent, textContent });
};

/**
 * 3. Registration Rejected Email
 */
export const sendRejectionEmail = async (employeeData, rejectionData) => {
  const { email, first_name, last_name } = employeeData;
  const { reason, comments } = rejectionData;

  const subject = '❌ Registration Update - Application Not Approved';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #ef4444; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        .status-badge { display: inline-block; padding: 8px 16px; background: #fee2e2; color: #991b1b; border-radius: 20px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Status Update</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${first_name} ${last_name}</strong>,</p>
          
          <p>Thank you for your interest in joining InstaCrp. After careful review of your application, we regret to inform you that we are unable to approve your registration at this time.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #ef4444;">📋 Rejection Details</h3>
            <p><strong>Status:</strong> <span class="status-badge">❌ Not Approved</span></p>
            <p><strong>Reason:</strong> ${reason}</p>
            ${comments ? `<p><strong>Additional Information:</strong><br>${comments}</p>` : ''}
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <h3>📌 What Can You Do?</h3>
          <ul>
            <li>Review the rejection reason carefully</li>
            <li>Address the issues mentioned if you plan to reapply</li>
            <li>Contact our HR department for clarification if needed</li>
            <li>You may resubmit your application after addressing the concerns</li>
          </ul>

          <div style="background: #dbeafe; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Need Help?</strong> If you have questions about this decision or need guidance for reapplication, please contact our HR team at <a href="mailto:${EMAIL_CONFIG.hrEmail}">${EMAIL_CONFIG.hrEmail}</a></p>
          </div>

          <p>We appreciate your interest in InstaCrp and wish you the best in your future endeavors.</p>

          <p>Best regards,<br>
          <strong>HR Department</strong><br>
          InstaCrp</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} InstaCrp. All rights reserved.</p>
          <p>Contact us: ${EMAIL_CONFIG.hrEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Registration Status Update
    
    Dear ${first_name} ${last_name},
    
    Thank you for your interest in joining InstaCrp. After careful review of your application, we regret to inform you that we are unable to approve your registration at this time.
    
    Rejection Details:
    - Status: Not Approved
    - Reason: ${reason}
    ${comments ? `- Additional Information: ${comments}` : ''}
    - Date: ${new Date().toLocaleDateString()}
    
    What Can You Do?
    - Review the rejection reason carefully
    - Address the issues mentioned if you plan to reapply
    - Contact our HR department for clarification if needed
    - You may resubmit your application after addressing the concerns
    
    For questions, please contact: ${EMAIL_CONFIG.hrEmail}
    
    Best regards,
    HR Department
    InstaCrp
  `;

  return await sendEmail({ to: email, subject, htmlContent, textContent });
};

/**
 * 4. Welcome Email (Manual Addition by Admin)
 */
export const sendWelcomeEmail = async (employeeData) => {
  const { email, first_name, last_name, employee_id, department, position, joining_date } = employeeData;

  const subject = '🎉 Welcome to InstaCrp - Account Created!';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #8b5cf6; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        .welcome-banner { background: #f5f3ff; border: 2px solid #8b5cf6; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎊 Welcome to InstaCrp!</h1>
          <p style="margin: 0; font-size: 18px;">Your Account Has Been Created</p>
        </div>
        <div class="content">
          <div class="welcome-banner">
            <h2 style="color: #8b5cf6; margin: 0;">Welcome to Our Team! 🎉</h2>
          </div>

          <p>Dear <strong>${first_name} ${last_name}</strong>,</p>
          
          <p>We are excited to welcome you to the InstaCrp family! Your employee account has been successfully created by our HR team.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #8b5cf6;">👤 Your Account Details</h3>
            <p><strong>Employee ID:</strong> ${employee_id}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Department:</strong> ${department}</p>
            <p><strong>Position:</strong> ${position}</p>
            <p><strong>Joining Date:</strong> ${new Date(joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <h3>📋 Important Information</h3>
          <ul>
            <li><strong>Employee ID:</strong> ${employee_id} - Please save this for future reference</li>
            <li><strong>First Day:</strong> ${new Date(joining_date).toLocaleDateString()}</li>
            <li><strong>Onboarding:</strong> You will receive detailed onboarding information separately</li>
            <li><strong>Documents:</strong> Bring all required documents on your first day</li>
          </ul>

          <div style="background: #fef3c7; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0;"><strong>📧 Next Steps:</strong> Watch for additional emails from HR with onboarding schedules, required documents list, and first-day instructions.</p>
          </div>

          <p>We're thrilled to have you join our team! If you have any questions, please don't hesitate to reach out to our HR department.</p>

          <p>Looking forward to working with you!</p>

          <p>Best regards,<br>
          <strong>HR Department</strong><br>
          InstaCrp</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} InstaCrp. All rights reserved.</p>
          <p>Questions? Contact HR: ${EMAIL_CONFIG.hrEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Welcome to InstaCrp - Account Created!
    
    Dear ${first_name} ${last_name},
    
    We are excited to welcome you to the InstaCrp family! Your employee account has been successfully created.
    
    Your Account Details:
    - Employee ID: ${employee_id}
    - Email: ${email}
    - Department: ${department}
    - Position: ${position}
    - Joining Date: ${new Date(joining_date).toLocaleDateString()}
    
    Important Information:
    - Save your Employee ID: ${employee_id}
    - First Day: ${new Date(joining_date).toLocaleDateString()}
    - Watch for onboarding information emails
    - Bring all required documents on your first day
    
    We're thrilled to have you join our team!
    
    Best regards,
    HR Department
    InstaCrp
    
    Contact: ${EMAIL_CONFIG.hrEmail}
  `;

  return await sendEmail({ to: email, subject, htmlContent, textContent });
};

export default {
  sendRegistrationConfirmationEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendWelcomeEmail
};