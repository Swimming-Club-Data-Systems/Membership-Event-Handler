/**
 * Class to interface 
 */

const htmlToText = require('html-to-text');
const time = require('moment-timezone');
const escape = require('escape-html');
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { createMimeMessage, Mailbox } = require('mimetext');
const ses = new SESv2Client({ region: "eu-west-2" });
const s3 = new S3Client({ region: "eu-west-2" });
const { Buffer } = require('buffer');

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
      this.replyEmail = org.getEmail();
    } else {
      this.senderName = 'SCDS';
      this.senderEmail = 'noreply@myswimmingclub.uk';
      this.replyEmail = 'support@myswimmingclub.uk';
    }
    this.subject = subject;
    this.htmlContent = content;
    this.textContent = htmlToText.fromString(content);
  }

  getHtml() {

    let fontStack = '"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
    if (this.org.isCLS()) {
      fontStack = '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
    }

    let head = `
    <!DOCTYPE html>
    <html lang="en-gb">
    <head>
      <meta charset="utf-8">`;
    if (this.org.isCLS()) {
      head += `<link href="https://fonts.googleapis.com/css?family=Open+Sans:400,700" rel="stylesheet" type="text/css">`;
    } else {
      head += `<link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:400,700" rel="stylesheet" type="text/css">`;
    }
    head += `
      <style type="text/css">
        html, body {
          font-family: ${fontStack};
          font-size: 16px;
          background: #e3eef6;
        }
        p, h1, h2, h3, h4, h5, h6, ul, ol, img, .table, blockquote {
          margin: 0 0 16px 0;
          font-family:  ${fontStack};
        }
        .small {
          font-size: 11px;
          color: #868e96;
          margin-bottom: 11px;
        }
        .text-center {
          text-align: center;
        }
        .bottom {
          margin: 16px 0 0 0;
        }
        cell {
          display: table;
          background: #eee;
          padding: 1rem;
          margin 0 0 1rem 0;
          width: 100%;
        }
      </style>
    </head>
    <body>
    <div style="background:#e3eef6;">
      <table style="width:100%;border:0px;text-align:left;padding:10px 0px 10px 0px;background:#e3eef6;"><tr><td align="center">
        <table style="width:100%;max-width:700px;border:0px;text-align:center;background:#ffffff;padding:10px 10px 0px 10px;"><tr><td>`;
    if (this.org.isCLS()) {
      head += `<img src="${escape(process.env.PUBLIC_URL + "public/img/notify/NotifyLogo.png")}"
        style="width:300px;max-width:100%;" srcset="${escape(process.env.PUBLIC_URL + "public/img/notify/NotifyLogo@2x.png")} 2x, ${escape(process.env.PUBLIC_URL + "public/img/notify/NotifyLogo@3x.png")} 3x" alt="${escape(this.org.getName())} Logo">`;
    } else if (this.org && this.org.getKey('LOGO_DIR')) {
      let dir = process.env.PUBLIC_URL + this.org.getCodeId() + '/' + this.org.getKey('LOGO_DIR');
      head += `<img src="${escape(dir + "logo-150.png")}"
      style="max-width:100%;max-height:150px;" srcset="${escape(dir + "logo-150@2x.png")} 2x, ${escape(dir + "logo-150@3x.png")} 3x" alt="${escape(this.org.getName())} Logo">`;
      // } else if (isset(app()->tenant) && $logos = app()->tenant->getKey('LOGO_DIR')) {
      //   $head .= "<img src=\"" . autoUrl($logos . 'logo-150.png') . "\" srcset=\"" .
      //   autoUrl($logos . 'logo-150@2x.png') . " 2x, " .
      //   autoUrl($logos . 'logo-150@3x.png') . " 3x\" style=\"max-width:100%;max-height:150px;\" alt=\"" . htmlspecialchars(app()->tenant->getKey('CLUB_NAME')) . " Logo\">";
    } else if (this.org) {
      head += escape(this.org.getName());
    } else {
      head += 'SCDS Membership MT';
    }
    head += `</td></tr></table>
        <table style="width:100%;max-width:700px;border:0px;text-align:left;background:#ffffff;padding:0px 10px;"><tr><td>`;

    let address = [];
    if (this.org.getKey('CLUB_ADDRESS')) {
      try {
        address = JSON.parse(this.org.getKey('CLUB_ADDRESS'))
      } catch (err) { }
    }

    let footer = `</td></tr></table>
    <table style="width:100%;max-width:700px;border:0px;background:#f8fcff;padding:0px 10px;"><tr><td>
    <div class="bottom text-center">
    <address>`;
    footer += this.org.getName() + '<br>';
    address.forEach(line => {
      footer += line + '<br>';
    });
    footer += '</address>';

    footer += '<p>Sent automatically by the by ' + this.org.getName() + ' Membership System. Software used under license.</p>';

    footer += '<p>Have questions? Contact us at ' + this.org.getKey('CLUB_EMAIL') + '.</p>';

    if (false) {
      footer += '<p>Unsubscribe at UNSUB_LINK.</p>';
    }

    footer += '<p>Content copyright ' + time.tz('Europe/London').format('Y') + ' ' + this.org.getName() + ', Design copyright ' + time.tz('Europe/London').format('Y') + ' SCDS.</p>';

    footer += `</div>
    </table>
  </table>
  </div>
  </body>
  </html>`;

    return head + this.htmlContent + footer;
  }

  getText() {
    let address = [];
    if (this.org.getKey('CLUB_ADDRESS')) {
      try {
        address = JSON.parse(this.org.getKey('CLUB_ADDRESS'))
      } catch (err) { }
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

  async send() {
    const msg = createMimeMessage();

    msg.setSender({ name: this.senderName, addr: this.senderEmail });
    msg.setSubject(this.subject);
    msg.setMessage('text/html', this.getHtml());
    msg.setMessage('text/plain', this.getText());
    msg.setTo({ name: this.recipientName, addr: this.recipientEmail });
    msg.setReplyTo({ name: this.senderName, addr: this.replyEmail });

    let raw = Buffer.from(msg.asRaw(), Uint8Array);

    const params = {
      Content: {
        Raw: {
          Data: raw
        }
      }
    }

    const command = new SendEmailCommand(params);
    await ses.send(command);
  }
}

module.exports = Email;