const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataFile = path.join(rootDir, "data", "doctors.json");
const templateFile = path.join(rootDir, "template", "clinic-template.html");
const outputDir = path.join(rootDir, "dist");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[char];
  });
}

function readDoctors() {
  const raw = fs.readFileSync(dataFile, "utf8").trim();

  if (!raw) {
    throw new Error(
      "data/doctors.json is empty. Add one or more doctor records before generating."
    );
  }

  const parsed = JSON.parse(raw);
  const doctors = Array.isArray(parsed) ? parsed : parsed.doctors;

  if (!Array.isArray(doctors) || doctors.length === 0) {
    throw new Error(
      "data/doctors.json must contain a non-empty array or an object with a doctors array."
    );
  }

  return doctors;
}

function getTemplate() {
  const rawTemplate = fs.existsSync(templateFile)
    ? fs.readFileSync(templateFile, "utf8")
    : "";

  if (rawTemplate.trim()) {
    return rawTemplate;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{doctor_name}} | {{clinic_name}}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --card: #fffdf8;
        --ink: #1d2a33;
        --muted: #60707b;
        --accent: #0d7a6f;
        --accent-soft: #dff4f0;
        --border: #d9e2e8;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(13, 122, 111, 0.12), transparent 28%),
          linear-gradient(180deg, #f7f2ea 0%, var(--bg) 100%);
      }
      .page {
        width: min(960px, calc(100% - 32px));
        margin: 40px auto;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(29, 42, 51, 0.08);
      }
      .hero {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        padding: 32px;
        background: linear-gradient(135deg, rgba(13, 122, 111, 0.08), rgba(255, 255, 255, 0));
      }
      .hero img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 18px;
        border: 1px solid var(--border);
      }
      .eyebrow {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font: 600 12px/1.2 Arial, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 10px;
        font-size: clamp(34px, 5vw, 52px);
        line-height: 0.95;
      }
      .subtitle,
      .meta,
      .contact li,
      .services li {
        font-family: Arial, sans-serif;
      }
      .subtitle {
        color: var(--muted);
        font-size: 18px;
      }
      .content {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 24px;
        padding: 0 32px 32px;
      }
      .panel {
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 18px;
      }
      .panel h2 {
        margin-top: 0;
      }
      .meta {
        display: grid;
        gap: 14px;
      }
      .meta strong {
        display: block;
        margin-bottom: 4px;
      }
      .services,
      .contact {
        margin: 0;
        padding-left: 18px;
      }
      .services li,
      .contact li {
        margin: 8px 0;
        color: var(--muted);
      }
      @media (max-width: 720px) {
        .hero,
        .content {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <img src="{{image}}" alt="{{doctor_name}}" />
        <div>
          <span class="eyebrow">{{specialty}}</span>
          <h1>{{doctor_name}}</h1>
          <p class="subtitle">{{clinic_name}}</p>
          <p class="subtitle">{{location}}</p>
        </div>
      </section>
      <section class="content">
        <article class="panel">
          <h2>About</h2>
          <p>{{bio}}</p>
          <h2>Services</h2>
          <ul class="services">
            {{services}}
          </ul>
        </article>
        <aside class="panel">
          <h2>Details</h2>
          <div class="meta">
            <div>
              <strong>Experience</strong>
              <span>{{experience}}</span>
            </div>
            <div>
              <strong>Availability</strong>
              <span>{{availability}}</span>
            </div>
            <div>
              <strong>Contact</strong>
              <ul class="contact">
                <li>{{phone}}</li>
                <li>{{email}}</li>
                <li>{{address}}</li>
              </ul>
            </div>
          </div>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

function renderDoctor(template, doctor) {
  const requiredFields = [
    "doctor_name",
    "clinic_name",
    "specialty",
    "location",
    "bio",
    "experience",
    "availability",
    "phone",
    "email",
    "address",
    "image",
  ];

  for (const field of requiredFields) {
    if (!doctor[field]) {
      throw new Error(`Missing required field "${field}" for a doctor entry.`);
    }
  }

  const services = Array.isArray(doctor.services) ? doctor.services : [];
  const servicesMarkup = services.length
    ? services.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n            ")
    : "<li>Consultation</li>";

  return template
    .replaceAll("{{doctor_name}}", escapeHtml(doctor.doctor_name))
    .replaceAll("{{clinic_name}}", escapeHtml(doctor.clinic_name))
    .replaceAll("{{specialty}}", escapeHtml(doctor.specialty))
    .replaceAll("{{location}}", escapeHtml(doctor.location))
    .replaceAll("{{bio}}", escapeHtml(doctor.bio))
    .replaceAll("{{experience}}", escapeHtml(doctor.experience))
    .replaceAll("{{availability}}", escapeHtml(doctor.availability))
    .replaceAll("{{phone}}", escapeHtml(doctor.phone))
    .replaceAll("{{email}}", escapeHtml(doctor.email))
    .replaceAll("{{address}}", escapeHtml(doctor.address))
    .replaceAll("{{image}}", escapeHtml(doctor.image))
    .replaceAll("{{services}}", servicesMarkup);
}

function main() {
  const doctors = readDoctors();
  const template = getTemplate();

  fs.mkdirSync(outputDir, { recursive: true });

  const generatedFiles = [];

  for (const doctor of doctors) {
    const slug = slugify(doctor.slug || doctor.doctor_name || doctor.clinic_name);
    if (!slug) {
      throw new Error("Unable to determine a file name for one of the doctor entries.");
    }

    const fileName = `${slug}.html`;
    const html = renderDoctor(template, doctor);
    const outputFile = path.join(outputDir, fileName);
    fs.writeFileSync(outputFile, html);
    generatedFiles.push(path.relative(rootDir, outputFile));
  }

  console.log(`Generated ${generatedFiles.length} page(s):`);
  for (const file of generatedFiles) {
    console.log(`- ${file}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Generation failed: ${error.message}`);
  process.exitCode = 1;
}
