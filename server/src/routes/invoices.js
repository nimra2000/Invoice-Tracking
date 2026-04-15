const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { getOAuthClient } = require('./auth');
const db = require('../db');

const HST_RATE = 0.13;
const router = express.Router();

function buildInvoicePDF(student, lessons, month, { apply_hst, balance, custom_charges } = {}, profile = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const [year, mon] = month.split('-');
    const monthLabel = new Date(year, mon - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Coach header (left) + Invoice label (right)
    const topY = doc.y;
    if (profile.name) {
      doc.fontSize(14).font('Helvetica-Bold').text(profile.name, 50, topY);
      doc.fontSize(10).font('Helvetica');
      if (profile.address) doc.text(profile.address);
      if (profile.phone) doc.text(`Phone: ${profile.phone}`);
      if (profile.email) doc.text(profile.email);
    }
    doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', 400, topY, { width: 145, align: 'right' });
    doc.moveDown(1.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.6);

    // Billed to + period
    doc.fontSize(10).font('Helvetica-Bold').text('BILLED TO', 50, doc.y);
    doc.fontSize(11).font('Helvetica').text(student.name);
    doc.text(student.email);
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold').text('PERIOD');
    doc.fontSize(11).font('Helvetica').text(monthLabel);
    doc.moveDown(1);

    // Table header
    const col = { date: 50, type: 150, duration: 270, rate: 370, amount: 460 };
    doc.font('Helvetica-Bold').fontSize(11);
    const headerY = doc.y;
    doc.text('Date', col.date, headerY);
    doc.text('Type', col.type, headerY);
    doc.text('Duration', col.duration, headerY);
    doc.text('Rate/hr', col.rate, headerY);
    doc.text('Amount', col.amount, headerY);
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.4);

    // Lesson rows
    doc.font('Helvetica').fontSize(11);
    let subtotal = 0;
    for (const lesson of lessons) {
      const numStudents = lesson.num_students || 1;
      const perStudentRate = lesson.rate_per_hour / numStudents;
      const duration_mins = lesson.duration_mins || Math.round((lesson.duration_hours || 1) * 60);
      const amount = (duration_mins / 60) * perStudentRate;
      subtotal += amount;
      const y = doc.y;
      const typeLabel = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' }[lesson.type] || lesson.type;
      const durationLabel = duration_mins < 60 ? `${duration_mins} min` : duration_mins % 60 === 0 ? `${duration_mins / 60}h` : `${Math.floor(duration_mins / 60)}h ${duration_mins % 60}min`;
      doc.text(lesson.date, col.date, y);
      doc.text(typeLabel, col.type, y);
      doc.text(durationLabel, col.duration, y);
      doc.text(`$${perStudentRate.toFixed(2)}`, col.rate, y);
      doc.text(`$${amount.toFixed(2)}`, col.amount, y);
      doc.moveDown(0.6);
    }

    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Summary rows
    const summaryRight = 460;
    const summaryLabel = 380;

    const summaryRow = (label, value, bold = false) => {
      const y = doc.y;
      const formatted = value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`;
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fontSize(11).text(label, summaryLabel, y);
      doc.text(formatted, summaryRight, y, { width: 90, align: 'right' });
      doc.moveDown(0.5);
    };

    const customTotal = (custom_charges || []).reduce((s, c) => s + Number(c.amount || 0), 0);
    const hstAmount = apply_hst ? (subtotal + customTotal) * HST_RATE : 0;
    const balanceNum = Number(balance || 0);
    const total = subtotal + customTotal + hstAmount + balanceNum;

    summaryRow('Subtotal', subtotal);

    for (const charge of (custom_charges || [])) {
      if (charge.description && charge.amount) {
        summaryRow(charge.description, Number(charge.amount));
      }
    }

    if (apply_hst) summaryRow('HST (13%)', hstAmount);
    if (balanceNum !== 0) summaryRow(balanceNum > 0 ? 'Previous Balance (owing)' : 'Previous Balance (credit)', balanceNum);

    doc.moveTo(summaryLabel, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    summaryRow('Total Amount Due', total, true);

    doc.end();
  });
}

// Build a raw MIME message using nodemailer, then send via Gmail API
async function sendViaGmailAPI(tokens, fromEmail, toEmail, subject, text, pdfBuffer, pdfFilename) {
  const transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
  const info = await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject,
    text,
    attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }],
  });
  const raw = info.message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

function parseInvoiceOptions(query) {
  return {
    apply_hst: query.apply_hst === 'true',
    balance: Number(query.balance || 0),
    custom_charges: query.custom_charges ? JSON.parse(query.custom_charges) : [],
  };
}

router.get('/history', async (req, res) => {
  try {
    const { student_id } = req.query;
    res.json(await db.getInvoiceRecords(req.session.user.email, student_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/preview', async (req, res) => {
  const { student_id, month } = req.query;
  const student = await db.getStudent(student_id, req.session.user.email);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const lessons = (await db.getLessons(req.session.user.email, { student_id, month })).sort((a, b) => a.date.localeCompare(b.date));
  if (lessons.length === 0) return res.status(400).json({ error: 'No lessons found for this period' });

  const options = parseInvoiceOptions(req.query);
  const profile = await db.getProfile(req.session.user.email) || {};
  const pdfBuffer = await buildInvoicePDF(student, lessons, month, options, profile);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="invoice-${student.name}-${month}.pdf"`,
  });
  res.send(pdfBuffer);
});

router.post('/send', async (req, res) => {
  try {
    const { student_id, month, apply_hst, balance, custom_charges } = req.body;
    const options = { apply_hst, balance: Number(balance || 0), custom_charges: custom_charges || [] };

    const student = await db.getStudent(student_id, req.session.user.email);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const lessons = (await db.getLessons(req.session.user.email, { student_id, month })).sort((a, b) => a.date.localeCompare(b.date));
    if (lessons.length === 0) return res.status(400).json({ error: 'No lessons found for this period' });

    const profile = await db.getProfile(req.session.user.email) || {};
    const pdfBuffer = await buildInvoicePDF(student, lessons, month, options, profile);

    const [year, mon] = month.split('-');
    const monthLabel = new Date(year, mon - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const subtotal = lessons.reduce((sum, l) => {
      const duration_mins = l.duration_mins || Math.round((l.duration_hours || 1) * 60);
      return sum + (duration_mins / 60) * (l.rate_per_hour / (l.num_students || 1));
    }, 0);
    const customTotal = options.custom_charges.reduce((s, c) => s + Number(c.amount || 0), 0);
    const hstAmount = apply_hst ? (subtotal + customTotal) * HST_RATE : 0;
    const total = subtotal + customTotal + hstAmount + options.balance;

    const DEFAULT_TEMPLATE = 'Hi {name},\n\nPlease find attached your invoice for {month}.\n\nTotal Amount Due: ${total}\n\nThank you!';
    const template = profile.email_template || DEFAULT_TEMPLATE;
    const emailBody = template
      .replace(/{name}/g, student.name)
      .replace(/{month}/g, monthLabel)
      .replace(/{total}/g, total.toFixed(2));

    await sendViaGmailAPI(
      req.session.tokens,
      req.session.user.email,
      student.email,
      `Invoice for ${monthLabel}`,
      emailBody,
      pdfBuffer,
      `invoice-${student.name}-${month}.pdf`
    );

    await db.addInvoiceRecord(req.session.user.email, {
      student_id: Number(student_id),
      student_name: student.name,
      month,
      total,
      sent_to: student.email,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Invoice send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
