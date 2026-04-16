# Coach App — How-To Guide

Welcome to your lesson tracking and invoicing app! This guide walks you through everything you need to know to manage your students, log lessons, and send invoices.

---

## 1. First Time Setup — My Profile

Before you send your first invoice, fill in your profile. This information appears at the top of every invoice you send.

1. Tap **Profile** in the bottom navigation bar.
2. Fill in your **Full Name**, **Email**, **Address**, and **Phone Number**.
3. Optionally customize the **Invoice Email Message**. You can use three placeholders that are automatically filled in when an invoice is sent:
   - `{name}` — replaced with the student's name
   - `{month}` — replaced with the invoice month
   - `{total}` — replaced with the total amount due
4. Tap **Save Profile**.

---

## 2. Students

### Adding a Student
1. Tap **Students** in the bottom navigation bar.
2. Tap **+ Add** in the top right.
3. Enter the student's **Name** and **Email**.
4. Optionally enter a **Billing Name** — this is the name that will appear on the invoice (useful if a parent pays, e.g. "Jane Smith (parent)"). If left blank, the student's name is used.
5. Tap **Add Student**.

### Finding a Student
Use the **Search** bar at the top of the Students page to filter by name. Students are listed alphabetically.

### Student Profile
Tap any student to open their profile, where you can:
- Edit their name, email, or billing name
- View and manage their **Balance History** (outstanding payments, credits, payments received)
- View their **Invoice History** (past invoices sent and totals)

### Balance Entries
If a student owes money from a previous period or has a credit:
1. Open the student's profile and tap **+ Add Entry**.
2. Enter a date, description (e.g. "Payment received"), and amount.
   - **Positive amount** = student owes you money
   - **Negative amount** = payment or credit
3. Tap **Add Entry**.
4. Once resolved, tap **Settle** to mark it as settled.

---

## 3. Add a Charge

Use this page to log a lesson or any other charge. Tap **Charge** in the bottom navigation bar.

### One-Time Charge
1. Tap **One-time**.
2. Select the **Students** involved (search by name; multiple students can share a lesson).
3. Pick the **Date**.
4. Set the **Start Time** (optional) and **Duration**.
5. Choose the **Charge Type**:
   - **Hourly Rate** — choose lesson type (Private / Semi-Private / Group) and enter your rate. If multiple students share the lesson, the rate is automatically divided equally.
   - **Flat Fee** — a fixed amount per student
   - **Choreography**, **Competition Fee**, **Custom** — flat amounts with an optional label
6. Add an optional **Note** (appears on the invoice).
7. Tap **Save Charge**.

### Recurring Charge
1. Tap **Recurring**.
2. Select the **Students**, **Day of Week**, **Start Date**, and optionally an **End Date**.
3. Fill in the same time, duration, and billing details as above.
4. Tap **Save Charge** — the lesson will automatically appear on the calendar every week on that day.

---

## 4. Calendar

Tap **Calendar** in the bottom navigation bar to see all your scheduled lessons.

### Navigating the Calendar
- Use **Week** and **Day** view buttons (top right) to switch between views.
- Use the **← →** arrows to move between weeks/days.
- Tap **Today** to jump back to the current date.
- Events are **colour-coded** by type — tap **Colour Legend ▾** at the bottom to see what each colour means.

### Editing an Event
1. Tap any event on the calendar to open the edit form.
2. Make your changes (students, time, billing info, notes, etc.).
3. Tap **Save Changes**.
4. For **recurring events**, you will be asked whether to apply the change to:
   - **This occurrence only** — just that one date
   - **This and all future** — from that date onward

### Deleting an Event
1. Tap an event to open the edit form.
2. Tap **Delete this event…** at the bottom.
3. For recurring events, choose to delete just that occurrence or all events in the series.

### Exporting Your Schedule
You can export your calendar at any time as a backup or to share your schedule.

1. Tap the **Export** button in the calendar toolbar.
2. Select a **From** month and a **To** month.
3. Choose your format:
   - **Download PDF Schedule** — a clean, printable list of all your lessons organized by month, including student names, times, durations, lesson types, and notes. Great for printing or saving as a record.
   - **Download .ics (Google / Apple Calendar)** — a standard calendar file that can be imported into Google Calendar, Apple Calendar, Outlook, or any other calendar app.

---

## 5. Invoices

Tap **Invoices** in the bottom navigation bar to generate and send invoices.

### Generating an Invoice
1. **Search for a student** by typing their name.
2. Select the **Month** you want to invoice for.
3. All lessons from that month are automatically pulled in from your calendar.

### Reviewing Line Items
- Each lesson appears as a card showing the date, type, and amount.
- Tap a card to expand it and see full details (time, duration, rate, notes).
- To remove a lesson from this invoice, expand it and tap **Skip from Invoice**. It will appear faded with a "—" amount. Tap **Include in Invoice** to add it back.
- Skipped/included choices are **remembered** — if you close the app and come back, your selections will still be there.

### Adding Custom Charges
Scroll to the **Custom Charges** section to add one-off items not in your calendar (e.g. costume fee, off-ice training). Tap **+ Add**, enter a description and amount, and it will be included in the total.

### HST and Previous Balance
- Toggle **Apply HST (13%)** to add tax to the subtotal.
- If the student has an outstanding balance or credit, a toggle appears to include it in the invoice automatically.

### Sending the Invoice
1. Tap **Preview PDF** to review the invoice before sending.
2. Tap **Send Invoice via Gmail** to email it directly to the student.
3. A confirmation banner will appear once the invoice is sent successfully.

---

## Tips

- **Recurring lessons** you set up under Add a Charge will automatically populate the Calendar and Invoices every week — you don't have to log them manually each time.
- **Notes** added to a lesson (e.g. "Worked on double axel") appear on the invoice so the student can see what was covered.
- Use **Export → Download PDF** at the start of each season as a backup of your full schedule in case anything needs to be recovered.
- The **Billing Name** on a student's profile lets you address invoices to a parent or guardian rather than the student.
