// supabase/functions/send-email/index.ts
// Internal Edge Function — not called from the frontend directly.
// Called by other edge functions to send transactional emails via Resend.
//
// POST { to, template_name, template_data }
//
// Env vars required:
//   RESEND_API_KEY        — from https://resend.com/api-keys
//   EMAIL_FROM            — e.g. "AgriToken <noreply@agritoken.io>"
//   SUPABASE_URL          — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase

import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'AgriToken <noreply@agritoken.io>'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Shared layout ──────────────────────────────────────────────────────────────

function layout(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F6F2E8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E8;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0D2B1E;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#52C97C;font-size:24px;font-weight:700;letter-spacing:0.5px;">AgriToken</h1>
            <p style="margin:5px 0 0;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Tokenized Crop Financing</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
            ${body}
            <!-- Footer -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:24px;border-top:1px solid rgba(13,43,30,0.08);">
              <tr><td style="text-align:center;">
                <p style="margin:0;color:#5A7A62;font-size:12px;line-height:1.6;">You received this because you have an AgriToken account.</p>
                <p style="margin:6px 0 0;font-size:12px;">
                  <a href="https://agritoken.io" style="color:#5A7A62;text-decoration:underline;">agritoken.io</a>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function h2(t: string) {
  return `<h2 style="margin:0 0 16px;color:#0D2B1E;font-size:20px;font-weight:700;">${t}</h2>`
}
function p(t: string) {
  return `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.7;">${t}</p>`
}
function cta(text: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#52C97C;border-radius:30px;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;color:#0D2B1E;font-size:14px;font-weight:700;text-decoration:none;">${text}</a>
  </td></tr></table>`
}
function alert(text: string, bg = '#FEF3C7', border = '#F5C842') {
  return `<div style="background:${bg};border-left:4px solid ${border};border-radius:4px;padding:12px 16px;margin:20px 0;">
    <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${text}</p>
  </div>`
}
function stats(rows: [string, string][]) {
  const inner = rows.map(([l, v]) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(13,43,30,0.06);color:#5A7A62;font-size:13px;">${l}</td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(13,43,30,0.06);text-align:right;color:#0D2B1E;font-size:13px;font-weight:600;">${v}</td>
  </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E8;border-radius:8px;padding:4px 16px;margin:20px 0;">${inner}</table>`
}

// ── Template registry ──────────────────────────────────────────────────────────

type TemplateData = Record<string, string | number>

interface Rendered { subject: string; html: string; text: string }

function render(name: string, d: TemplateData): Rendered {
  switch (name) {

    case 'welcomeFarmer': {
      const subject = 'Welcome to AgriToken — Your Farm, Tokenized'
      const html = layout(subject, `
        ${h2(`Welcome, ${d.name}`)}
        ${p('You have joined AgriToken — the platform that lets smallholder farmers tokenize future harvest yields and receive funding from global investors.')}
        ${p('Here is what you can do next:')}
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:15px;line-height:2.0;">
          <li>Register your farm and add your field details</li>
          <li>Complete KYC verification to unlock token issuance</li>
          <li>Create your first crop listing and set a funding goal</li>
          <li>Receive funding and deliver on your harvest</li>
        </ul>
        ${cta('Go to Farmer Dashboard', 'https://agritoken.io/farmer/dashboard')}
        ${alert('Complete your KYC to unlock token creation. It only takes a few minutes.')}
      `)
      return { subject, html, text: `Welcome to AgriToken, ${d.name}!\n\nStart by registering your farm and completing KYC.\n\nhttps://agritoken.io/farmer/dashboard` }
    }

    case 'welcomeInvestor': {
      const subject = 'Welcome to AgriToken — Invest in Real Agricultural Yields'
      const html = layout(subject, `
        ${h2(`Welcome, ${d.name}`)}
        ${p('You are now part of AgriToken — the first platform bringing real-world agricultural yields on-chain. Fund smallholder farmers, earn returns at harvest.')}
        ${p('Here is how to get started:')}
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:15px;line-height:2.0;">
          <li>Browse the marketplace for open crop listings</li>
          <li>Choose crops by expected return, location, and deadline</li>
          <li>Invest using your card or BNB wallet</li>
          <li>Track your portfolio and receive payouts at harvest</li>
        </ul>
        ${cta('Browse the Marketplace', 'https://agritoken.io/investor/marketplace')}
      `)
      return { subject, html, text: `Welcome to AgriToken, ${d.name}!\n\nBrowse verified crop listings and invest.\n\nhttps://agritoken.io/investor/marketplace` }
    }

    case 'investmentConfirmed': {
      const subject = `Investment Confirmed — ${d.tokens} ${d.crop} Tokens`
      const html = layout(subject, `
        ${h2('Your Investment is Confirmed')}
        ${p(`Hi ${d.investor}, your investment in <strong>${d.crop}</strong> has been successfully processed.`)}
        ${stats([['Crop', String(d.crop)], ['Tokens Purchased', String(d.tokens)], ['Amount Paid', String(d.amount)], ['Status', 'Confirmed']])}
        ${p('You will be notified when the farmer submits a harvest report and when your payout is processed.')}
        ${cta('View Your Portfolio', 'https://agritoken.io/investor/portfolio')}
      `)
      return { subject, html, text: `Investment Confirmed\n\nYour investment of ${d.amount} for ${d.tokens} ${d.crop} tokens is confirmed.\n\nhttps://agritoken.io/investor/portfolio` }
    }

    case 'newInvestorAlert': {
      const subject = `New Investment in Your ${d.crop} Listing`
      const html = layout(subject, `
        ${h2('You Received a New Investment')}
        ${p(`Hi ${d.farmer}, an investor has funded your <strong>${d.crop}</strong> listing.`)}
        ${stats([['Crop Listing', String(d.crop)], ['Amount Invested', String(d.amount)]])}
        ${p('Your listing is gaining traction. Keep it updated and deliver a strong harvest.')}
        ${cta('View Your Listings', 'https://agritoken.io/farmer/listings')}
      `)
      return { subject, html, text: `New Investment\n\nSomeone invested ${d.amount} in your ${d.crop} listing.\n\nhttps://agritoken.io/farmer/listings` }
    }

    case 'harvestReportReceived': {
      const subject = `Harvest Report Submitted — ${d.crop}`
      const html = layout(subject, `
        ${h2('Harvest Report Submitted')}
        ${p(`Hi ${d.investor}, the farmer <strong>${d.farmer}</strong> has submitted a harvest report for your <strong>${d.crop}</strong> investment.`)}
        ${alert('An admin is reviewing the harvest report. Payouts will be processed once it is verified.', '#ECFDF5', '#52C97C')}
        ${p('You do not need to take any action. We will notify you as soon as your payout is ready.')}
        ${cta('Track Your Investment', 'https://agritoken.io/investor/portfolio')}
      `)
      return { subject, html, text: `Harvest Report Submitted\n\n${d.farmer} submitted a harvest report for ${d.crop}. Payout follows admin verification.\n\nhttps://agritoken.io/investor/portfolio` }
    }

    case 'payoutSent': {
      const subject = `Payout Processed — ${d.amount} from ${d.crop}`
      const html = layout(subject, `
        ${h2('Your Payout Has Been Processed')}
        ${p(`Hi ${d.investor}, your harvest payout for <strong>${d.crop}</strong> has been processed.`)}
        ${stats([['Crop', String(d.crop)], ['Payout Amount', String(d.amount)], ['Status', 'Processed']])}
        ${p('If you invested via BNB, the payout has been triggered on-chain. Card investors will receive a bank transfer.')}
        ${cta('View Transaction History', 'https://agritoken.io/investor/transactions')}
      `)
      return { subject, html, text: `Payout Processed\n\nYour payout of ${d.amount} for ${d.crop} has been processed.\n\nhttps://agritoken.io/investor/transactions` }
    }

    case 'kycApproved': {
      const subject = 'KYC Verified — You Can Now Issue Crop Tokens'
      const html = layout(subject, `
        ${h2('Your KYC is Approved')}
        ${p(`Congratulations, ${d.farmer}! Your identity has been verified by our team.`)}
        ${alert('You can now create crop listings and issue tokens on BNB Chain.', '#ECFDF5', '#52C97C')}
        ${p('Create your first tokenized crop listing. Set your funding goal, harvest date, and expected return.')}
        ${cta('Create Your First Listing', 'https://agritoken.io/farmer/listings/new')}
      `)
      return { subject, html, text: `KYC Approved\n\nCongratulations ${d.farmer}! You can now create crop listings.\n\nhttps://agritoken.io/farmer/listings/new` }
    }

    case 'kycRejected': {
      const subject = 'KYC Review Update — Action Required'
      const html = layout(subject, `
        ${h2('KYC Verification Unsuccessful')}
        ${p(`Hi ${d.farmer}, your KYC submission could not be approved at this time.`)}
        ${alert(`<strong>Reason:</strong> ${d.reason}`, '#FEF2F2', '#EF4444')}
        ${p('You can resubmit your documents from the KYC page. Ensure your documents are clear, valid, and match your registered name.')}
        ${cta('Resubmit KYC Documents', 'https://agritoken.io/farmer/kyc')}
        ${p('If you believe this is an error, reply to this email with your account details.')}
      `)
      return { subject, html, text: `KYC Update\n\nYour KYC was not approved.\nReason: ${d.reason}\n\nPlease resubmit: https://agritoken.io/farmer/kyc` }
    }

    default:
      throw new Error(`Unknown template: ${name}`)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { to: string; template_name: string; template_data: TemplateData }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { to, template_name, template_data } = body

  if (!to || !template_name || !template_data) {
    return new Response('Missing required fields: to, template_name, template_data', { status: 400 })
  }

  // Render template
  let rendered: Rendered
  try {
    rendered = render(template_name, template_data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(msg, { status: 400 })
  }

  // Send via Resend REST API
  let sendStatus: 'sent' | 'failed' = 'failed'
  let sendError: string | null = null
  let resendId: string | null = null

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    })

    const data = await res.json() as { id?: string; message?: string }

    if (!res.ok) {
      sendError = data.message ?? `Resend error ${res.status}`
      console.error(`send-email: Resend API error for ${template_name} to ${to}:`, sendError)
    } else {
      sendStatus = 'sent'
      resendId = data.id ?? null
      console.log(`send-email: ${template_name} sent to ${to} (resend_id: ${resendId})`)
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`send-email: fetch error for ${template_name} to ${to}:`, sendError)
  }

  // Log to email_logs — non-fatal if table doesn't exist yet
  try {
    await supabase.from('email_logs').insert({
      to_email:      to,
      template_name,
      subject:       rendered.subject,
      status:        sendStatus,
      error:         sendError,
      resend_id:     resendId,
    })
  } catch {
    // email_logs table may not exist yet — safe to ignore
  }

  if (sendStatus === 'failed') {
    return new Response(JSON.stringify({ error: sendError }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ sent: true, resend_id: resendId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
