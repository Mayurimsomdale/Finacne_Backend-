// test-mailjet-connection.js
// Simple script to test Mailjet API connection

import Mailjet from 'node-mailjet';

console.log('🧪 Testing Mailjet Connection...\n');

const mailjet = new Mailjet({
  apiKey: '3b8512eb2b73b35feac0f52c367c10e5',
  apiSecret: '3a2c1fdd8ef8410c29c3290623dd19ad'
});

const testConnection = async () => {
  try {
    console.log('📡 Attempting to send test email...');
    console.log('From: info@instagrp.com');
    console.log('To: YOUR_EMAIL_HERE@gmail.com'); // ⚠️ CHANGE THIS!
    console.log('');

    const result = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: 'info@instagrp.com',
              Name: 'InstaCrp Test'
            },
            To: [
              {
                Email: 'YOUR_EMAIL_HERE@gmail.com', // ⚠️ CHANGE THIS TO YOUR EMAIL!
                Name: 'Test User'
              }
            ],
            Subject: '✅ Mailjet Connection Test - Success!',
            TextPart: 'If you are reading this, Mailjet is working correctly!',
            HTMLPart: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #10b981;">✅ Success!</h1>
                <p>Your Mailjet connection is working correctly.</p>
                <p>You can now use the employee registration email system.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                  This is a test email from your Employee Management System.
                </p>
              </div>
            `
          }
        ]
      });

    console.log('✅ SUCCESS! Email sent successfully!');
    console.log('');
    console.log('📧 Message Details:');
    console.log('  Status:', result.body.Messages[0].Status);
    console.log('  Message ID:', result.body.Messages[0].To[0].MessageID);
    console.log('');
    console.log('📬 Check your inbox (and spam folder)!');
    console.log('');
    console.log('✅ Your Mailjet is configured correctly.');
    console.log('   You can now use the employee registration system.');

  } catch (error) {
    console.error('❌ FAILED! Could not send email.\n');
    
    if (error.statusCode === 401) {
      console.error('🔐 Error: Invalid API Credentials');
      console.error('   → Check your MJ_JOB_PUBLIC and MJ_JOB_PRIVATE in .env');
      console.error('   → Get keys from: https://app.mailjet.com/account/api_keys');
    } else if (error.statusCode === 403) {
      console.error('📧 Error: Sender Email Not Verified');
      console.error('   → You need to verify "info@instagrp.com" in Mailjet');
      console.error('   → Go to: https://app.mailjet.com/account/sender');
      console.error('   → Or change EMAIL_USER in .env to a verified email');
    } else if (error.statusCode === 429) {
      console.error('⚠️  Error: Rate Limit Exceeded');
      console.error('   → Free tier: 200 emails/day');
      console.error('   → Wait or upgrade your plan');
    } else {
      console.error('❌ Error:', error.statusCode, error.message);
      if (error.response?.body) {
        console.error('   Response:', JSON.stringify(error.response.body, null, 2));
      }
    }
    
    console.error('\n📚 See EMAIL_T ROUBLESHOOTING.md for detailed help');
  }
};

testConnection();