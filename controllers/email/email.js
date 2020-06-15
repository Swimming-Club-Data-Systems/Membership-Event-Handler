/**
 * Class to interface 
 */

const htmlToText = require('html-to-text');
const sgMail = require('@sendgrid/mail');
const time = require('moment-timezone');


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
    this.textContent = htmlToText.fromString(content);
  }

  getHtml() {

    let footer = '<address>'
    footer += this.org.getName() + '<br>';
    address.forEach(line => {
      footer += line + '<br>';
    });
    footer += '</address>';

    footer += '<p>Sent automatically by the by ' + this.org.getName() + ' Membership System. Built by SCDS, Licensed to ' + this.org.getName() + '.</p>';

    footer += '<p>Have questions? Contact us at ' + this.org.getKey('CLUB_EMAIL') + '.</p>';

    if (false) {
      footer += '<p>Unsubscribe at UNSUB_LINK.</p>';
    }

    footer += '<p>Content copyright ' + time.tz('Europe/London').format('Y') + ', Design copyright ' + time.tz('Europe/London').format('Y') + ' SCDS.</p>';

    return this.htmlContent + footer;
  }

  getText() {
    let address = [];
    if (this.org.getKey('CLUB_ADDRESS')) {
      try {
        let address = JSON.parse(this.org.getKey('CLUB_ADDRESS'))
      } catch (err) {}
    }

    let footer = '\r\n\r\n' + this.org.getName() + '\r\n';
    address.forEach(line => {
      footer += line + '\r\n';
    });
    footer += '\r\n';
    footer += 'Sent automatically by the by ' + this.org.getName() + ' Membership System. Built by SCDS, Licensed to ' + this.org.getName() + '.\r\n\r\n';

    footer += 'Have questions? Contact us at ' + this.org.getKey('CLUB_EMAIL') + '.\r\n\r\n';

    if (false) {
      footer += 'Unsubscribe at UNSUB_LINK.\r\n\r\n';
    }

    footer += 'Content copyright ' + time.tz('Europe/London').format('Y') + ', Design copyright ' + time.tz('Europe/London').format('Y') + ' SCDS.';

    return this.textContent + footer;
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