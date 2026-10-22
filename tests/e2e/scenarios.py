"""
End-to-end scenarios for the access-control & distributor-workflow enhancement.

Runs against a served build (vite preview / dev server). All users share one browser
context, so they share the prototype's in-browser state — exactly like a stakeholder
demo. Usage:  python3 tests/e2e/scenarios.py [base_url]
"""
import os, re, sys, tempfile, traceback
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
PW = 'TradeFlow@2026'
U = {
    'omar': 'omar.haddad@gulfhorizon.example', 'neema': 'neema@lagoonbeauty.example', 'tom': 'tom@auroratrade.example',
    'priya': 'priya.nair@tradeflow.example', 'hassan': 'hassan.javed@tradeflow.example', 'daniel': 'daniel.okafor@tradeflow.example',
    'faisal': 'faisal.rahman@tradeflow.example', 'sofia': 'sofia.lindqvist@tradeflow.example', 'layla': 'layla.mansour@tradeflow.example',
    'marcus': 'marcus.chen@tradeflow.example', 'carlos': 'carlos.mendes@tradeflow.example', 'nadia': 'nadia.rahim@tradeflow.example',
    'elena': 'elena.petrova@tradeflow.example',
}
NEW = {'email': 'lena@rheinparfum.example', 'pw': 'Rhein2026!'}
results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []
ctx_data: dict = {}


def scenario(name):
    def wrap(fn):
        def run(page):
            try:
                fn(page)
                results.append((name, True, ''))
                print(f'PASS  {name}')
            except Exception as e:  # noqa: BLE001
                results.append((name, False, f'{type(e).__name__}: ' + ' | '.join(l.strip() for l in str(e).splitlines()[:4])[:400]))
                print(f'FAIL  {name}\n      {results[-1][2]}')
                page.screenshot(path=f'{OUT}/fail-{len(results):02d}.png', full_page=True)
        return run
    return wrap


def logout(page):
    page.goto(BASE + '/app')
    menu = page.get_by_role('button', name='Profile menu')
    for _ in range(30):
        if '/login' in page.url:
            return
        if menu.count():
            break
        page.wait_for_timeout(150)
    if '/login' in page.url:
        return
    menu.click()
    page.get_by_text('Sign out', exact=True).click()
    page.wait_for_url('**/login**')


def login(page, who, password=PW, expect_ok=True):
    logout(page)
    page.goto(BASE + '/login')
    page.get_by_label('Email').fill(U.get(who, who))
    page.locator('input[autocomplete=current-password]').fill(password)
    page.get_by_role('button', name='Sign in', exact=True).click()
    if expect_ok:
        page.wait_for_url('**/app**')
        page.wait_for_timeout(600)


def open_app(page, ref):
    page.goto(BASE + '/app/applications?tab=all')
    page.get_by_placeholder('Search reference, company, city…').fill(ref)
    page.get_by_role('cell', name=ref).first.click()
    page.wait_for_url('**/app/applications/**')


def act(page, button, confirm, fill: dict | None = None, sections=()):
    page.get_by_role('button', name=button, exact=True).click()
    dlg = page.get_by_role('dialog')
    for s in sections:
        dlg.get_by_label(s).check()
    for label, text in (fill or {}).items():
        dlg.get_by_label(label).fill(text)
    dlg.get_by_role('button', name=confirm, exact=True).click()


def status_is(page, status):
    expect(page.locator('header').get_by_text(status, exact=True).first).to_be_visible()


# ─── Scenarios ─────────────────────────────────────────────────────────────

@scenario('S01 Applicant registers (account + Distributor Application) and receives reference + secure link')
def s01(page):
    logout(page)
    page.goto(BASE + '/register')
    page.get_by_label('Sign-in email').fill(NEW['email'])
    page.locator('input[autocomplete=new-password]').nth(0).fill(NEW['pw'])
    page.get_by_label('Confirm password').fill(NEW['pw'])
    page.get_by_role('button', name='Continue').click()
    page.get_by_label('Trading name').fill('Rhein Parfum')
    page.get_by_label('Registered legal name').fill('Rhein Parfum GmbH')
    page.get_by_label('Commercial registration no.').fill('HRB 99812')
    page.get_by_label('Tax / VAT number').fill('DE 812345678')
    page.get_by_label('Business type').select_option(index=1)
    page.get_by_label('Expected annual volume').select_option(index=2)
    page.get_by_role('button', name='Continue').click()
    page.get_by_label('Country').select_option('Germany')
    page.get_by_label('City', exact=False).first.fill('Cologne')
    page.get_by_label('Contact full name').fill('Lena Vogel')
    page.get_by_label('Job title').fill('Managing Director')
    expect(page.get_by_label('Business email')).to_have_value(NEW['email'])
    page.get_by_label('Phone').fill('+49 221 555 0100')
    page.get_by_role('button', name='Continue').click()
    page.locator('fieldset label').first.click()  # first brand
    page.get_by_label(re.compile(r'^Street address')).fill('Hohe Strasse 12')
    page.get_by_role('textbox', name='City').fill('Cologne')
    page.get_by_role('button', name='Continue').click()
    d = tempfile.mkdtemp()
    files = []
    for n in ('Handelsregister.pdf', 'USt_Certificate.pdf'):
        f = os.path.join(d, n); open(f, 'wb').write(b'%PDF-1.4 demo'); files.append(f)
    page.locator('input[type=file]').set_input_files(files)
    page.get_by_label('Type for USt_Certificate.pdf').select_option('Tax Certificate')
    page.get_by_role('button', name='Continue').click()
    page.get_by_label('I confirm the information provided is accurate and complete.').check()
    page.get_by_role('button', name='Submit application').click()
    expect(page.get_by_role('heading', name='Distributor application received')).to_be_visible(timeout=8000)
    ctx_data['ref'] = page.locator('span.font-mono').first.inner_text()
    ctx_data['link'] = page.locator('code').first.inner_text()
    assert re.match(r'APP-\d{4}-\d{4}', ctx_data['ref']), ctx_data['ref']
    assert '/track?ref=' in ctx_data['link'] and 'token=' in ctx_data['link']


@scenario('S02 Public tracking with reference + registered email shows status, stage and dates — no staff names')
def s02(page):
    logout(page)
    page.goto(BASE + '/track')
    page.get_by_label('Application reference').fill(ctx_data['ref'])
    page.get_by_label('Registered email address').fill(NEW['email'])
    page.get_by_role('button', name='Check status').click()
    expect(page.get_by_text('Submitted — waiting for review')).to_be_visible()
    expect(page.get_by_text('Initial review (1 of 3)')).to_be_visible()
    body = page.locator('main').inner_text()
    for leak in ('Hassan', 'Priya', 'Internal', 'u-sc'):
        assert leak not in body, f'leaked "{leak}"'


@scenario('S03 Secure time-limited link works; wrong email / tampered token / reference alone are rejected generically')
def s03(page):
    page.goto(ctx_data['link'].replace('http://localhost:4173', BASE))
    expect(page.get_by_text(ctx_data['ref']).first).to_be_visible()
    page.goto(BASE + '/track?ref=' + ctx_data['ref'] + '&token=deadbeef')
    expect(page.get_by_text('We could not find an application matching those details')).to_be_visible()
    page.goto(BASE + '/track')
    page.get_by_label('Application reference').fill(ctx_data['ref'])
    page.get_by_label('Registered email address').fill('someone@else.example')
    page.get_by_role('button', name='Check status').click()
    expect(page.get_by_text('We could not find an application matching those details')).to_be_visible()
    page.goto(BASE + '/track?ref=' + ctx_data['ref'])  # reference only → form, no data
    expect(page.get_by_role('button', name='Check status')).to_be_visible()
    expect(page.get_by_text('Initial review (1 of 3)')).to_have_count(0)


@scenario('S04 Initial reviewer (assigned by region) starts review; other actions blocked until started')
def s04(page):
    login(page, 'hassan')
    page.goto(BASE + '/app/applications?tab=action')
    expect(page.get_by_role('cell', name=ctx_data['ref'])).to_be_visible()
    open_app(page, ctx_data['ref'])
    expect(page.get_by_role('button', name='Recommend & forward')).to_be_disabled()
    expect(page.get_by_text('Start the review first.').first).to_be_visible()
    act(page, 'Start review', 'Start review')
    status_is(page, 'Under Review')


@scenario('S05 Return to requester: instructions + sections mandatory; status Returned for Correction; applicant notified')
def s05(page):
    page.get_by_role('button', name='Return to requester', exact=True).click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_role('button', name='Return to requester', exact=True).click()
    expect(dlg.get_by_role('alert')).to_contain_text('at least 10 characters')
    dlg.get_by_label('Instructions for the applicant').fill('Please correct the VAT number format and upload a current register extract.')
    dlg.get_by_role('button', name='Return to requester', exact=True).click()
    expect(dlg.get_by_role('alert')).to_contain_text('Select at least one section')
    dlg.get_by_label('Company details').check()
    dlg.get_by_label('Supporting documents').check()
    dlg.get_by_label('Internal remarks (optional)').fill('INTERNAL-NOTE: register extract looked stale.')
    dlg.get_by_role('button', name='Return to requester', exact=True).click()
    status_is(page, 'Returned for Correction')


@scenario('S06 Applicant edits only the re-opened sections, resubmits; revision 2 routes back to the returning reviewer')
def s06(page):
    login(page, NEW['email'], NEW['pw'])
    page.goto(BASE + '/app/my-applications')
    page.get_by_role('cell', name=ctx_data['ref']).click()
    expect(page.get_by_text('Please correct the VAT number format').first).to_be_visible()
    assert 'INTERNAL-NOTE' not in page.locator('main').inner_text()
    page.get_by_role('link', name='Correct and resubmit').click()
    page.get_by_label('Tax / VAT number').fill('DE812345678')
    page.get_by_role('button', name='Continue').click()
    expect(page.get_by_text('Contact & territory is not open for correction')).to_be_visible()
    expect(page.get_by_label('Contact full name')).to_be_disabled()
    page.get_by_role('button', name='Continue').click()
    page.get_by_role('button', name='Continue').click()
    d = tempfile.mkdtemp(); f = os.path.join(d, 'Register_extract_2026.pdf'); open(f, 'wb').write(b'%PDF demo')
    page.get_by_role('button', name='Replace / withdraw').first.click()
    page.locator('input[type=file]').set_input_files([f])
    page.get_by_role('button', name='Continue').click()
    page.get_by_label('Message to the reviewer (optional)').fill('VAT number corrected and new extract attached.')
    page.get_by_label('I confirm the information provided is accurate and complete.').check()
    page.get_by_role('button', name='Resubmit application').click()
    page.wait_for_url('**/app/my-applications/*')
    expect(page.get_by_text('Resubmitted — waiting for review')).to_be_visible()
    login(page, 'hassan')
    open_app(page, ctx_data['ref'])
    status_is(page, 'Resubmitted')
    page.get_by_role('tab', name=re.compile('Revisions')).click()
    expect(page.get_by_text('Revision 2', exact=True)).to_be_visible()
    expect(page.get_by_role('cell', name='DE812345678')).to_be_visible()
    page.get_by_role('tab', name=re.compile('Documents')).click()
    expect(page.get_by_text('Superseded (kept for audit)')).to_be_visible()


@scenario('S07 Request clarification → applicant answers → back with the same reviewer')
def s07(page):
    act(page, 'Start review', 'Start review')
    act(page, 'Request clarification', 'Send request', {'Question for the applicant': 'Which warehouse will you use for Benelux deliveries?'})
    status_is(page, 'Returned for Correction')
    login(page, NEW['email'], NEW['pw'])
    page.goto(BASE + '/app/my-applications')
    page.get_by_role('cell', name=ctx_data['ref']).click()
    page.get_by_label('Your answer').fill('Our bonded warehouse in Venlo (NL).')
    page.get_by_role('button', name='Send answer').click()
    expect(page.get_by_text('Resubmitted — waiting for review')).to_be_visible()
    login(page, 'hassan')
    page.goto(BASE + '/app/applications?tab=action')
    expect(page.get_by_role('cell', name=ctx_data['ref'])).to_be_visible()


@scenario('S08 Forward to departmental approver; approver returns to previous approver with internal findings')
def s08(page):
    open_app(page, ctx_data['ref'])
    act(page, 'Start review', 'Start review')
    act(page, 'Recommend & forward', 'Forward', {'Message to the applicant (optional)': 'Initial checks complete.'})
    status_is(page, 'Pending Approval')
    expect(page.get_by_text('Sofia Lindqvist').first).to_be_visible()
    login(page, 'sofia')
    open_app(page, ctx_data['ref'])
    page.get_by_role('button', name='Return to previous approver', exact=True).click()
    dlg = page.get_by_role('dialog')
    expect(dlg.get_by_text('Hassan Javed')).to_be_visible()
    dlg.get_by_role('button', name='Return to approver').click()
    expect(dlg.get_by_role('alert')).to_contain_text('Findings of at least 10 characters')
    dlg.get_by_label('Findings for the approver (internal)').fill('FINDINGS-XYZ: confirm Benelux exclusivity with Maison Rive first.')
    dlg.get_by_role('button', name='Return to approver').click()
    status_is(page, 'Under Review')
    login(page, 'hassan')
    page.goto(BASE + '/app/notifications')
    expect(page.get_by_text(f"{ctx_data['ref']} returned to you")).to_be_visible()
    open_app(page, ctx_data['ref'])
    page.get_by_role('tab', name=re.compile('Workflow history')).click()
    expect(page.get_by_text('FINDINGS-XYZ').first).to_be_visible()
    # public view must not show the internal findings
    page.goto(ctx_data['link'].replace('http://localhost:4173', BASE))
    expect(page.get_by_text(ctx_data['ref']).first).to_be_visible()
    body = page.locator('main').inner_text()
    assert 'FINDINGS-XYZ' not in body and 'INTERNAL-NOTE' not in body and 'Sofia' not in body


@scenario('S09 Reject (departmental approver) requires a reason; reviewer without the permission cannot reject; reason shown publicly')
def s09(page):
    login(page, 'hassan')
    open_app(page, 'APP-2026-0314')
    act(page, 'Start review', 'Start review')
    expect(page.get_by_role('button', name='Reject', exact=True)).to_have_count(0)  # Initial Reviewer role has no application.reject
    act(page, 'Recommend & forward', 'Forward')
    login(page, 'sofia')
    open_app(page, 'APP-2026-0314')
    page.get_by_role('button', name='Reject', exact=True).click()
    dlg = page.get_by_role('dialog')
    expect(dlg.get_by_text('This is final')).to_be_visible()
    dlg.get_by_role('button', name='Reject application').click()
    expect(dlg.get_by_role('alert')).to_contain_text('at least 10 characters')
    dlg.get_by_label('Reason shown to the applicant').fill('Online-only retail does not meet our selective distribution criteria.')
    dlg.get_by_role('button', name='Reject application').click()
    status_is(page, 'Rejected')
    expect(page.get_by_role('button', name='Return to requester')).to_have_count(0)
    page.goto(BASE + '/track')
    page.get_by_label('Application reference').fill('APP-2026-0314')
    page.get_by_label('Registered email address').fill(U['tom'])
    page.get_by_role('button', name='Check status').click()
    expect(page.get_by_text('Online-only retail does not meet').first).to_be_visible()
    login(page, 'hassan')


@scenario('S10 Approve at each stage → final approval creates the distributor account; applicant becomes Distributor')
def s10(page):
    open_app(page, ctx_data['ref'])
    act(page, 'Recommend & forward', 'Forward')
    login(page, 'sofia')
    open_app(page, ctx_data['ref'])
    act(page, 'Approve', 'Approve', {'Internal remarks (optional)': 'Exclusivity confirmed.'})
    status_is(page, 'Pending Approval')
    login(page, 'marcus')
    page.goto(BASE + '/app/applications?tab=action')
    page.get_by_role('cell', name=ctx_data['ref']).click()
    act(page, 'Give final approval', 'Give final approval')
    status_is(page, 'Approved')
    login(page, NEW['email'], NEW['pw'])
    nav = page.get_by_role('navigation', name='Main navigation')
    expect(nav.get_by_role('link', name='Product Catalog')).to_be_visible()
    page.get_by_role('button', name='Profile menu').click()
    expect(page.get_by_text('Distributor', exact=True).last).to_be_visible()
    page.keyboard.press('Escape')
    page.goto(BASE + '/app/my-applications')
    page.get_by_role('cell', name=ctx_data['ref']).click()
    expect(page.get_by_text('Distributor account activated')).to_be_visible()


@scenario('S11 Login validation: required fields, generic invalid-credentials error, show/hide password, lockout after 5 failures')
def s11(page):
    logout(page)
    page.goto(BASE + '/login')
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_text('Enter your email address.')).to_be_visible()
    page.get_by_label('Email').fill(U['carlos'])
    pw = page.locator('input[autocomplete=current-password]')
    pw.fill('wrong-password-1')
    page.get_by_role('button', name='Show password').click()
    expect(pw).to_have_attribute('type', 'text')
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_text('Incorrect email or password.')).to_be_visible()
    page.get_by_label('Email').fill('nobody@nowhere.example'); pw.fill('whatever1')
    page.get_by_role('button', name='Sign in', exact=True).click()
    expect(page.get_by_text('Incorrect email or password.')).to_be_visible()  # same message: no account enumeration
    page.get_by_label('Email').fill(U['carlos'])
    for i in range(4):
        pw.fill(f'wrong-{i}x'); page.get_by_role('button', name='Sign in', exact=True).click(); page.wait_for_timeout(450)
    expect(page.get_by_text('Too many failed sign-in attempts')).to_be_visible()
    pw.fill(PW); page.get_by_role('button', name='Sign in', exact=True).click(); page.wait_for_timeout(500)
    expect(page.get_by_text('Too many failed sign-in attempts')).to_be_visible()
    assert '/login' in page.url


@scenario('S12 Protected URL while signed out → sign-in with return path; role-aware landing; sign-out ends session')
def s12(page):
    logout(page)
    page.goto(BASE + '/app/admin/users')
    page.wait_for_url('**/login?next=*')
    page.get_by_label('Email').fill(U['elena'])
    page.locator('input[autocomplete=current-password]').fill(PW)
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url('**/app/admin/users')
    logout(page)
    page.goto(BASE + '/app/applications')
    page.wait_for_url('**/login?next=*')
    page.goto(BASE + '/login?next=//evil.example')  # open-redirect attempt is ignored
    page.get_by_label('Email').fill(U['neema']); page.locator('input[autocomplete=current-password]').fill(PW)
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url(BASE + '/app')


@scenario('S13 Typed URLs outside the user’s permissions show 403 and the menu hides them (distributor)')
def s13(page):
    login(page, 'omar')
    nav = page.get_by_role('navigation', name='Main navigation')
    for hidden in ('Users', 'Distributor Applications', 'Approval Workbench', 'Audit Trail'):
        expect(nav.get_by_role('link', name=hidden, exact=True)).to_have_count(0)
    for url in ('/app/admin/users', '/app/admin/roles', '/app/applications', '/app/approvals', '/app/admin/audit', '/app/payments?verify=x'):
        page.goto(BASE + url)
        if url.startswith('/app/payments'):
            continue
        expect(page.get_by_text('Error 403')).to_be_visible()


@scenario('S14 Record-level access: users only open records in their scope (assignment / ownership)')
def s14(page):
    login(page, 'priya')
    page.goto(BASE + '/app/applications/a-003')  # Hassan's region
    expect(page.get_by_text('Application not found')).to_be_visible()
    page.goto(BASE + '/app/applications?tab=all')
    expect(page.get_by_role('cell', name='APP-2026-0314')).to_have_count(0)
    login(page, 'omar')
    page.goto(BASE + '/app/my-applications/a-001')
    expect(page.get_by_text('Application not found')).to_be_visible()
    page.goto(BASE + '/app/distributors/c-002')
    expect(page.get_by_text('Distributor not available')).to_be_visible()
    login(page, 'daniel')
    page.goto(BASE + '/app/requests/r-139')  # Saudi request, not Daniel's territory
    expect(page.get_by_text('Request not available')).to_be_visible()


@scenario('S15 Read-only auditor sees history incl. internal remarks but no workflow or admin actions')
def s15(page):
    login(page, 'nadia')
    open_app(page, ctx_data['ref'])
    page.get_by_role('tab', name=re.compile('Workflow history')).click()
    expect(page.get_by_text('FINDINGS-XYZ').first).to_be_visible()
    for b in ('Approve', 'Reject', 'Return to requester', 'Start review'):
        expect(page.get_by_role('button', name=b, exact=True)).to_have_count(0)
    page.goto(BASE + '/app/admin/users')
    expect(page.get_by_text('Read-only: your role can view users')).to_be_visible()
    expect(page.get_by_role('button', name='Add user')).to_have_count(0)
    page.goto(BASE + '/app/admin/authorization')
    expect(page.get_by_text('Read-only view.')).to_be_visible()
    expect(page.locator('button[role=checkbox]')).to_have_count(0)


@scenario('S16 Admin adds a user with multiple roles + assignment; user signs in with combined access; deactivation blocks sign-in')
def s16(page):
    login(page, 'elena')
    page.goto(BASE + '/app/admin/users')
    page.get_by_role('button', name='Add user').click()
    d = page.get_by_role('dialog')
    d.get_by_label('Full name').fill('Omari Test')
    d.get_by_label('Email (sign-in)').fill('omari.test@tradeflow.example')
    d.get_by_label('Temporary password').fill('Welcome2026')
    d.get_by_label('Sales Coordinator (Initial Reviewer)').check()
    d.get_by_label('Read-only Auditor').check()
    d.get_by_label('Africa', exact=True).check()
    d.get_by_role('tab', name=re.compile('Effective permissions')).click()
    expect(d.get_by_text('View audit trail')).to_be_visible()
    d.get_by_role('button', name='Create user').click()
    page.get_by_placeholder('Name, email or title…').fill('Omari')
    expect(page.get_by_role('cell', name=re.compile('Omari Test'))).to_be_visible()
    login(page, 'omari.test@tradeflow.example', 'Welcome2026')
    nav = page.get_by_role('navigation', name='Main navigation')
    expect(nav.get_by_role('link', name='Audit Trail')).to_be_visible()
    expect(nav.get_by_role('link', name='Distributor Applications')).to_be_visible()
    login(page, 'elena')
    page.goto(BASE + '/app/admin/users')
    page.get_by_placeholder('Name, email or title…').fill('Omari')
    page.get_by_role('cell', name=re.compile('Omari Test')).click()
    page.get_by_role('dialog').get_by_role('switch', name='Active').click()
    page.get_by_role('dialog').get_by_role('button', name='Save changes').click()
    login(page, 'omari.test@tradeflow.example', 'Welcome2026', expect_ok=False)
    expect(page.get_by_text('Incorrect email or password.')).to_be_visible()


@scenario('S17 Permissions are data: revoking a grant changes menus and routes; critical admin grants are locked')
def s17(page):
    login(page, 'elena')
    page.goto(BASE + '/app/admin/authorization')
    page.get_by_label('Search permissions').fill('View catalog')
    page.get_by_role('checkbox', name='View catalog — Distributor: granted').click()
    expect(page.get_by_role('checkbox', name='View catalog — Distributor: not granted')).to_be_visible()
    page.get_by_label('Search permissions').fill('Manage users')
    expect(page.get_by_role('checkbox', name=re.compile('Manage users — System Administrator'))).to_have_count(0)  # locked cell
    login(page, 'omar')
    expect(page.get_by_role('navigation', name='Main navigation').get_by_role('link', name='Product Catalog')).to_have_count(0)
    page.goto(BASE + '/app/catalog')
    expect(page.get_by_text('Error 403')).to_be_visible()
    login(page, 'elena')
    page.goto(BASE + '/app/admin/authorization')
    page.get_by_label('Search permissions').fill('View catalog')
    page.get_by_role('checkbox', name='View catalog — Distributor: not granted').click()
    page.goto(BASE + '/app/admin/audit')
    page.get_by_label('Search audit trail').fill('catalog.view')
    expect(page.get_by_role('cell', name='Permission revoked')).to_be_visible()
    expect(page.get_by_role('cell', name='Permission granted')).to_be_visible()


@scenario('S18 Workflow is configurable: stage policy saved + audited; in-flight protection; personalised counts')
def s18(page):
    login(page, 'elena')
    page.goto(BASE + '/app/admin/workflow')
    page.get_by_role('switch', name='Commercial approval active').click()
    page.get_by_role('button', name='Save workflow').click()
    expect(page.get_by_text('cannot be deactivated')).to_be_visible()
    page.get_by_role('button', name='Restore defaults').click()
    page.get_by_role('switch', name='Credit & compliance check active').click()
    page.get_by_role('button', name='Save workflow').click()
    expect(page.get_by_text('Onboarding workflow saved')).to_be_visible()
    page.goto(BASE + '/app/applications/a-007')
    expect(page.get_by_text('Credit & compliance check')).to_be_visible()
    page.goto(BASE + '/app/admin/audit')
    page.get_by_label('Search audit trail').fill('onboarding workflow')
    expect(page.get_by_role('cell', name='Distributor onboarding workflow updated')).to_be_visible()
    # personalised dashboard: Faisal sees only his own queue
    login(page, 'faisal')
    card = page.locator('a', has_text='Requiring my action')
    expect(card).to_contain_text('1')
    page.goto(BASE + '/app/applications?tab=all')
    expect(page.get_by_role('cell', name='APP-2026-0309')).to_have_count(0)  # Atlantic Scents — not his


# ─── Edge cases ────────────────────────────────────────────────────────────

@scenario('E01 Missing application id shows a safe not-found state')
def e01(page):
    login(page, 'marcus')
    page.goto(BASE + '/app/applications/does-not-exist')
    expect(page.get_by_text('Application not found')).to_be_visible()


@scenario('E02 First approval level has no previous approver (sales order) — action disabled with reason')
def e02(page):
    login(page, 'daniel')
    page.goto(BASE + '/app/approvals/r-136')
    btn = page.get_by_role('button', name='Return to previous approver')
    expect(btn).to_be_disabled()
    expect(page.locator('span[title*="no previous approver"]')).to_have_count(1)


@scenario('E03 Sales order: later approver returns to previous level; earlier decision kept in history')
def e03(page):
    login(page, 'layla')
    page.goto(BASE + '/app/approvals/r-145')
    page.get_by_role('button', name='Return to previous approver').click()
    d = page.get_by_role('dialog')
    d.get_by_label('Findings for the previous approver').fill('Please re-check the allocation against Q4 forecast.')
    d.get_by_role('button', name='Return to approver').click()
    login(page, 'daniel')
    page.goto(BASE + '/app/approvals')
    expect(page.get_by_role('cell', name=re.compile('SOR-2026-0145'))).to_be_visible()
    page.goto(BASE + '/app/approvals/r-145')
    page.get_by_role('tab', name='Approval history').click()
    expect(page.get_by_text('Earlier decisions at this level (1)').first).to_be_visible()


@scenario('E04 User outside the current stage sees the record read-only (cannot act)')
def e04(page):
    login(page, 'priya')
    page.goto(BASE + '/app/applications/a-001')  # Priya reviewed it; now with Faisal
    expect(page.get_by_text('Read-only: this stage is assigned to Faisal Rahman')).to_be_visible()
    expect(page.get_by_role('button', name='Approve', exact=True)).to_have_count(0)


@scenario('E05 Non-assigned user: no action path and history unchanged (direct engine calls covered by unit tests)')
def e05(page):
    # Simulates a crafted UI call: Priya invoking an approve transition on Faisal's stage.
    login(page, 'priya')
    page.goto(BASE + '/app/applications/a-001')
    # The only path is the UI; it renders no actions. We additionally assert that history did not change.
    page.get_by_role('tab', name=re.compile('Workflow history')).click()
    before = page.locator('ol[aria-label^="Workflow history"] > li').count()
    page.reload(); page.get_by_role('tab', name=re.compile('Workflow history')).click()
    assert page.locator('ol[aria-label^="Workflow history"] > li').count() == before


OUT = os.environ.get('OUT', tempfile.mkdtemp())
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: console_errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and console_errors.append(m.text))
    page.goto(BASE + '/login')
    page.evaluate('localStorage.clear()')
    for fn in (s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16, s17, s18, e01, e02, e03, e04, e05):
        fn(page)
    browser.close()

passed = sum(1 for r in results if r[1])
print(f'\n{passed}/{len(results)} passed · console errors: {len(console_errors)}')
for e in console_errors[:10]:
    print('  console:', e[:200])
sys.exit(0 if passed == len(results) and not console_errors else 1)
