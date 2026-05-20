import { Resend } from 'resend'

// Lazy client — not instantiated at module load so builds without env vars work
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'no-reply@rqlhi.com'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

async function send(payload: EmailPayload) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await getResend().emails.send({ from: FROM, ...payload })
  } catch (err) {
    console.error('[email] failed to send:', err)
  }
}

export async function sendTaskAssigned(opts: {
  to: string
  assigneeName: string
  taskTitle: string
  assignerName: string
  dueDate: string | null
  taskUrl: string
}) {
  await send({
    to: opts.to,
    subject: `[RQ LHI] Task Baru: ${opts.taskTitle}`,
    html: `
      <p>Halo <strong>${opts.assigneeName}</strong>,</p>
      <p><strong>${opts.assignerName}</strong> menugaskan task baru kepadamu:</p>
      <p><strong>${opts.taskTitle}</strong></p>
      ${opts.dueDate ? `<p>Deadline: <strong>${opts.dueDate}</strong></p>` : ''}
      <p><a href="${opts.taskUrl}">Lihat Task</a></p>
    `,
  })
}

export async function sendTaskDeadlineReminder(opts: {
  to: string
  assigneeName: string
  taskTitle: string
  dueDate: string
  taskUrl: string
}) {
  await send({
    to: opts.to,
    subject: `[RQ LHI] Reminder Deadline: ${opts.taskTitle}`,
    html: `
      <p>Halo <strong>${opts.assigneeName}</strong>,</p>
      <p>Task berikut mendekati deadline (H-2):</p>
      <p><strong>${opts.taskTitle}</strong></p>
      <p>Deadline: <strong>${opts.dueDate}</strong></p>
      <p><a href="${opts.taskUrl}">Lihat Task</a></p>
    `,
  })
}

export async function sendTaskReturned(opts: {
  to: string
  assigneeName: string
  taskTitle: string
  returnNotes: string
  taskUrl: string
}) {
  await send({
    to: opts.to,
    subject: `[RQ LHI] Task Dikembalikan: ${opts.taskTitle}`,
    html: `
      <p>Halo <strong>${opts.assigneeName}</strong>,</p>
      <p>Task <strong>${opts.taskTitle}</strong> dikembalikan dengan catatan:</p>
      <blockquote>${opts.returnNotes}</blockquote>
      <p><a href="${opts.taskUrl}">Lihat Task</a></p>
    `,
  })
}

export async function sendTaskSubmittedForReview(opts: {
  to: string
  assignerName: string
  taskTitle: string
  assigneeName: string
  taskUrl: string
}) {
  await send({
    to: opts.to,
    subject: `[RQ LHI] Task Perlu Verifikasi: ${opts.taskTitle}`,
    html: `
      <p>Halo <strong>${opts.assignerName}</strong>,</p>
      <p><strong>${opts.assigneeName}</strong> telah menyelesaikan task:</p>
      <p><strong>${opts.taskTitle}</strong></p>
      <p>Silakan verifikasi apakah task sudah sesuai.</p>
      <p><a href="${opts.taskUrl}">Verifikasi Task</a></p>
    `,
  })
}

export async function sendContentRequestToHumas(opts: {
  to: string
  requesterName: string
  requestType: string
  description: string
  requestUrl: string
}) {
  await send({
    to: opts.to,
    subject: `[RQ LHI] Content Request Baru dari ${opts.requesterName}`,
    html: `
      <p>Halo Humas,</p>
      <p><strong>${opts.requesterName}</strong> membuat request konten baru:</p>
      <p>Jenis: <strong>${opts.requestType}</strong></p>
      <p>Keterangan: ${opts.description}</p>
      <p><a href="${opts.requestUrl}">Lihat Request</a></p>
    `,
  })
}
