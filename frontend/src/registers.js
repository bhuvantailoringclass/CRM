// Register definitions: fields drive both the table columns and the entry form.
// field types: text, number, date, textarea, select, student (ref), course (ref)
const sel = (name, label, options, opts = {}) => ({ name, label, type: "select", options, ...opts });
const t = (name, label, opts = {}) => ({ name, label, type: "text", ...opts });
const n = (name, label, opts = {}) => ({ name, label, type: "number", ...opts });
const d = (name, label, opts = {}) => ({ name, label, type: "date", ...opts });

export const REGISTERS = {
  admission: {
    label: "Admission Register", group: "Academics", icon: "GraduationCap",
    subtitle: "Master student record",
    fields: [
      t("student_id", "Student ID", { auto: true, hint: "Auto-generated" }),
      t("name", "Full Name", { required: true }),
      t("contact", "Contact"),
      { name: "address", label: "Address", type: "textarea" },
      { name: "course", label: "Course", type: "course", required: true },
      t("batch", "Batch"),
      d("admission_date", "Admission Date"),
      t("fee_plan", "Fee Plan"),
      t("admitted_by", "Admitted By"),
      sel("status", "Status", ["active", "dropped", "completed"], { default: "active" }),
    ],
  },
  attendance: {
    label: "Attendance Register", group: "Academics", icon: "CalendarCheck",
    subtitle: "All student attendance",
    fields: [
      { name: "student_id", label: "Student", type: "student", required: true },
      { name: "course", label: "Course", type: "course" },
      d("date", "Date", { required: true }),
      sel("status", "Status", ["present", "absent", "late"], { default: "present" }),
      t("remark", "Remark"),
      t("marked_by", "Marked By"),
    ],
  },
  fee: {
    label: "Fee Register", group: "Finance", icon: "Wallet",
    fields: [
      { name: "student_id", label: "Student", type: "student", required: true },
      n("total_fee", "Total Fee"),
      t("installment_schedule", "Installment Schedule"),
      n("amount_paid", "Amount Paid"),
      n("balance_due", "Balance Due"),
      d("due_date", "Due Date"),
      d("payment_date", "Payment Date"),
      sel("payment_mode", "Payment Mode", ["cash", "card", "upi", "bank"]),
      t("receipt_no", "Receipt No"),
    ],
  },
  course: {
    label: "Course Register", group: "Academics", icon: "BookOpen",
    fields: [
      t("name", "Course Name", { required: true }),
      t("code", "Code"),
      t("duration", "Duration"),
      t("syllabus_ref", "Syllabus Ref"),
      t("fee_structure", "Fee Structure"),
      t("batch_timings", "Batch Timings"),
      n("seats", "Seats"),
    ],
  },
  certificate: {
    label: "Certificate Register", group: "Academics", icon: "Award",
    fields: [
      { name: "student_id", label: "Student", type: "student", required: true },
      t("course", "Course Completed"),
      t("certificate_no", "Certificate No"),
      d("issue_date", "Issue Date"),
      t("issued_by", "Issued By"),
    ],
  },
  placement: {
    label: "Placement Register", group: "Academics", icon: "Briefcase",
    fields: [
      { name: "student_id", label: "Student", type: "student", required: true },
      t("company", "Company"),
      t("role", "Role"),
      t("salary", "Salary / Stipend"),
      d("placement_date", "Placement Date"),
      { name: "followup_notes", label: "Follow-up Notes", type: "textarea" },
    ],
  },
  faculty: {
    label: "Faculty Register", group: "People & Payroll", icon: "Users",
    fields: [
      t("faculty_id", "Faculty ID", { required: true }),
      t("name", "Name", { required: true }),
      t("contact", "Contact"),
      t("qualification", "Qualification"),
      t("subject", "Subject / Course"),
      d("joining_date", "Joining Date"),
      t("salary_structure", "Salary Structure"),
    ],
  },
  faculty_attendance: {
    label: "Faculty Attendance", group: "People & Payroll", icon: "ClipboardCheck",
    fields: [
      t("faculty_id", "Faculty ID"),
      t("faculty_name", "Faculty Name"),
      d("date", "Date", { required: true }),
      sel("status", "Status", ["present", "absent", "leave"], { default: "present" }),
      t("remark", "Remark"),
    ],
  },
  scholarship: {
    label: "Scholarship & Free Class", group: "Academics", icon: "HandHeart",
    fields: [
      { name: "student_id", label: "Student", type: "student", required: true },
      t("scholarship_type", "Type / Reason"),
      t("amount", "Amount"),
      t("class_waived", "Class Waived"),
      t("approved_by", "Approved By"),
      d("date", "Date"),
    ],
  },
  cashbook: {
    label: "Cash Book", group: "Finance", icon: "Coins",
    fields: [
      d("date", "Date", { required: true }),
      t("particulars", "Particulars"),
      n("receipt_in", "Receipt (In)"),
      n("payment_out", "Payment (Out)"),
      n("balance", "Running Balance"),
    ],
  },
  bankbook: {
    label: "Bank Book", group: "Finance", icon: "Landmark",
    fields: [
      d("date", "Date", { required: true }),
      t("particulars", "Particulars"),
      n("deposit", "Deposit"),
      n("withdrawal", "Withdrawal"),
      n("balance", "Running Balance"),
      t("bank_ref", "Bank / Account Ref"),
    ],
  },
  purchase: {
    label: "Purchase Register", group: "Finance", icon: "ShoppingCart",
    fields: [
      d("date", "Date", { required: true }),
      t("item", "Item Purchased"),
      t("vendor", "Vendor"),
      n("quantity", "Quantity"),
      n("amount", "Amount"),
      t("invoice_no", "Invoice No"),
      sel("payment_status", "Payment Status", ["paid", "unpaid", "partial"]),
    ],
  },
  income: {
    label: "Income Register", group: "Finance", icon: "TrendingUp",
    fields: [
      d("date", "Date", { required: true }),
      t("source", "Source of Income"),
      t("category", "Category"),
      n("amount", "Amount"),
      sel("mode", "Mode of Receipt", ["cash", "bank", "upi", "card"]),
    ],
  },
  expense: {
    label: "Expense Register", group: "Finance", icon: "TrendingDown",
    fields: [
      d("date", "Date", { required: true }),
      t("expense_head", "Expense Head"),
      n("amount", "Amount"),
      t("paid_to", "Paid To"),
      sel("mode", "Mode of Payment", ["cash", "bank", "upi", "card"]),
      t("approved_by", "Approved By"),
    ],
  },
  salary: {
    label: "Salary Register", group: "People & Payroll", icon: "BadgeDollarSign",
    fields: [
      t("staff_id", "Faculty / Staff ID", { required: true }),
      t("month", "Month"),
      n("basic_pay", "Basic Pay"),
      n("deductions", "Deductions"),
      n("net_pay", "Net Pay"),
      d("payment_date", "Payment Date"),
      sel("payment_mode", "Payment Mode", ["cash", "bank", "upi"]),
    ],
  },
  asset: {
    label: "Asset Register", group: "Administration", icon: "Package",
    fields: [
      t("name", "Asset Name", { required: true }),
      t("category", "Category"),
      d("purchase_date", "Purchase Date"),
      n("cost", "Cost"),
      t("vendor", "Vendor"),
      sel("condition", "Condition", ["good", "fair", "poor"]),
      t("location", "Location"),
    ],
  },
  correspondence: {
    label: "Correspondence (Post)", group: "Administration", icon: "Mail",
    fields: [
      d("date", "Date", { required: true }),
      sel("type", "Type", ["in", "out"]),
      t("party", "Sender / Receiver"),
      t("subject", "Subject"),
      t("reference_no", "Reference No"),
      t("action_taken", "Action Taken"),
    ],
  },
  visitor: {
    label: "Visitor Register", group: "Administration", icon: "UserCheck",
    fields: [
      d("date", "Date", { required: true }),
      t("name", "Visitor Name", { required: true }),
      t("contact", "Contact"),
      t("purpose", "Purpose of Visit"),
      t("person_met", "Person Met"),
      t("time_in", "Time In"),
      t("time_out", "Time Out"),
    ],
  },
  firesafety: {
    label: "Fire Safety Register", group: "Administration", icon: "Flame",
    fields: [
      d("inspection_date", "Inspection Date", { required: true }),
      t("equipment", "Equipment Checked"),
      sel("condition", "Condition", ["ok", "needs-attention"]),
      t("inspected_by", "Inspected By"),
      d("next_due_date", "Next Due Date"),
      t("remarks", "Remarks / Corrective Action"),
    ],
  },
};

export const GROUPS = ["Academics", "People & Payroll", "Finance", "Administration"];
