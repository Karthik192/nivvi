"""Build the illustrated Nivvi handbook from the inspected project snapshot.

Authoring tool only: Python is not an application dependency.
Run from the repository root: python output/pdf/source/build_guide.py
"""
from pathlib import Path
from html import escape
import json
import re

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "output/pdf/Nivvi-Technology-Explained.pdf"
SHOTS = ROOT / "docs/review/phase3"
W, H = A4
M = 43
CW = W - 2 * M
INK = "#202B28"
GREEN = "#284F3B"
MUTED = "#59665F"
LIME = "#D6EF9B"
CREAM = "#F8F8F2"
LINE = "#D8DED4"
PALE = "#E9F4E7"
AMBER = "#FFF1D9"
PURPLE = "#EAE5F7"
WHITE = "#FFFFFF"

fontroot = ROOT / "node_modules/@expo-google-fonts/manrope"
for name, relative in [
    ("Manrope", "400Regular/Manrope_400Regular.ttf"),
    ("ManropeBold", "700Bold/Manrope_700Bold.ttf"),
]:
    pdfmetrics.registerFont(TTFont(name, str(fontroot / relative)))
pdfmetrics.registerFontFamily("Manrope", normal="Manrope", bold="ManropeBold", italic="Manrope", boldItalic="ManropeBold")
pdfmetrics.registerFont(TTFont("Code", "C:/Windows/Fonts/consola.ttf"))
assert 0x20B9 in pdfmetrics.getFont("Manrope").face.charToGlyph, "Rupee glyph missing"

TITLES = [
    "Nivvi, explained", "What you have today", "Your reading map",
    "Getting past the launcher", "Home and Add Expense", "History and Insights",
    "Budgets, goals and Nim", "Light, dark and readable text", "The complete picture today",
    "Code, files and folders", "JavaScript to native screens", "What Expo adds",
    "Node.js, npm and packages", "Metro, USB and localhost", "Android Studio and the SDK",
    "How Android builds the app", "The errors you encountered", "Navigation and application state",
    "Follow one expense", "The design technology", "Motion and the mascot",
    "How we check the work", "Git, GitHub and configuration", "The future backend",
    "The future real login", "Saving offline and synchronizing", "Widgets and future capture",
    "What is built, and what comes next", "Installed mobile libraries - 1",
    "Installed mobile libraries - 2", "Your everyday run guide", "Glossary: A to L",
    "Glossary: M to Z", "Sources and project evidence",
]
TOTAL = len(TITLES)
layout_log = []
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("Nivvi explained - An illustrated beginner's technology guide")
c.setAuthor("Nivvi project guide")
c.setSubject("Current application, development tools, complete technology stack and planned architecture")


def col(value):
    return colors.HexColor(value)


def pheight(text, width, size=11.5, leading=None, bold=False, color=INK):
    style = ParagraphStyle("body", fontName="ManropeBold" if bold else "Manrope", fontSize=size,
                           leading=leading or size * 1.48, textColor=col(color), spaceAfter=0)
    obj = Paragraph(text, style)
    return obj, obj.wrap(width, 2000)[1]


def para(text, y, x=M, width=CW, size=11.5, color=INK, gap=11, bold=False, leading=None):
    obj, height = pheight(text, width, size, leading, bold, color)
    if y - height < 59:
        raise ValueError(f"Page {c.getPageNumber()} overflows at: {text[:75]}")
    obj.drawOn(c, x, y - height)
    layout_log.append({"page": c.getPageNumber(), "bottom": round(y - height, 1), "text": re.sub("<[^>]+>", "", text)[:80]})
    return y - height - gap


def heading(text, y, x=M, width=CW):
    return para(text, y, x, width, size=15, bold=True, gap=9, leading=21)


def card(title, body, y, fill=WHITE, x=M, width=CW, size=11.2):
    _, th = pheight(title, width - 30, 12.4, bold=True)
    _, bh = pheight(body, width - 30, size)
    height = th + bh + 39
    if y - height < 59:
        raise ValueError(f"Card overflow on page {c.getPageNumber()}: {title}")
    c.setFillColor(col(fill))
    c.roundRect(x, y - height, width, height, 14, stroke=0, fill=1)
    yy = para(title, y - 13, x + 15, width - 30, size=12.4, bold=True, gap=7)
    para(body, yy, x + 15, width - 30, size=size, gap=0)
    return y - height - 13


def table(headers, rows, widths, y, size=10.1):
    def cell(text, bold=False):
        return Paragraph(escape(str(text)).replace("\n", "<br/>"), ParagraphStyle("cell", fontName="ManropeBold" if bold else "Manrope", fontSize=size, leading=size * 1.38, textColor=col(INK)))
    data = [[cell(t, True) for t in headers]] + [[cell(t) for t in row] for row in rows]
    obj = Table(data, colWidths=widths, hAlign="LEFT")
    obj.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), col(LIME)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [col(WHITE), col("#F0F1E8")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, col(GREEN)),
    ]))
    _, height = obj.wrap(CW, H)
    if y - height < 59:
        raise ValueError(f"Table overflow, page {c.getPageNumber()}: {height} at {y}")
    obj.drawOn(c, M, y - height)
    return y - height - 16


def code(lines, y, size=10):
    height = len(lines) * 16 + 24
    if y - height < 59:
        raise ValueError("Code overflow")
    c.setFillColor(col("#202C26"))
    c.roundRect(M, y - height, CW, height, 12, stroke=0, fill=1)
    c.setFillColor(col("#F3F4EB"))
    c.setFont("Code", size)
    for i, line in enumerate(lines):
        if pdfmetrics.stringWidth(line, "Code", size) > CW - 28:
            raise ValueError(f"Code line too wide: {line}")
        c.drawString(M + 14, y - 22 - i * 16, line)
    return y - height - 15


def shot(name, x, top, height, label=None):
    path = SHOTS / f"{name}.png"
    im = ImageReader(str(path))
    iw, ih = im.getSize()
    width = height * iw / ih
    c.setFillColor(col(WHITE))
    c.roundRect(x - 4, top - height - 4, width + 8, height + 8, 12, stroke=0, fill=1)
    c.saveState()
    shape = c.beginPath()
    shape.roundRect(x, top - height, width, height, 9)
    c.clipPath(shape, stroke=0)
    c.drawImage(im, x, top - height, width, height, mask="auto")
    c.restoreState()
    if label:
        para(escape(label), top - height - 12, x - 3, width + 6, size=9.3, color=MUTED, gap=0)
    return width


def pair(a, b, y, labels, height=340):
    width = height * 1080 / 2400
    left = M + 48
    right = W - M - 48 - width
    shot(a, left, y, height, labels[0])
    shot(b, right, y, height, labels[1])
    return y - height - 43


def node(x, top, width, height, title, body="", fill=WHITE, dashed=False):
    c.setFillColor(col(fill))
    c.setStrokeColor(col(GREEN))
    c.setLineWidth(0.8)
    if dashed:
        c.setDash(4, 3)
    c.roundRect(x, top - height, width, height, 13, stroke=1 if dashed else 0, fill=1)
    c.setDash()
    yy = para(escape(title), top - 12, x + 13, width - 26, size=12, bold=True, gap=6)
    if body:
        para(body, yy, x + 13, width - 26, size=10.4, gap=0)


def arrow(x1, y1, x2, y2, label=None):
    import math
    c.setStrokeColor(col(GREEN))
    c.setFillColor(col(GREEN))
    c.setLineWidth(1.4)
    c.line(x1, y1, x2, y2)
    angle = math.atan2(y2 - y1, x2 - x1)
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 - 8 * math.cos(angle - .4), y2 - 8 * math.sin(angle - .4))
    path.lineTo(x2 - 8 * math.cos(angle + .4), y2 - 8 * math.sin(angle + .4))
    path.close()
    c.drawPath(path, stroke=0, fill=1)
    if label:
        para(escape(label), (y1 + y2) / 2 + 15, (x1 + x2) / 2 - 58, 116, size=9.1, color=MUTED)


def newpage(num, section, subtitle, badge="IN USE TODAY"):
    assert c.getPageNumber() == num
    c.setFillColor(col(CREAM))
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(col(GREEN))
    c.setFont("ManropeBold", 12)
    c.drawString(M, H - 34, "nivvi.")
    c.setFont("Manrope", 8.7)
    c.setFillColor(col(MUTED))
    c.drawRightString(W - M, H - 33, section.upper())
    c.bookmarkPage(f"p{num}")
    c.addOutlineEntry(f"{num:02d}  {TITLES[num - 1]}", f"p{num}", level=0)
    y = para(TITLES[num - 1], H - 65, size=25, bold=True, leading=32, gap=10)
    y = para(subtitle, y, size=11.3, color=MUTED, gap=13)
    c.setFillColor(col(AMBER if badge.startswith("PLANNED") else PURPLE if badge.startswith("REFERENCE") else PALE))
    bw = pdfmetrics.stringWidth(badge, "ManropeBold", 8.2) + 20
    c.roundRect(M, y - 19, bw, 21, 8, stroke=0, fill=1)
    c.setFillColor(col(GREEN))
    c.setFont("ManropeBold", 8.2)
    c.drawString(M + 10, y - 12, badge)
    return y - 37


def endpage():
    c.setStrokeColor(col(LINE))
    c.line(M, 43, W - M, 43)
    c.setFont("Manrope", 8.2)
    c.setFillColor(col(MUTED))
    c.drawString(M, 27, "Nivvi explained  /  Project snapshot: 10 November 2026")
    c.drawRightString(W - M, 27, f"{c.getPageNumber():02d} / {TOTAL}")
    c.showPage()


def terms(items, y):
    for term, meaning in items:
        y = para(f"<b>{escape(term)}</b> - {escape(meaning)}", y, size=11.1, gap=13)
    return y


# 01: cover
c.setFillColor(col(GREEN)); c.rect(0, 0, W, H, stroke=0, fill=1)
c.bookmarkPage("p1"); c.addOutlineEntry("01  Nivvi, explained", "p1", level=0)
c.setFillColor(col(LIME)); c.setFont("ManropeBold", 24); c.drawString(M, H - 65, "nivvi.")
para("Your app.<br/>Every layer, explained.", H - 104, size=34, leading=43, color=WHITE, bold=True)
para("An illustrated beginner's guide, from the first tap on your phone to the tools that build the app.", H - 216, width=435, size=14, color="#E9F4E7", leading=21)
shot("home-light", 93, 514, 334)
shot("expense-dark", 350, 478, 334)
para("REAL APP SCREENS  +  SIMPLE DIAGRAMS  +  PLAIN LANGUAGE", 120, size=9.4, color=LIME, bold=True)
para("Prepared for Karthik  |  Current preview and future plans are labelled separately.", 91, size=10.5, color=WHITE)
c.setFont("Manrope", 8); c.setFillColor(col("#D8DED4")); c.drawString(M, 35, "10 November 2026  /  No prior programming knowledge needed")
c.showPage()

# 02
y = newpage(2, "Start here", "You are looking at an interactive development preview, not a finished finance service.")
y = card("What already works", "Home, expense/income/refund forms, History, categories, budgets, savings goals, Insights, profile and settings share sample data. Changing an entry updates the other screens immediately.", y)
y = card("Where the data lives", "Today's entries are held in the phone app's temporary memory. Closing/restarting the app or signing out can reset the preview. There is no SQLite ledger or server database connected yet.", y, AMBER)
y = card("What login means today", "The email/password screens demonstrate the experience. They do not create a real account, authenticate with a server or send a reset email. Use sample details only.", y)
y = card("Why your laptop is involved", "This is a development build. Metro on the laptop supplies the app's JavaScript program to the phone. Metro is not a financial backend and does not store your expenses.", y, PALE)
y = para("<b>Important:</b> UPI is currently a payment-method label. The app does not connect to a bank, read SMS, scan notifications or transfer money. Nim is original static artwork; original animated Rive files are still missing.", y, size=11.2)
endpage()

# 03
y = newpage(3, "Reading map", "Read in order, or jump directly to the question you have.", "REFERENCE")
groups = [
    ("I want to understand the screens", "Pages 4-8", "Onboarding, Home, expenses, History, Insights, goals, themes and accessibility.", 4),
    ("I want to understand the technology", "Pages 9-23", "Code, React Native, Expo, Metro, Android Studio, builds, state, design, motion, testing and Git.", 9),
    ("I want to know what comes later", "Pages 24-28", "Backend, real login, databases, offline sync, Android widgets and approval gates.", 24),
    ("I want exact package names", "Pages 29-30", "The actual installed direct mobile dependencies and what each one contributes.", 29),
    ("I just want to open the app", "Page 31", "A practical daily checklist, sample preview details and launcher instructions.", 31),
    ("I need a word explained", "Pages 32-34", "A quick glossary plus official documentation and local project evidence.", 32),
]
for title, pages, body, dest in groups:
    top = y
    y = card(f"{title}  |  {pages}", body, y)
    c.linkRect("", f"p{dest}", (M, y + 13, W - M, top), relative=0, thickness=0)
y = para("<b>How pictures are used:</b> product screenshots are real Phase 3 Android emulator captures. Architecture drawings are explanatory illustrations, not screenshots of implemented servers or widgets. Screenshots stay sharp when you zoom.", y, size=10.6, color=MUTED)
endpage()

# 04
y = newpage(4, "The screens", "The development launcher comes before the Nivvi app itself.")
y = pair("onboarding-light", "login-light", y, ["1. Nivvi introduction", "2. Preview sign-in"], 328)
y = para("<b>If you see 'Development servers':</b> you are in Expo's launcher. It is waiting for the laptop's Metro server. Connect to that server first; then these Nivvi screens appear.", y)
y = para("<b>Inside Nivvi:</b> finish the introduction or tap Skip introduction. Enter sample email <b>preview@example.com</b> and sample password <b>Preview123</b>, then tap <b>Enter preview</b>. This opens Home.", y)
y = card("These are demonstration details", "They are not a real username/password pair. There is no account registration service behind this preview. The profile and records reset with the session.", y, AMBER, size=10.8)
endpage()

# 05
y = newpage(5, "The screens", "A monthly overview and a form that changes it.")
y = pair("home-light", "expense-light", y, ["Home: sample monthly totals", "Add Expense: manual entry"], 332)
y = para("<b>Home:</b> the sample monthly budget is ₹30,000. Expenses minus refunds are ₹17,550, so the remaining budget is ₹12,450. This is a spending-plan calculation, not a bank balance.", y)
y = para("<b>Add Expense:</b> enter an amount, pick a category and save. Payment method defaults to UPI as metadata. Expand details to change date/payment method or add merchant and note. The Save action stays below the scrollable form.", y)
y = para("<b>Add Income</b> records money received. A <b>refund</b> links to an existing expense and reduces net spending on its refund date. None of these actions performs a payment.", y, size=11.1)
endpage()

# 06
y = newpage(6, "The screens", "Your entries become a searchable history and a financial summary.")
y = pair("history-light", "insights-chart-dark", y, ["History: real preview rows", "Insights: derived weekly chart"], 332)
y = para("<b>History:</b> search by merchant, note or category. The expandable panel contains month, type, category, payment-method and sorting controls. Tap a row to see details, edit it or confirm deletion.", y)
y = para("<b>Insights:</b> computes weekly/monthly spending, category and merchant summaries, and comparisons from those same records. It does not download bank statements or use an AI prediction model.", y)
y = para("The sample data is concentrated early in the month, so a weekly chart can contain one large bar and several zero values. Exact values are also written as text; a negative net amount is retained in the numbers.", y, size=11.1)
endpage()

# 07
y = newpage(7, "The screens", "Planning tools give the numbers a purpose.")
y = pair("goal-reached", "budget-validation", y, ["A goal reaches its target", "A budget rejects invalid allocation"], 318)
y = para("<b>Budgets:</b> set a monthly limit and optional category limits. Combined category limits must fit inside the monthly limit. Errors explain what to change rather than silently saving an inconsistent plan.", y)
y = para("<b>Goals:</b> set a target and track contributions. Reaching the target reveals milestones and Nim's happy artwork. A contribution records your intention; it does not transfer money or add a ledger expense.", y)
y = card("Who is Nim?", "Nim is Nivvi's original companion. Different static states communicate calm, attention and celebration. Real Rive state-machine animation remains pending until original .riv assets are supplied and tested.", y, PALE, size=10.8)
endpage()

# 08
y = newpage(8, "The screens", "The same product has two deliberate themes and supports larger system text.")
y = pair("home-dark", "home-system-font-200", y, ["Dark theme at normal text size", "Actual 200% Android text setting"], 325)
y = para("<b>Theme:</b> Settings can follow the system or use light/dark explicitly. Shared colour roles change together; dark mode uses its own surfaces and accents.", y)
y = para("<b>Readability:</b> supporting text starts at 14sp and body text at 16sp. Android can enlarge it. Cards and navigation reflow, and the tab bar grows instead of cutting off tall labels; long labels may wrap.", y)
y = para("<b>Accessibility:</b> controls have labels and meaningful states, and decorative motion can be reduced. Contrast checks passed, but a complete TalkBack speech/focus review and a full accessibility audit are still outstanding.", y, size=11.1)
endpage()

# 09
y = newpage(9, "The whole system", "Two working places today: the development computer and the phone.")
top = y
node(M, top, 223, 170, "Your Windows laptop", "Source files<br/>Node.js + npm<br/>Expo CLI + Metro<br/>Android Studio + Android SDK", PALE)
node(W - M - 223, top, 223, 170, "Your Android phone", "Installed development APK<br/>Hermes + React Native<br/>Nivvi screens<br/>Temporary Zustand records", WHITE)
arrow(M + 223, top - 91, W - M - 223, top - 91)
para("USB / ADB", top - 127, M + 224, CW - 446, size=7.9, color=MUTED)
y = top - 193
y = card("During development", "The laptop builds/serves the program. The phone runs the interface and keeps preview entries in its own memory. A USB reverse connection lets the phone reach Metro at port 8081.", y)
node(M, y, CW, 100, "Future: API + PostgreSQL", "A real backend will serve accounts and cross-device financial records. It is planned, not running behind today's app.", AMBER, dashed=True)
y -= 119
y = para("<b>Three different jobs:</b> Metro supplies developer code; a future API will process financial requests; a database will persist records. Calling all three 'the server' hides an important difference.", y)
y = para("A normal release build bundles its application code and does not need your laptop or Metro. That future packaging is separate from adding a backend and separate from offline storage.", y)
endpage()

# 10
y = newpage(10, "The basics", "A project is a set of files that describe appearance, behaviour and build instructions.")
y = terms([
    ("Source code", "human-readable instructions written by developers."),
    ("Program / application", "the running result of those instructions."),
    ("Component", "a reusable interface piece, such as a button, card or input."),
    ("Library / package", "reusable code provided as a dependency."),
    ("Terminal / PowerShell", "a place to type commands that start tools or builds."),
], y)
y = code(["expense-tracker/", "  apps/mobile/          # current Expo application", "    app/                # navigable routes", "    src/features/       # product screens + rules", "    src/components/     # shared buttons/cards/etc.", "    plugins/            # repeatable native settings", "  design/               # brand tokens + artwork", "  docs/                 # proposals + review evidence", "  package.json          # workspace commands", "  package-lock.json     # exact dependency tree"], y, 9.3)
y = para("<b>Monorepo</b> means related projects live in one repository. Today the active npm workspace is mobile. Backend/shared/native-widget areas are planned as the corresponding phases arrive; a proposed folder is not proof of an implemented service.", y, size=11.1)
endpage()

# 11
y = newpage(11, "Languages and interface", "Four related names, each with a different job.")
y = table(["Technology", "Plain meaning", "Example in Nivvi"], [
    ["JavaScript", "A programming language that describes behaviour.", "Calculate a total or respond to a tap."],
    ["TypeScript", "JavaScript with types checked by development tools.", "Require an amount to be a number and a transaction type to be valid."],
    ["React", "A component model for updating UI from changing state.", "A total changes when the transaction records change."],
    ["React Native", "Uses React to build a native mobile interface.", "Android text, input, scrolling and native screen behaviour."],
], [97, 205, CW - 302], y, 10.5)
y = code(["// Simplified teaching example, not the full source:", "type Expense = { amountPaise: number };", "const expense: Expense = { amountPaise: 12550 };", "// A React Native component can display this amount."], y, 9.2)
y = para("<b>TypeScript is not a database or a security system.</b> It catches many coding mistakes before the app runs, but user input still needs runtime validation. A future server must validate and authorize requests too.", y)
y = para("Most application code is .ts or .tsx. TSX allows component markup inside TypeScript. Native libraries also contain Kotlin, Java and C++ code; you do not manually write all of those layers for every screen.", y)
endpage()

# 12
y = newpage(12, "Expo", "Expo supplies a coordinated development toolkit around React Native.")
y = card("Expo SDK", "A versioned collection of compatible libraries, native modules and tools. This project uses Expo SDK 58 with React Native 0.88.1 and React 19.3.0. These versions are a selected set, not interchangeable numbers.", y)
y = card("Expo CLI and config", "The CLI is the command-line tool used by npx expo. app.config.ts describes the app name, package ID, icon, scheme, plugins and build environment. 'npx expo prebuild' generates the native Android project from that configuration.", y)
y = card("Config plugins", "Repeatable changes to generated native files. Our plugins preserve font-scale handling and select newer CMake on Windows. They avoid relying on edits that disappear when Android is regenerated.", y, PALE)
y = table(["Build/app", "What it means here"], [
    ["Expo Go", "A general-purpose preview app with a fixed set of native modules; not this project's native acceptance environment."],
    ["Development build", "Our custom native app including Rive/Nitro and the Expo developer launcher. Uses Metro while developing."],
    ["Release build", "Future distribution packaging with bundled code. Today's production preview routes are deliberately guarded; switching to release is not a shortcut to a finished app."],
], [128, CW - 128], y, 10.3)
endpage()

# 13
y = newpage(13, "Computer-side tools", "Node.js runs tools; npm manages their packages.")
y = card("Node.js", "A runtime that executes JavaScript outside a web browser. On your laptop it runs Expo CLI, Metro and other tooling. Node.js is also planned for the future backend, but no finance backend is implemented today.", y)
y = card("npm and npx", "npm installs dependencies and runs project scripts. npx launches a package's command, such as expo. A dependency is reusable code that the project needs; a development dependency mainly supports building or checking it.", y)
y = card("package.json and package-lock.json", "The first lists packages and commands. The lockfile records exact resolved versions so a fresh installation can reproduce the dependency tree. A ~ or ^ in a package entry describes a permitted update range; it is not the resolved installed version.", y)
y = card("npm workspaces", "Connect the mobile project to the root package setup. One root lockfile prevents separate installations from drifting apart. Version overrides keep React and React DOM on the selected compatible pair.", y, PALE)
y = para("Examples: <b>npm test</b> runs automated tests; <b>npm run lint</b> checks code rules. These do not launch the user interface. A normal daily review does not require reinstalling all dependencies.", y)
endpage()

# 14
y = newpage(14, "The connection", "Why '127.0.0.1:8081' appears when you run the app.")
node(M, y, 223, 126, "Laptop: Metro", "Bundles application code<br/>Listens on port 8081<br/>Runs under Node.js", PALE)
node(W - M - 223, y, 223, 126, "Phone: dev client", "Requests the program<br/>Executes it with Hermes<br/>Displays Nivvi", WHITE)
arrow(M + 223, y - 66, W - M - 223, y - 66)
y -= 147
y = card("Localhost = this device", "127.0.0.1 normally points back to the device making the request. On the phone it normally means the phone, not your laptop. 'adb reverse tcp:8081 tcp:8081' creates the USB mapping needed for this development connection.", y)
y = card("Port = a numbered service entrance", "8081 is the local port used by Metro here. It is not an account number, payment port or remote finance service. The HTTP URL tells the client where to fetch development code.", y)
y = card("Metro and Fast Refresh", "Metro resolves imports and packages the code. Fast Refresh updates many screen-code changes during development. Native dependency/configuration changes can still require rebuilding the Android app.", y)
y = para("If Metro stops or USB reverse is lost, the launcher or a loading message can appear. The current app does not become a standalone offline app just because an APK is installed.", y, size=11.1)
endpage()

# 15
y = newpage(15, "Android tools", "An editor, a toolkit, a virtual phone and a physical phone are different things.")
y = table(["Name", "Job"], [
    ["Android Studio", "The IDE: a graphical workspace for importing the Android project, syncing Gradle, building, running and debugging."],
    ["Android SDK", "Software Development Kit: Android platform APIs, build tools and platform tools installed on the computer."],
    ["ADB", "Android Debug Bridge: communicates with a connected device, installs APKs, reads logs and creates USB port mappings."],
    ["Emulator / AVD", "Android Virtual Device: a phone simulated on the laptop. Pixel_7 API 34 was used for the main screen captures."],
    ["Physical device", "Your actual phone. The I2220 phone was connected and showed Home/Add Expense after the server was opened."],
], [126, CW - 126], y, 10.6)
y = heading("Android version is not CPU architecture", y)
y = para("An <b>API level</b> describes Android platform capabilities. An <b>ABI</b> describes the compiled machine-code interface for a processor family. Your phone build used <b>arm64-v8a</b>; the tested desktop emulator uses <b>x86_64</b>.", y)
y = para("<b>compileSdk</b> chooses the Android APIs available while compiling. <b>targetSdk</b> selects the platform behaviour level the app targets. <b>minSdk</b> is the oldest supported Android API. They are not Expo or AGP version numbers.", y)
y = para("An APK needs compatible native libraries for its target device. A build verified for ARM64 alone is not proof of a new x86_64 emulator build.", y, size=11.1)
endpage()

# 16
y = newpage(16, "The native build", "Two kinds of code meet inside the Android application.")
node(M, y, 242, 85, "Application code", "Metro supplies a development bundle<br/>Hermes executes it on the phone", PALE)
node(W - M - 242, y, 242, 85, "Native code", "Kotlin / Java / C++ components<br/>Gradle builds the installed APK", WHITE)
arrow(M + 121, y - 85, W / 2 - 40, y - 119)
arrow(W - M - 121, y - 85, W / 2 + 40, y - 119)
node(M + 140, y - 125, CW - 280, 61, "Running Android app", "Native shell + supplied program", LIME)
y -= 205
y = table(["Tool / language", "Its part of the build"], [
    ["Gradle + wrapper", "Coordinates tasks; gradlew.bat uses the project's Gradle version."],
    ["AGP", "Android Gradle Plugin: adds Android-specific build, packaging and native tasks."],
    ["JDK / JBR", "Java Development Kit tooling runs Gradle. Studio bundles JetBrains Runtime (JBR)."],
    ["Kotlin + Java", "Languages used by the generated Android shell and native libraries; widget-specific Kotlin is still planned."],
    ["NDK + C++ + Clang", "The native toolkit/language/compiler used by React Native and native modules."],
    ["CMake + Ninja", "CMake configures the C++ build; Ninja executes its compile/link steps."],
    ["Hermes", "The JavaScript engine running application logic on the phone. It is not Metro, Node.js or a database."],
], [127, CW - 127], y, 10.1)
endpage()

# 17
y = newpage(17, "The errors explained", "The tools failed before the product screen could run; your expense form was not the cause.")
y = card("1. AGP 9.2.1 was newer than the old Studio supported", "The previous Panda 3 IDE supported AGP only through 9.1.1. The React Native toolchain selected 9.2.1. Studio was upgraded to 2026.2.2; the project did not force AGP down to a different version.", y)
y = card("2. 'Filename longer than 260 characters'", "CMake 3.22.1 supplied an older Ninja that could not handle the long generated C++ object path. Windows long-path support was already enabled. A Windows-only config plugin now selects installed CMake 4.1.2 / Ninja 1.12.1 for both Studio and command-line builds.", y)
y = card("3. 'Development servers' or 'Loading from 127.0.0.1'", "The installed development launcher still needs Metro and a reachable connection. USB reverse was configured. Slow/stalled bundle loading recovered after restarting Metro with a cleared cache and reopening the client.", y)
y = card("What was actually verified", "ARM64 debug assembly passed in 9m24s, including the previously failing CMake task. The APK contains the ARM64 application library. The phone subsequently displayed onboarding, Home and Add Expense. This is not a release-performance or full physical-device QA result.", y, PALE, size=10.8)
endpage()

# 18
y = newpage(18, "Routes and state", "Navigation chooses the screen; state supplies its changing values.")
y = table(["Technology", "What it owns in today's app"], [
    ["Expo Router", "Maps files under app/ to routes. home.tsx, transaction.tsx and other route files compose feature screens."],
    ["react-native-screens", "Native screen primitives used by the navigation stack."],
    ["Safe Area Context", "Insets that keep content away from system bars, cutouts and navigation areas."],
    ["React local state", "An unfinished form amount, a visible error or an expanded filter panel."],
    ["React Context", "Shared theme and system motion preference context."],
    ["Zustand", "The small, shared in-memory preview store: profile, transactions, categories, budgets and goals."],
], [130, CW - 130], y, 10.5)
y = card("One store, several views", "Home, History and Insights read the same records. Saving in the form changes the store; subscribed screens recalculate their displays. The preview does not maintain a different financial database for each screen.", y, PALE)
y = para("<b>Today's route guards</b> require a development build and preview profile to enter product screens. They prevent accidentally showing sample flows in a production build. They are not real authentication or server authorization.", y)
endpage()

# 19
y = newpage(19, "One transaction, end to end", "Imagine you manually record a food expense of ₹125.50.")
steps = [
    ("1. You enter text", "The amount field contains the text 125.50; the category is Food."),
    ("2. Shared rules validate it", "The code checks a positive amount, valid category/date and supported payment method."),
    ("3. Convert to integer paise", "₹125.50 becomes 12,550 paise. Money calculations use bounded whole-number paise rather than accumulating decimal floating-point errors."),
    ("4. Update the in-memory store", "A new transaction with an ID and timestamps enters the preview records. Duplicate presses are guarded."),
    ("5. Recalculate the views", "The sample net spending ₹17,550 becomes ₹17,675.50. A ₹30,000 budget leaves ₹12,324.50. History gets a row and Insights changes."),
    ("6. Know the current limit", "This update is in RAM only. It is not a bank payment, SQLite write or server-synced transaction."),
]
for title, body in steps:
    y = card(title, body, y, PALE if title.startswith("3") else WHITE, size=10.7)
endpage()

# 20
y = newpage(20, "Design technology", "The visual language is shared code, not a collection of screenshots.")
y = card("Design tokens + StyleSheet", "Tokens are named values for colour roles, typography, spacing, rounded corners and motion. React Native StyleSheet turns these choices into native component styling. NativeWind was an option in the brief, but it is not installed or required by today's implementation.", y)
y = card("Manrope and expo-font", "Manrope is the bundled font family. expo-font loads the font weights; the splash screen waits for font setup, with a fallback if loading fails. Consistent typography makes labels, amounts and helper text feel related.", y)
y = card("SVG, icons and illustrations", "SVG (Scalable Vector Graphics) describes shapes mathematically rather than as a fixed pixel grid. react-native-svg draws category icons, charts and original static Nim artwork. PNG files are used for app icons and screenshots.", y)
y = card("Theme and accessibility roles", "Roles such as ink, muted, primary and warning select purposeful colours in each theme. Text scaling, touch-target size, focus labels and reduced motion belong to usability, not just decoration.", y, PALE)
y = para("The app uses actual interactive components. The pictures in this handbook document those components; screenshots are not the implementation of the app itself.", y)
endpage()

# 21
y = newpage(21, "Animation and native modules", "Several technologies help movement, but each solves a different problem.")
y = table(["Name", "Its role and current status"], [
    ["Reanimated", "In use for interface feedback, progress and transitions. Animations respect the reduced-motion policy."],
    ["Worklets", "Small functions that can execute in a worklet runtime; used by the installed animation stack for responsive UI work."],
    ["Gesture Handler", "Native gesture infrastructure; supports interactions more robustly than implementing every touch pattern manually."],
    ["Rive", "Installed native runtime and fallback adapter. Intended for interactive mascot state-machine animation; original .riv asset rendering/bindings are not yet verified."],
    ["Nitro Modules", "Native-module framework used by the selected Rive runtime. It connects JavaScript-facing objects with native implementations."],
    ["Hermes", "Executes the app's JavaScript. A runtime, not a mascot renderer."],
    ["Lottie", "An optional animation format/tool from the brief. Not installed or used in today's app."],
], [112, CW - 112], y, 10.3)
y = card("Static Nim is the honest fallback", "Saving, goal completion and budget attention have defined emotional meanings, but a successful native library build does not mean original character animation files exist. Common actions do not wait for a celebration animation to finish.", y, AMBER, size=10.9)
endpage()

# 22
y = newpage(22, "Quality checks", "Different checks find different classes of mistakes.")
y = table(["Tool / check", "What it checks"], [
    ["TypeScript 6.0.3", "Types, imports and consistency before execution."],
    ["ESLint + Hooks rules", "Code mistakes, React-hook usage and project conventions."],
    ["typescript-eslint", "TypeScript-aware linting configuration and rules."],
    ["Prettier 3.9.10", "Consistent automatic code formatting."],
    ["Jest + jest-expo", "Repeatable logic tests with Expo-compatible test configuration."],
    ["Expo Doctor / install check", "Project health and dependency compatibility with the selected SDK."],
    ["ADB + UIAutomator", "Native-device control, visible text assertions, screenshots and logs."],
    ["Contrast verifier", "The project's selected text/background contrast pairs and token invariants."],
], [154, CW - 154], y, 10.4)
y = card("Evidence, not a production-readiness badge", "The current logic suite has 37 passing tests across four suites. Types, lint and formatting pass; the ARM64 build passed. Phase 3 recorded 52 design contrast checks. Some combined native test runs failed; focused reruns and limitations are documented rather than hidden.", y, PALE, size=10.7)
y = para("Still outstanding: full TalkBack speech/focus review, authored Rive animation acceptance, release-device performance and the later security phase. One emulator input timeout under concurrent export was recorded; its root cause was not established.", y, size=10.7)
endpage()

# 23
y = newpage(23, "Files, history and settings", "Tools for maintaining the project are not the same as the running app.")
y = card("Git and GitHub", "Git records meaningful local revisions called commits. GitHub hosts the remote repository. 'Commit' means record locally; 'push' means send commits to the remote. Having a GitHub repository does not automatically host an API or publish an Android app.", y)
y = card("Configuration and secrets", "Environment settings describe which build/environment to use. Public mobile configuration can be inspected and cannot hide secrets. .gitignore keeps generated output and local machine settings out of version control; it is not encryption.", y)
y = table(["File / tool", "Meaning in this project"], [
    [".ts / .tsx", "Typed logic / typed components with UI markup."],
    [".cjs / .json", "CommonJS tooling plugin / structured configuration or data."],
    [".kt / .cpp / .so", "Kotlin source / C++ source / compiled native library."],
    [".riv / .apk", "Rive asset file / installable Android package."],
    [".env / local.properties", "Environment overrides / local Android SDK path; handle local settings carefully."],
    ["CLAUDE.md / AI agent", "Contributor instructions / an assistant that can edit and test code. Codex and Claude Code are development assistants, not app runtime libraries."],
], [146, CW - 146], y, 10.4)
endpage()

# 24
y = newpage(24, "The planned service", "A backend is a program that receives requests and enforces business rules.", "PLANNED - NOT IMPLEMENTED")
top = y
for i, (title, body) in enumerate([
    ("Mobile app", "Sends a request such as: create my expense"),
    ("Node.js + Express", "Runs the API and routes the request"),
    ("Validation + authorization", "Checks the input and the authenticated owner"),
    ("Prisma + PostgreSQL", "Writes or reads durable database records"),
]):
    node(M + 35, top - i * 92, CW - 70, 68, title, body, AMBER, dashed=True)
    if i < 3:
        arrow(W / 2, top - i * 92 - 68, W / 2, top - i * 92 - 86)
y = top - 385
y = para("<b>REST</b> (Representational State Transfer) organizes resource-based HTTP APIs. GET reads; POST creates; PATCH edits; DELETE removes. <b>JSON</b> (JavaScript Object Notation) carries structured data. HTTPS protects it in transit.", y)
y = para("<b>SQL</b> (Structured Query Language) queries relational databases. <b>PostgreSQL</b> is the proposed server database. <b>Prisma ORM</b> provides typed access and schema migrations. <b>Zod</b> validates input at runtime. Tables will link users and financial records.", y)
y = para("The server must derive the user from authentication and scope every financial lookup to that owner. Database constraints and transactions protect consistency. Proposed endpoint/schema documents are designs, not deployed APIs.", y, size=11)
endpage()

# 25
y = newpage(25, "The planned real account", "Today's form preview will later be replaced by genuine authentication.", "PLANNED - NOT IMPLEMENTED")
y = card("Password hashing", "The proposed backend uses Argon2id to store a password hash rather than the original password. Hashing is a one-way check; it is not the same as encrypting and later reading a password.", y, AMBER)
y = card("JSON Web Token (JWT): access token", "A short-lived signed credential lets the API identify an authenticated session. A signed JWT is not automatically encrypted, so secret financial data should not be placed in its readable payload.", y, AMBER)
y = card("Refresh token + SecureStore", "A refresh credential obtains a new access token. The design rotates refresh tokens and detects reuse. Expo SecureStore is planned for protected credential storage on the device; it is not the financial database and is not integrated today.", y, AMBER)
y = card("Authorization, reset and logout", "Login identifies the user; authorization decides which records that user may access. Real password reset needs an email-delivery flow. Logout must invalidate the right session and handle device data safely. Email-verification friction will be assessed per sensitive action.", y, AMBER)
y = para("No real authentication, token storage, password hashing service or email sending is implemented in the current preview. Attractive login screens alone do not provide security.", y, size=11, bold=True)
endpage()

# 26
y = newpage(26, "The planned data layers", "Temporary memory, local storage and a remote database serve different purposes.", "PLANNED - NOT IMPLEMENTED")
y = table(["Layer", "Meaning"], [
    ["Today's Zustand preview", "RAM-only sample records. Not durable, not synchronized."],
    ["SQLite on the phone", "A future local database that can retain entries after app restart and support offline transactions."],
    ["TanStack Query", "Future API request/cache/retry state. It does not by itself become an offline ledger or a synchronization engine."],
    ["PostgreSQL on the server", "Future durable cross-device/account data, accessed through the authorized API."],
], [151, CW - 151], y, 10.8)
y = card("Offline-first save", "Phase 6 will save the entry and a pending operation in SQLite atomically. The screen can confirm 'saved on this device' even while the network is unavailable. That is different from 'synced to the server'.", y, AMBER)
y = card("Outbox, retry and conflicts", "An outbox is a durable queue of pending changes. Stable operation IDs help avoid duplicates when retrying. Versions/conflict rules handle competing edits rather than silently overwriting money records. Background execution remains subject to Android's scheduling limits.", y, AMBER)
y = para("A basic personal tracker can work with local storage alone; a backend adds shared account services and cross-device records. In this project neither SQLite nor server sync is implemented yet. Keep these abstractions small until the approved phase needs them.", y, size=11)
endpage()

# 27
y = newpage(27, "The planned Android widget", "A launcher widget is a small native surface with platform limits.", "PLANNED - NOT IMPLEMENTED")
node(M + 32, y, CW - 64, 99, "Home-screen widget", "Monthly spending snapshot + quick-entry action<br/>Illustration of planned architecture, not an implemented widget", AMBER, dashed=True)
arrow(W / 2, y - 99, W / 2, y - 123)
node(M + 32, y - 129, CW - 64, 91, "Compact Android entry Activity", "Amount/category input -> durable private handoff<br/>Not a regular editable field inside the launcher widget", AMBER, dashed=True)
y -= 241
y = para("<b>Kotlin</b> is the planned language for this isolated Android functionality. <b>Jetpack Glance</b> helps describe widget UI, but widgets have stricter interaction/update rules than normal app screens.", y)
y = para("The design uses a small entry Activity for typing and a durable handoff to the application. It must handle the JavaScript process being stopped, account changes, retries and stale summaries. Locally saved and server-synced states must be distinct.", y)
y = card("Future capture integrations are separate", "UPI notification capture, bank SMS parsing, Account Aggregator and automatic categorization remain future possibilities. They are outside the initial release scope and are not silently enabled permissions or services in today's app.", y, AMBER, size=10.9)
y = para("Widget acceptance later requires both emulator and real-device testing. A drawing of a widget is not proof that the native feature works.", y, size=11)
endpage()

# 28
y = newpage(28, "Roadmap and boundaries", "One phase at a time, with an explicit review before the next major phase.", "REFERENCE - STATUS SNAPSHOT")
y = table(["Phase", "Status / purpose"], [
    ["0 - Architecture", "Proposal and technical foundation approved."],
    ["1 - Brand/design", "Original Nivvi/Nim direction, tokens and design foundation approved; original Rive files remain missing."],
    ["2 - Mobile foundation", "Approved native Expo foundation; documented asset/accessibility/device qualifications remain."],
    ["3 - Interactive UI", "Implemented with mock data and scoped verification; awaiting review. Toolchain fixes support running it locally."],
    ["4 - Backend", "Planned: PostgreSQL, Prisma, Express, real auth and owned REST APIs."],
    ["5 - Integration", "Planned: connect the mobile UI to actual API/database records."],
    ["6 - Offline", "Planned: SQLite durability, outbox, retries and synchronization."],
    ["7 - Widget", "Planned: isolated Kotlin/Glance quick-entry feature."],
    ["8 - Polish", "Planned: refined motion and real mid-range-device measurements."],
    ["9 - QA/security", "Planned: broader isolation, security, accessibility and performance review."],
    ["10 - Release", "Planned: production setup, signed Android build and approved deployment/publishing."],
], [134, CW - 134], y, 10.2)
y = para("<b>Not selected for today's implementation:</b> NativeWind and Lottie. <b>Not implemented:</b> backend services, TanStack Query integration, SQLite, SecureStore authentication, native widget and banking automation. Web/iOS support is not a tested released product.", y, size=10.6)
endpage()


def installed(name):
    for base in [ROOT / "apps/mobile/node_modules", ROOT / "node_modules"]:
        file = base / name / "package.json"
        if file.exists():
            return json.loads(file.read_text(encoding="utf8"))["version"]
    raise RuntimeError(f"Installed package not found: {name}")


runtime = [
    ("react", "Component model and state-driven rendering."),
    ("react-native", "Native mobile UI and platform integration."),
    ("expo", "SDK and native/tooling integration."),
    ("expo-router", "File-based screens and navigation."),
    ("expo-dev-client", "Custom development launcher and client."),
    ("@expo/metro-runtime", "Runtime support for Metro-based Expo apps."),
    ("zustand", "Shared in-memory preview store."),
    ("react-native-reanimated", "Native interface animation support."),
    ("react-native-worklets", "Worklet runtime infrastructure."),
    ("react-native-gesture-handler", "Native gesture handling."),
    ("@rive-app/react-native", "Rive native runtime; original asset pending."),
    ("react-native-nitro-modules", "Native module framework required by Rive."),
    ("react-native-svg", "SVG icons, illustrations and charts."),
    ("react-native-safe-area-context", "Screen safe-area inset handling."),
    ("react-native-screens", "Native screen/navigation primitives."),
    ("@expo-google-fonts/manrope", "Bundled Manrope font files."),
    ("expo-font", "Font loading."),
    ("expo-splash-screen", "Native splash-screen handoff."),
    ("expo-status-bar", "Status-bar appearance."),
    ("expo-system-ui", "System-level UI/background integration."),
    ("expo-linking", "App URLs and deep-link helpers."),
    ("expo-constants", "App/runtime configuration information."),
    ("react-dom", "React renderer for the web target, not Android UI."),
    ("react-native-web", "Web-compatible React Native components; not a released web product."),
]
manifest = json.loads((ROOT / "apps/mobile/package.json").read_text(encoding="utf8"))
assert {name for name, _ in runtime} == set(manifest["dependencies"]), "Inventory misses a direct runtime dependency"

for page, group in [(29, runtime[:12]), (30, runtime[12:])]:
    y = newpage(page, "Exact library inventory", "Resolved installed versions, read from this workspace - not a claim about the latest releases.", "REFERENCE - DIRECT DEPENDENCIES")
    y = table(["Package", "Installed", "Why it is here"], [[name, installed(name), desc] for name, desc in group], [197, 62, CW - 259], y, 9.8)
    y = para("These are the mobile project's direct runtime dependencies. Dependencies also bring smaller transitive packages, which are recorded in package-lock.json; they are not all separate product features.", y, size=10.6)
    if page == 30:
        y = para("Developer-only helpers also include <b>tsx</b> to load TypeScript configuration, <b>@types/react</b>, <b>@types/node</b> and <b>@types/jest</b> for type definitions. Types describe APIs during development; they do not add a server or save records.", y, size=10.4)
    endpage()

# 31
y = newpage(31, "Daily use", "For the current development build, the laptop and phone work together.", "REFERENCE - PRACTICAL CHECKLIST")
y = heading("1. Start Metro on the laptop", y)
y = code(["cd D:\\Projects\\expense-tracker\\apps\\mobile", "npx expo start --dev-client --localhost --port 8081 --max-workers 2"], y, 9.0)
y = heading("2. Connect the phone", y)
y = para("Connect USB and approve the normal USB-debugging prompt if shown. In a terminal where adb is available, list devices and reverse the port. Replace YOUR_DEVICE_SERIAL with your phone's ID; it is needed when more than one device is connected.", y, size=10.9)
y = code(["adb devices", "adb -s YOUR_DEVICE_SERIAL reverse tcp:8081 tcp:8081"], y, 9.2)
y = heading("3. Open Nivvi Dev", y)
y = para("Android Studio can install/open the debug app. If you see Development servers, select the running Metro server or enter <b>http://127.0.0.1:8081</b> in the launcher's URL field. Wait for bundling to finish; leave Metro running.", y, size=10.9)
y = heading("4. Enter the product preview", y)
y = para("Skip/finish the introduction. Use sample email <b>preview@example.com</b> and sample password <b>Preview123</b>, then Enter preview. Home exposes Add Expense/Add Income and the History, Insights and Goals tabs.", y, size=10.9)
y = card("If loading stalls", "Restart Metro with the same command plus --clear, wait until it says it is ready, then reopen the client. Reconnect USB reverse if needed. Do not run multiple Metro servers on port 8081. Switching to a release build is not a fix: today's production guard intentionally blocks the sample product routes.", y, AMBER, size=10.5)
endpage()

# 32
y = newpage(32, "Quick dictionary", "A word is easier to remember when you can connect it to one concrete job.", "REFERENCE")
y = terms([
    ("ABI", "the machine-code interface for a processor family, such as arm64-v8a."),
    ("ADB", "the computer-to-Android debugging and communication tool."),
    ("AGP", "Android Gradle Plugin; adds Android build tasks to Gradle."),
    ("API", "Application Programming Interface: a way to request capabilities or data. A REST API is a network-facing kind."),
    ("APK", "an installable Android application package."),
    ("Backend", "a service that handles requests, accounts and authorized data operations."),
    ("Build / compile", "turn source/configuration into executable output for a target."),
    ("Cache", "a reusable copy kept to avoid doing the same work again; not automatically durable financial storage."),
    ("Component", "a reusable piece of interface or behaviour."),
    ("Database", "structured storage that can retain and query records."),
    ("Dependency", "another package the project relies on."),
    ("Development client", "our custom debug app that can connect to Metro."),
    ("Environment", "the settings for a particular way of running/building the app."),
    ("Hermes", "the engine that executes JavaScript in this mobile app."),
    ("Localhost", "the device making the request itself; usually 127.0.0.1."),
], y)
endpage()

# 33
y = newpage(33, "Quick dictionary", "Keep the ownership of code, state and stored data separate.", "REFERENCE")
y = terms([
    ("Metro", "the development bundler/server supplying application code."),
    ("Migration", "a versioned change to a database schema."),
    ("Monorepo", "one repository containing related projects/packages."),
    ("Native", "code or UI using the mobile platform's capabilities directly."),
    ("Node.js", "a JavaScript runtime on the computer or a future backend server."),
    ("Offline-first", "designing writes to succeed durably on-device before network synchronization."),
    ("ORM", "Object-Relational Mapping: tooling that maps application structures to database operations."),
    ("Outbox", "a durable queue of changes waiting to synchronize."),
    ("Port", "a numbered network-service endpoint; Metro uses 8081 here."),
    ("RAM", "temporary working memory; today's preview records live here."),
    ("Repository", "a code project under Git, or in architecture a data-access boundary; context matters."),
    ("SDK / NDK", "Software Development Kit / Native Development Kit; Android toolkits for application and C/C++ work."),
    ("State", "values the interface reads and changes while it runs."),
    ("Token", "a named design value, or in authentication a credential; these are different meanings."),
    ("Validation", "checking that input follows rules before accepting it."),
    ("Widget", "a limited Android launcher surface, separate from a full app screen."),
], y)
endpage()

# 34
y = newpage(34, "Sources and evidence", "Project facts were checked locally; technology explanations use primary documentation.", "REFERENCE")
y = para("<b>Snapshot evidence:</b> root/mobile package manifests and installed package versions; app routes/config/plugins; preview store, finance rules and fixtures; Phase 3 review; architecture/database/API proposals; session handoff; ARM64 build record. Package versions and status are specific to this project snapshot.", y, size=10.1)
y = para("<b>Picture provenance:</b> docs/review/phase3/*.png, captured from the actual Android development app on Pixel_7 API 34, 1080 x 2400. Illustrations of the development connection, backend and widget are explanatory vector diagrams created for this guide. Future diagrams are labelled planned.", y, size=10.1)
refs = [
    ("React Native components", "https://reactnative.dev/docs/intro-react-native-components"),
    ("TypeScript handbook", "https://www.typescriptlang.org/docs/handbook/intro.html"),
    ("Expo development builds", "https://docs.expo.dev/develop/development-builds/introduction/"),
    ("Expo Router", "https://docs.expo.dev/router/introduction/"),
    ("Node.js introduction", "https://nodejs.org/learn/getting-started/introduction-to-nodejs"),
    ("npm introduction", "https://docs.npmjs.com/about-npm/"),
    ("Android ADB", "https://developer.android.com/tools/adb"),
    ("Studio / AGP compatibility", "https://developer.android.com/studio/releases"),
    ("Windows CMake / Ninja paths", "https://docs.expo.dev/troubleshooting/windows-long-paths/"),
    ("Hermes", "https://reactnative.dev/docs/hermes"),
    ("Zustand", "https://zustand.docs.pmnd.rs/"),
    ("Reanimated glossary", "https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/glossary/"),
    ("Rive React Native runtime", "https://rive.app/docs/runtimes/react-native/react-native"),
    ("Nitro Modules", "https://nitro.margelo.com/docs/getting-started/what-is-nitro"),
    ("Express", "https://expressjs.com/"),
    ("Prisma ORM concepts", "https://www.prisma.io/docs/orm/overview/introduction/what-is-prisma"),
    ("PostgreSQL concepts", "https://www.postgresql.org/docs/current/tutorial-concepts.html"),
    ("Zod validation", "https://zod.dev/"),
    ("Expo SQLite", "https://docs.expo.dev/versions/latest/sdk/sqlite/"),
    ("TanStack Query", "https://tanstack.com/query/latest/docs/framework/react/overview"),
    ("Expo SecureStore", "https://docs.expo.dev/versions/latest/sdk/securestore/"),
    ("Jetpack Glance", "https://developer.android.com/develop/ui/compose/glance"),
]
y = heading("Official reading links", y)
start = y
half = (CW - 24) / 2
for i, (title, url) in enumerate(refs):
    column = 0 if i < 11 else 1
    row = i if i < 11 else i - 11
    yy = start - row * 28
    para(f'<link href="{escape(url, quote=True)}" color="{GREEN}">{i + 1:02d}. {escape(title)}</link>', yy, M + column * (half + 24), half, size=9.3, gap=0, leading=13)
y = start - 11 * 28 - 6
y = para("Links were checked during preparation. Library documentation can evolve independently of this selected stack; future backend/widget versions must be checked when their phase is approved.", y, size=9.5, color=MUTED)
y = para("This PDF was authored with Python/ReportLab and rendered for visual review. Those are document-authoring tools, not Nivvi app dependencies. The project uses the bundled Manrope font under its existing SIL Open Font License.", y, size=9.5, color=MUTED)
endpage()

assert c.getPageNumber() == TOTAL + 1
c.save()
(OUT.parent / "source/layout-check.json").write_text(json.dumps({"pages": TOTAL, "paragraphs": len(layout_log), "minimum_text_bottom": min(x["bottom"] for x in layout_log), "direct_mobile_dependencies_covered": len(runtime), "source_date": "2026-11-10"}, indent=2), encoding="utf8")
print(f"Created {OUT} ({TOTAL} pages)")
