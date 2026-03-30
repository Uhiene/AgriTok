// src/lib/email/templates.ts
// Typed email template functions — exported for type safety and potential preview UI.
// The Deno edge function (supabase/functions/send-email) contains the actual rendering.

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

// ── Shared layout ─────────────────────────────────────────────────────────────

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
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0D2B1E;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#52C97C;font-size:24px;font-weight:700;letter-spacing:0.5px;font-family:'Helvetica Neue',Arial,sans-serif;">AgriToken</h1>
              <p style="margin:5px 0 0;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Tokenized Crop Financing</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
              ${body}

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:24px;border-top:1px solid rgba(13,43,30,0.08);">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0;color:#5A7A62;font-size:12px;line-height:1.6;">You received this because you have an AgriToken account.</p>
                    <p style="margin:6px 0 0;color:#5A7A62;font-size:12px;">
                      <a href="{{UNSUBSCRIBE_URL}}" style="color:#5A7A62;text-decoration:underline;">Unsubscribe</a>
                      &nbsp;&middot;&nbsp;
                      <a href="https://agritoken.io" style="color:#5A7A62;text-decoration:underline;">agritoken.io</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 16px;color:#0D2B1E;font-size:20px;font-weight:700;font-family:'Helvetica Neue',Arial,sans-serif;">${text}</h2>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.7;">${text}</p>`
}

function ctaButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#52C97C;border-radius:30px;padding:0;">
        <a href="${href}" style="display:inline-block;padding:14px 32px;color:#0D2B1E;font-size:14px;font-weight:700;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;">${text}</a>
      </td>
    </tr>
  </table>`
}

function statRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(13,43,30,0.06);">
      <span style="color:#5A7A62;font-size:13px;">${label}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(13,43,30,0.06);text-align:right;">
      <span style="color:#0D2B1E;font-size:13px;font-weight:600;">${value}</span>
    </td>
  </tr>`
}

function statsTable(rows: Array<[string, string]>): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E8;border-radius:8px;padding:4px 16px;margin:20px 0;">
    ${rows.map(([l, v]) => statRow(l, v)).join('')}
  </table>`
}

function alertBox(text: string, color = '#FEF3C7', borderColor = '#F5C842'): string {
  return `<div style="background:${color};border-left:4px solid ${borderColor};border-radius:4px;padding:12px 16px;margin:20px 0;">
    <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${text}</p>
  </div>`
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function welcomeFarmer(name: string): EmailTemplate {
  const subject = 'Welcome to AgriToken — Your Farm, Tokenized'
  const body = `
    ${h2(`Welcome, ${name}`)}
    ${p('You have joined AgriToken — the platform that lets smallholder farmers tokenize future harvest yields and receive funding from global investors.')}
    ${p('Here is what you can do next:')}
    <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:15px;line-height:2.0;">
      <li>Register your farm and add your field details</li>
      <li>Complete KYC verification to unlock token issuance</li>
      <li>Create your first crop listing and set a funding goal</li>
      <li>Receive funding and deliver on your harvest</li>
    </ul>
    ${ctaButton('Go to Farmer Dashboard', 'https://agritoken.io/farmer/dashboard')}
    ${alertBox('Complete your KYC to unlock token creation. It only takes a few minutes.')}
    ${p('If you have any questions, reply to this email and our team will be happy to help.')}
  `
  const text = `Welcome to AgriToken, ${name}!\n\nYou have joined AgriToken — the platform that lets smallholder farmers tokenize future harvest yields.\n\nNext steps:\n- Register your farm\n- Complete KYC verification\n- Create a crop listing\n\nVisit: https://agritoken.io/farmer/dashboard`

  return { subject, html: layout(subject, body), text }
}

export function welcomeInvestor(name: string): EmailTemplate {
  const subject = 'Welcome to AgriToken — Invest in Real Agricultural Yields'
  const body = `
    ${h2(`Welcome, ${name}`)}
    ${p('You are now part of AgriToken — the first platform bringing real-world agricultural yields on-chain. Fund smallholder farmers, earn returns at harvest.')}
    ${p('Here is how to get started:')}
    <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:15px;line-height:2.0;">
      <li>Browse the marketplace for open crop listings</li>
      <li>Choose crops by expected return, location, and deadline</li>
      <li>Invest using your card (Stripe) or BNB wallet</li>
      <li>Track your portfolio and receive payouts at harvest</li>
    </ul>
    ${ctaButton('Browse the Marketplace', 'https://agritoken.io/investor/marketplace')}
    ${p('All listed farms are verified and commodity prices are sourced from live market data.')}
  `
  const text = `Welcome to AgriToken, ${name}!\n\nBrowse verified crop listings and invest in real agricultural yields on BNB Chain.\n\nVisit the marketplace: https://agritoken.io/investor/marketplace`

  return { subject, html: layout(subject, body), text }
}

export function investmentConfirmed(
  investor: string,
  crop: string,
  amount: string,
  tokens: number,
): EmailTemplate {
  const subject = `Investment Confirmed — ${tokens} ${crop} Tokens`
  const body = `
    ${h2('Your Investment is Confirmed')}
    ${p(`Hi ${investor}, your investment in <strong>${crop}</strong> has been successfully processed.`)}
    ${statsTable([
      ['Crop', crop],
      ['Tokens Purchased', tokens.toString()],
      ['Amount Paid', amount],
      ['Status', 'Confirmed'],
    ])}
    ${p('You will be notified when the farmer submits a harvest report and when your payout is processed.')}
    ${ctaButton('View Your Portfolio', 'https://agritoken.io/investor/portfolio')}
    ${p('Thank you for supporting smallholder farmers through tokenized financing.')}
  `
  const text = `Investment Confirmed\n\nHi ${investor},\n\nYour investment of ${amount} for ${tokens} ${crop} tokens has been confirmed.\n\nView portfolio: https://agritoken.io/investor/portfolio`

  return { subject, html: layout(subject, body), text }
}

export function newInvestorAlert(
  farmer: string,
  crop: string,
  investor: string,
  amount: string,
): EmailTemplate {
  const subject = `New Investment in Your ${crop} Listing`
  const body = `
    ${h2('You Received a New Investment')}
    ${p(`Hi ${farmer}, an investor has funded your <strong>${crop}</strong> listing.`)}
    ${statsTable([
      ['Crop Listing', crop],
      ['Investor', investor],
      ['Amount Invested', amount],
    ])}
    ${p('Your listing is gaining traction. Keep it updated and deliver a strong harvest.')}
    ${ctaButton('View Your Listing', 'https://agritoken.io/farmer/listings')}
  `
  const text = `New Investment Alert\n\nHi ${farmer},\n\n${investor} invested ${amount} in your ${crop} listing.\n\nView listings: https://agritoken.io/farmer/listings`

  return { subject, html: layout(subject, body), text }
}

export function harvestReportReceived(
  investor: string,
  crop: string,
  farmer: string,
): EmailTemplate {
  const subject = `Harvest Report Submitted — ${crop}`
  const body = `
    ${h2('Harvest Report Submitted')}
    ${p(`Hi ${investor}, the farmer <strong>${farmer}</strong> has submitted a harvest report for the <strong>${crop}</strong> listing you invested in.`)}
    ${alertBox('An admin is now reviewing the harvest report. Payouts will be processed once it is verified.', '#ECFDF5', '#52C97C')}
    ${p('You do not need to take any action. We will notify you as soon as your payout is ready.')}
    ${ctaButton('Track Your Investment', 'https://agritoken.io/investor/portfolio')}
  `
  const text = `Harvest Report Submitted\n\nHi ${investor},\n\n${farmer} submitted a harvest report for ${crop}. Payouts will follow admin verification.\n\nTrack: https://agritoken.io/investor/portfolio`

  return { subject, html: layout(subject, body), text }
}

export function payoutSent(
  investor: string,
  amount: string,
  crop: string,
): EmailTemplate {
  const subject = `Payout Processed — ${amount} from ${crop}`
  const body = `
    ${h2('Your Payout Has Been Processed')}
    ${p(`Hi ${investor}, your harvest payout for the <strong>${crop}</strong> listing has been processed.`)}
    ${statsTable([
      ['Crop', crop],
      ['Payout Amount', amount],
      ['Status', 'Processed'],
    ])}
    ${p('If you invested via BNB, the payout has been triggered on-chain. If you invested via card, please expect a bank transfer.')}
    ${ctaButton('View Transaction History', 'https://agritoken.io/investor/transactions')}
    ${p('Thank you for investing through AgriToken. We hope to see you fund your next crop soon.')}
  `
  const text = `Payout Processed\n\nHi ${investor},\n\nYour payout of ${amount} for ${crop} has been processed.\n\nView transactions: https://agritoken.io/investor/transactions`

  return { subject, html: layout(subject, body), text }
}

export function kycApproved(farmer: string): EmailTemplate {
  const subject = 'KYC Verified — You Can Now Issue Crop Tokens'
  const body = `
    ${h2('Your KYC is Approved')}
    ${p(`Congratulations, ${farmer}! Your identity verification has been approved by our team.`)}
    ${alertBox('You can now create crop listings and issue tokens on BNB Chain.', '#ECFDF5', '#52C97C')}
    ${p('Start by creating your first tokenized crop listing. Set your funding goal, harvest date, and expected return — then let investors fund your farm.')}
    ${ctaButton('Create Your First Listing', 'https://agritoken.io/farmer/listings/new')}
  `
  const text = `KYC Approved\n\nCongratulations, ${farmer}! Your KYC has been verified. You can now create crop listings.\n\nGet started: https://agritoken.io/farmer/listings/new`

  return { subject, html: layout(subject, body), text }
}

export function kycRejected(farmer: string, reason: string): EmailTemplate {
  const subject = 'KYC Review Update — Action Required'
  const body = `
    ${h2('KYC Verification Unsuccessful')}
    ${p(`Hi ${farmer}, unfortunately your KYC submission could not be approved at this time.`)}
    ${alertBox(`<strong>Reason:</strong> ${reason}`, '#FEF2F2', '#EF4444')}
    ${p('You can resubmit your documents by returning to the KYC page. Make sure your documents are clear, valid, and match your registered name.')}
    ${ctaButton('Resubmit KYC Documents', 'https://agritoken.io/farmer/kyc')}
    ${p('If you believe this is an error or need help, please reply to this email with your account details.')}
  `
  const text = `KYC Update\n\nHi ${farmer},\n\nYour KYC was not approved.\nReason: ${reason}\n\nPlease resubmit: https://agritoken.io/farmer/kyc`

  return { subject, html: layout(subject, body), text }
}
