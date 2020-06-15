/**
 * Class to interface 
 */

const htmlToText = require('html-to-text');
const sgMail = require('@sendgrid/mail');


class Email {

  recipientName;
  recipientEmail;
  subject;
  htmlContent;
  textContent;
  org;

  constructor(name, email, org, subject, content) {
    this.recipientName = name;
    this.recipientEmail = email;
    this.org = org;
    if (org != null) {
      this.senderName = org.getName();
      this.senderEmail = org.getSendingEmail();
    } else {
      this.senderName = 'SCDS';
      this.senderEmail = 'noreply@myswimmingclub.uk';
    }    
    this.subject = subject;
    this.htmlContent = content;
    this.textContent = htmlToText.fromString;
  }

  getHtml() {

  }

  getText() {
    let footer = '\r\n\r\n' + org.getName() + '\r\n';
    footer += 'Sent automatically by the by ' + org.getName() + ' Membership System. Built by SCDS, Licensed to ' + org.getName() + '.\r\n\r\n';
  }

  send() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: {
        name: this.recipientName,
        email: this.recipientEmail
      },
      from: {
        name: this.senderName,
        email: this.senderEmail
      },
      subject: this.subject,
      text: this.textContent,
      html: this.htmlContent,
    };

    (async () => {
      try {
        await sgMail.send(msg);
      } catch (error) {
        console.error(error);
    
        if (error.response) {
          console.error(error.response.body)
        }
      }
    })();
  }
}

module.exports = Email;