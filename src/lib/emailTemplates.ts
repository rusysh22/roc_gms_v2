type LinkAction = {
  label: string
  href: string
}

type MatchEmailInput = {
  title: string
  subtitle?: string
  matchNumber: string
  sport?: string
  category?: string
  participantA?: string
  participantB?: string
  startLabel?: string
  endLabel?: string
  venue?: string
  court?: string
  matchUrl?: string
  calendarUrl?: string
}

type ScheduleEmailInput = {
  title: string
  intro: string
  eventName?: string
  matches: MatchEmailInput[]
  action?: LinkAction
}

type AnnouncementEmailInput = {
  title: string
  summary: string
  body: string
  urgency?: string
  eventName?: string
  action?: LinkAction
}

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const button = (action?: LinkAction) =>
  action ?
    `<p style="margin:24px 0 0"><a href="${escapeHtml(action.href)}" style="display:inline-block;border-radius:999px;background:#128A56;color:#FFFFFF;font-weight:700;text-decoration:none;padding:12px 18px">${escapeHtml(action.label)}</a></p>`
  : ''

const baseEmail = ({ title, preheader, body }: { title: string; preheader: string; body: string }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#F1F7F4;font-family:Arial,Helvetica,sans-serif;color:#0C231F">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1F7F4;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #DBE6E1;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:24px">
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

const matchCard = (match: MatchEmailInput) => {
  const participants = [match.participantA, match.participantB].filter(Boolean).join(' vs ')
  const meta = [match.sport, match.category, match.matchNumber].filter(Boolean).join(' / ')
  const location = [match.venue, match.court].filter(Boolean).join(' / ')

  return `<tr>
    <td style="padding:16px 0;border-top:1px solid #DBE6E1">
      <p style="margin:0 0 4px;color:#41564F;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(meta)}</p>
      <h3 style="margin:0 0 8px;font-size:18px;line-height:1.35">${escapeHtml(participants || match.title)}</h3>
      <p style="margin:0;color:#41564F;font-size:14px;line-height:1.6">
        ${escapeHtml(match.startLabel || 'Time TBD')}${match.endLabel ? ` - ${escapeHtml(match.endLabel)}` : ''}<br />
        ${escapeHtml(location || 'Venue TBD')}
      </p>
      ${
        match.matchUrl || match.calendarUrl ?
          `<p style="margin:12px 0 0;font-size:14px;font-weight:700">
            ${match.matchUrl ? `<a href="${escapeHtml(match.matchUrl)}" style="color:#1B57C4;text-decoration:none">Match detail</a>` : ''}
            ${match.matchUrl && match.calendarUrl ? ' &nbsp; ' : ''}
            ${match.calendarUrl ? `<a href="${escapeHtml(match.calendarUrl)}" style="color:#1B57C4;text-decoration:none">Add to calendar</a>` : ''}
          </p>`
        : ''
      }
    </td>
  </tr>`
}

export const renderScheduleEmail = ({ title, intro, eventName, matches, action }: ScheduleEmailInput) =>
  baseEmail({
    title,
    preheader: intro,
    body: `
      <p style="margin:0 0 8px;color:#128A56;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${escapeHtml(eventName || 'ROC Olympic')}</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;color:#41564F;font-size:15px;line-height:1.7">${escapeHtml(intro)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${matches.map(matchCard).join('')}
      </table>
      ${button(action)}
    `,
  })

export const renderMatchReminderEmail = (match: MatchEmailInput) =>
  baseEmail({
    title: match.title,
    preheader: match.subtitle || 'Match reminder from ROC Olympic.',
    body: `
      <p style="margin:0 0 8px;color:#128A56;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Match reminder</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${escapeHtml(match.title)}</h1>
      <p style="margin:0 0 20px;color:#41564F;font-size:15px;line-height:1.7">${escapeHtml(match.subtitle || 'Please arrive early and check the latest match details before heading to the venue.')}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${matchCard(match)}</table>
      ${button(match.matchUrl ? { label: 'Open match detail', href: match.matchUrl } : undefined)}
    `,
  })

export const renderAnnouncementEmail = ({
  title,
  summary,
  body,
  urgency,
  eventName,
  action,
}: AnnouncementEmailInput) =>
  baseEmail({
    title,
    preheader: summary,
    body: `
      <p style="margin:0 0 8px;color:#128A56;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${escapeHtml(eventName || 'ROC Olympic')}${urgency ? ` / ${escapeHtml(urgency)}` : ''}</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;color:#41564F;font-size:15px;line-height:1.7">${escapeHtml(summary)}</p>
      <div style="border-top:1px solid #DBE6E1;padding-top:16px;color:#0C231F;font-size:15px;line-height:1.7">${escapeHtml(body).replace(/\n/g, '<br />')}</div>
      ${button(action)}
    `,
  })
