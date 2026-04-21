const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { getOAuthClient } = require('./auth');
const db = require('../db');

const HST_RATE = 0.13;
const router = express.Router();

// A lesson is billed hourly when pricing_type is "hourly". Fall back to the
// legacy `billing_type === "hourly"` for data saved before the lesson_type /
// pricing_type split.
function isHourlyLesson(lesson) {
  if (lesson?.pricing_type) return lesson.pricing_type === 'hourly';
  return !lesson?.billing_type || lesson.billing_type === 'hourly';
}

// Per-skater lesson amount — shared by subtotal calc and PDF builder.
// Lessons may carry skater_ids[] (new) or num_students (legacy).
function perSkaterLessonAmount(lesson) {
  const skaterCount = Math.max(1, (lesson.skater_ids || []).length || Number(lesson.num_students) || 1);
  if (isHourlyLesson(lesson)) {
    const duration_mins = lesson.duration_mins || Math.round((lesson.duration_hours || 1) * 60);
    return (duration_mins / 60) * (Number(lesson.rate_per_hour || 0) / skaterCount);
  }
  return Number(lesson.flat_amount || 0) / skaterCount;
}

function computeInvoiceTotals(lessons, { tax_rate = 0, custom_charges = [], balance = 0 } = {}) {
  const subtotal = lessons.reduce((s, l) => s + perSkaterLessonAmount(l), 0);
  const customTotal = (custom_charges || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  const tax_amount = Number(tax_rate) ? (subtotal + customTotal) * (Number(tax_rate) / 100) : 0;
  const total = subtotal + customTotal + tax_amount + Number(balance || 0);
  return { subtotal, tax_amount, total, customTotal };
}

function buildPeriodLabel(month) {
  if (!month) return '';
  const [year, mon] = month.split('-');
  return new Date(year, Number(mon) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function buildInvoicePDF(student, lessons, periodLabel, { apply_hst, balance, custom_charges } = {}, profile = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // `periodLabel` may already be a human-readable string (e.g. from invoice.period_label)
    // or a "YYYY-MM" key — normalize to a human-readable label either way.
    const monthLabel = /^\d{4}-\d{2}$/.test(periodLabel)
      ? (() => { const [y, m] = periodLabel.split('-'); return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }); })()
      : periodLabel;

    // Coach header (left) + Invoice label (right)
    const topY = doc.y;
    if (profile.name) {
      doc.fontSize(14).font('Helvetica-Bold').text(profile.name, 50, topY);
      doc.fontSize(10).font('Helvetica');
      if (profile.address) doc.text(profile.address);
      if (profile.phone) doc.text(`Phone: ${profile.phone}`);
      if (profile.email) doc.text(profile.email);
      if (profile.website) doc.text(profile.website);
      if (profile.tax_number) doc.text(`Tax/Business #: ${profile.tax_number}`);
    }
    doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', 400, topY, { width: 145, align: 'right' });
    doc.moveDown(1.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('#000000');
    doc.moveDown(0.6);

    // Billed to + period
    doc.fontSize(10).font('Helvetica-Bold').text('BILLED TO', 50, doc.y);
    doc.fontSize(11).font('Helvetica').text(student.billing_name || student.name);
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
      const isHourly = isHourlyLesson(lesson);
      const skaterCount = Math.max(1, (lesson.skater_ids || []).length || Number(lesson.num_students) || 1);
      const LABELS = {
        private: 'Private',
        semi_private: 'Semi Private',
        competition: 'Competition',
        choreography: 'Choreography',
        off_ice_training: 'Off-Ice Training',
        expenses: 'Expenses',
      };
      let amount, typeLabel, durationLabel, rateLabel;
      if (isHourly) {
        const perSkaterRate = Number(lesson.rate_per_hour || 0) / skaterCount;
        const duration_mins = lesson.duration_mins || Math.round((lesson.duration_hours || 1) * 60);
        amount = (duration_mins / 60) * perSkaterRate;
        typeLabel = LABELS[lesson.billing_type] || lesson.billing_type || 'Lesson';
        durationLabel = duration_mins < 60 ? `${duration_mins} min` : duration_mins % 60 === 0 ? `${duration_mins / 60}h` : `${Math.floor(duration_mins / 60)}h ${duration_mins % 60}min`;
        rateLabel = `$${perSkaterRate.toFixed(2)}`;
      } else {
        amount = Number(lesson.flat_amount || 0) / skaterCount;
        typeLabel = LABELS[lesson.billing_type] || lesson.billing_type || 'Charge';
        durationLabel = '—';
        rateLabel = '—';
      }
      subtotal += amount;
      const y = doc.y;
      doc.text(lesson.date, col.date, y);
      doc.text(typeLabel, col.type, y);
      doc.text(durationLabel, col.duration, y);
      doc.text(rateLabel, col.rate, y);
      doc.text(`$${amount.toFixed(2)}`, col.amount, y);
      doc.moveDown(0.6);
      if (lesson.notes) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6b7280')
          .text(lesson.notes, col.type, doc.y, { width: 380 });
        doc.fillColor('#000000').font('Helvetica').fontSize(11);
        doc.moveDown(0.4);
      }
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

    // Payment instructions block (matches base44)
    if (profile.payment_instructions_etransfer || profile.accepts_cheque_cash) {
      doc.moveDown(1.2);
      doc.x = 50;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Payment Instructions');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#555555').text('We accept the following payment methods:');
      doc.moveDown(0.3);
      doc.fillColor('#000000').fontSize(10);
      if (profile.payment_instructions_etransfer) {
        doc.text(`E-Transfer: ${profile.payment_instructions_etransfer}`);
      }
      if (profile.accepts_cheque_cash) {
        doc.text('Cheque & Cash: Accepted');
      }
    }

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

  const scheduledLessons = req.query.scheduled_lessons ? JSON.parse(req.query.scheduled_lessons) : [];
  const dbLessons = await db.getLessons(req.session.user.email, { student_id, month });
  const lessons = [...scheduledLessons, ...dbLessons].sort((a, b) => a.date.localeCompare(b.date));
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

// Resolve send params either from a stored invoice_id or legacy {student_id, month, ...}.
async function resolveSendParams(owner, body) {
  if (body.invoice_id != null) {
    const invoice = await db.getInvoice(body.invoice_id, owner);
    if (!invoice) return { error: { status: 404, message: 'Invoice not found' } };
    return {
      invoice,
      student_id: invoice.student_id,
      month: invoice.month,
      options: {
        apply_hst: Boolean(invoice.apply_hst),
        balance: Number(invoice.balance || 0),
        custom_charges: invoice.custom_charges || [],
      },
      scheduled_lessons: [],
    };
  }
  return {
    invoice: null,
    student_id: body.student_id,
    month: body.month,
    options: {
      apply_hst: Boolean(body.apply_hst),
      balance: Number(body.balance || 0),
      custom_charges: body.custom_charges || [],
    },
    scheduled_lessons: body.scheduled_lessons || [],
  };
}

router.post('/send', async (req, res) => {
  try {
    const owner = req.session.user.email;
    const resolved = await resolveSendParams(owner, req.body);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });
    const { invoice, student_id, month, options, scheduled_lessons } = resolved;

    const student = await db.getStudent(student_id, owner);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const dbLessons = await db.getLessons(owner, { student_id, ...lessonsQueryForPeriodKey(month) });
    const lessons = [...scheduled_lessons, ...dbLessons].sort((a, b) => a.date.localeCompare(b.date));
    if (lessons.length === 0) return res.status(400).json({ error: 'No lessons found for this period' });

    const profile = await db.getProfile(owner) || {};
    const monthLabel = invoice?.period_label || buildPeriodLabel(month);
    const pdfBuffer = await buildInvoicePDF(student, lessons, monthLabel, options, profile);

    let total;
    if (invoice) {
      total = Number(invoice.total || 0);
    } else {
      const { total: computedTotal } = computeInvoiceTotals(lessons, {
        tax_rate: options.apply_hst ? HST_RATE * 100 : 0,
        custom_charges: options.custom_charges,
        balance: options.balance,
      });
      total = computedTotal;
    }

    const DEFAULT_TEMPLATE = 'Hi {name},\n\nPlease find attached your invoice for {month}.\n\nTotal Amount Due: ${total}\n\nThank you!';
    const template = profile.email_template || DEFAULT_TEMPLATE;
    const emailBody = template
      .replace(/{name}/g, student.name)
      .replace(/{month}/g, monthLabel)
      .replace(/{total}/g, total.toFixed(2));

    const recipients = (student.billing_emails && student.billing_emails.length
      ? student.billing_emails
      : [student.email]
    ).filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No billing emails on file for this student' });
    }

    await sendViaGmailAPI(
      req.session.tokens,
      owner,
      recipients.join(', '),
      `Invoice for ${monthLabel}`,
      emailBody,
      pdfBuffer,
      `invoice-${student.name}-${month}.pdf`
    );

    let updatedInvoice = null;
    if (invoice) {
      const now = new Date().toISOString();
      updatedInvoice = await db.updateInvoice(invoice.id, owner, { sent_at: now, recalculated_at: now });
    }

    await db.addInvoiceRecord(owner, {
      student_id: Number(student_id),
      student_name: student.name,
      month,
      total,
      sent_to: recipients.join(', '),
      invoice_id: invoice ? invoice.id : null,
    });

    res.json({ success: true, invoice: updatedInvoice });
  } catch (err) {
    console.error('Invoice send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stored-invoice CRUD. These come AFTER the literal /history, /preview, /send
// routes to avoid `/:id` swallowing those paths.

// List invoices
router.get('/', async (req, res) => {
  try {
    const { student_id, month, status } = req.query;
    const list = await db.getInvoices(req.session.user.email, { student_id, month, status });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create invoice (draft pending)
// Given a body with one of three period shapes, return
// { periodKey, periodLabel, lessonsQuery } where lessonsQuery is passed to db.getLessons.
//   single: { month: "YYYY-MM" }
//   multi-month: { month_from: "YYYY-MM", month_to: "YYYY-MM" }
//   custom: { date_from: "YYYY-MM-DD", date_to: "YYYY-MM-DD" }
// Parse a stored period key back into a lesson filter (for drift recompute + send).
function lessonsQueryForPeriodKey(key) {
  if (!key) return {};
  if (/^\d{4}-\d{2}$/.test(key)) return { month: key };
  const parts = key.split('_');
  if (parts.length === 2) {
    const [a, b] = parts;
    if (/^\d{4}-\d{2}$/.test(a) && /^\d{4}-\d{2}$/.test(b)) {
      const [ty, tm] = b.split('-').map(Number);
      const endOfMonth = new Date(ty, tm, 0).toISOString().slice(0, 10);
      return { date_from: `${a}-01`, date_to: endOfMonth };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
      return { date_from: a, date_to: b };
    }
  }
  return { month: key };
}

function resolvePeriod(body) {
  if (body.date_from && body.date_to) {
    const key = `${body.date_from}_${body.date_to}`;
    const label = `${body.date_from} – ${body.date_to}`;
    return { periodKey: key, periodLabel: label, lessonsQuery: { date_from: body.date_from, date_to: body.date_to } };
  }
  if (body.month_from && body.month_to) {
    const key = `${body.month_from}_${body.month_to}`;
    const label = `${buildPeriodLabel(body.month_from)} – ${buildPeriodLabel(body.month_to)}`;
    const df = `${body.month_from}-01`;
    const [ty, tm] = body.month_to.split('-').map(Number);
    const endOfMonth = new Date(ty, tm, 0).toISOString().slice(0, 10);
    return { periodKey: key, periodLabel: label, lessonsQuery: { date_from: df, date_to: endOfMonth } };
  }
  if (body.month) {
    return { periodKey: body.month, periodLabel: buildPeriodLabel(body.month), lessonsQuery: { month: body.month } };
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const owner = req.session.user.email;
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });

    const period = resolvePeriod(req.body);
    if (!period) return res.status(400).json({ error: 'Provide month, month_from+month_to, or date_from+date_to' });

    const student = await db.getStudent(student_id, owner);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const tax_rate = Number(req.body.tax_rate || 0);
    const custom_charges = req.body.custom_charges || [];
    const balance = Number(req.body.balance || 0);
    const apply_hst = Boolean(req.body.apply_hst);
    const invoice_date = req.body.invoice_date || new Date().toISOString().slice(0, 10);

    const lessons = await db.getLessons(owner, { student_id, ...period.lessonsQuery });
    const { subtotal, tax_amount, total } = computeInvoiceTotals(lessons, { tax_rate, custom_charges, balance });

    const now = new Date().toISOString();
    const invoice = await db.addInvoice(owner, {
      student_id: Number(student_id),
      month: period.periodKey,
      invoice_date,
      period_label: period.periodLabel,
      tax_rate,
      subtotal,
      tax_amount,
      total,
      custom_charges,
      balance,
      apply_hst,
      status: 'pending',
      sent_at: null,
      recalculated_at: now,
    });
    res.json(invoice);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get invoice + drift flag (drift = stored totals vs current-lesson recompute)
router.get('/:id', async (req, res) => {
  try {
    const owner = req.session.user.email;
    const invoice = await db.getInvoice(req.params.id, owner);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const lessons = await db.getLessons(owner, { student_id: invoice.student_id, ...lessonsQueryForPeriodKey(invoice.month) });
    const { subtotal: recomputed_subtotal, total: recomputed_total } = computeInvoiceTotals(lessons, {
      tax_rate: invoice.tax_rate,
      custom_charges: invoice.custom_charges,
      balance: invoice.balance,
    });
    const TOL = 0.001;
    const drift = Math.abs(recomputed_subtotal - Number(invoice.subtotal || 0)) > TOL
      || Math.abs(recomputed_total - Number(invoice.total || 0)) > TOL;
    res.json({ ...invoice, drift, recomputed_subtotal, recomputed_total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Partial update — recompute when totals-affecting fields change
router.put('/:id', async (req, res) => {
  try {
    const owner = req.session.user.email;
    const existing = await db.getInvoice(req.params.id, owner);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const updates = { ...req.body };
    const totalsKeys = ['tax_rate', 'custom_charges', 'balance', 'apply_hst'];
    const affectsTotals = totalsKeys.some((k) => Object.prototype.hasOwnProperty.call(updates, k));

    if (affectsTotals) {
      const merged = { ...existing, ...updates };
      const lessons = await db.getLessons(owner, { student_id: merged.student_id, month: merged.month });
      const { subtotal, tax_amount, total } = computeInvoiceTotals(lessons, {
        tax_rate: Number(merged.tax_rate || 0),
        custom_charges: merged.custom_charges || [],
        balance: Number(merged.balance || 0),
      });
      updates.subtotal = subtotal;
      updates.tax_amount = tax_amount;
      updates.total = total;
      updates.recalculated_at = new Date().toISOString();
    }

    const saved = await db.updateInvoice(req.params.id, owner, updates);
    res.json(saved);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const ok = await db.deleteInvoice(req.params.id, req.session.user.email);
    if (!ok) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
