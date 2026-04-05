const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const websiteDataFile = path.join(rootDir, "data", "website_data.csv");
const docsDir = path.join(rootDir, "docs");
const sourceImagesDir = path.join(rootDir, "data", "images");
const outputImagesDir = path.join(docsDir, "assets", "images");
const siteBaseUrl = "https://guddukumaralgo-art.github.io/doctor-demos";
const apolloInspiredDir = path.join(docsDir, "apollo-inspired");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeTextFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function cleanDocs() {
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  ensureDir(docsDir);
  ensureDir(outputImagesDir);
  ensureDir(apolloInspiredDir);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (inQuotes) {
    throw new Error('data/website_data.csv has an unclosed quoted value.');
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => String(value).trim() !== ""));
}

function readDoctorsFromCsv() {
  const raw = fs.readFileSync(websiteDataFile, "utf8");

  if (!raw.trim()) {
    throw new Error("data/website_data.csv is empty.");
  }

  const rows = parseCsv(raw);
  if (rows.length < 2) {
    throw new Error("data/website_data.csv must contain a header row and at least one data row.");
  }

  const headers = rows[0].map((header) => String(header).trim());
  const records = rows.slice(1).map((row, rowIndex) => {
    const record = {};

    headers.forEach((header, columnIndex) => {
      record[header] = String(row[columnIndex] ?? "").trim();
    });

    if (row.length > headers.length) {
      throw new Error(
        `data/website_data.csv row ${rowIndex + 2} has more columns than the header row.`
      );
    }

    return record;
  });

  if (records.length === 0) {
    throw new Error("data/website_data.csv must contain at least one profile record.");
  }

  return records;
}

function getDoctorLabel(doctor, index) {
  return doctor.profile_name || doctor.doctor_name || doctor.name || doctor.slug || `record ${index + 1}`;
}

function validateDoctors(doctors) {
  const seenSlugs = new Set();
  const requiredFields = [
    "slug",
    "profile_name",
    "company_name",
    "role",
    "location",
    "image",
  ];
  const supportedThemes = ["blue", "premium", "modern"];

  doctors.forEach((doctor, index) => {
    const label = getDoctorLabel(doctor, index);

    requiredFields.forEach((field) => {
      if (!doctor[field] || !String(doctor[field]).trim()) {
        throw new Error(
          `Validation failed for profile "${label}" at record ${index + 1}: missing required field "${field}".`
        );
      }
    });

    const slug = String(doctor.slug).trim();
    if (seenSlugs.has(slug)) {
      throw new Error(
        `Validation failed for profile "${label}" at record ${index + 1}: duplicate slug "${slug}" is not allowed.`
      );
    }
    seenSlugs.add(slug);

    const imageFile = path.join(sourceImagesDir, path.basename(doctor.image));
    if (!fs.existsSync(imageFile)) {
      throw new Error(
        `Validation failed for profile "${label}" at record ${index + 1}: image file "${doctor.image}" was not found in data/images.`
      );
    }

    if (doctor.theme && !supportedThemes.includes(doctor.theme)) {
      throw new Error(
        `Validation failed for profile "${label}" at record ${index + 1}: theme "${doctor.theme}" is not supported. Use blue, premium, or modern.`
      );
    }
  });
}

function normalizeDoctor(doctor, index) {
  const name = doctor.profile_name || doctor.doctor_name || doctor.name;
  const company = doctor.company_name || doctor.clinic_name || doctor.company || doctor.clinic;
  const role = doctor.role || doctor.specialty || "Healthcare Professional";
  const city = doctor.location || doctor.city;
  const slug = doctor.slug || slugify(name || company);
  const imageFileName = doctor.image ? path.basename(doctor.image) : "";
  const services = Array.isArray(doctor.services)
    ? doctor.services
    : [doctor.services_1, doctor.services_2, doctor.services_3, doctor.services_4].filter(
        (service) => String(service ?? "").trim() !== ""
      );

  if (!name || !company || !role || !city || !slug) {
    throw new Error("Each profile needs profile_name, company_name, role, location, and a valid slug.");
  }

  return {
    ...doctor,
    index,
    slug,
    name,
    company,
    clinic: company,
    role,
    specialty: role,
    city,
    address: doctor.address || city,
    image: imageFileName,
    imagePath: imageFileName ? `./assets/images/${imageFileName}` : "",
    accent: doctor.accent || "#0f766e",
    accent2: doctor.accent2 || "#2563eb",
    surface: doctor.surface || "#eff6ff",
    theme: doctor.theme || "blue",
    bio: doctor.bio || `${name} is a trusted ${role.toLowerCase()} working with ${company}.`,
    experience: doctor.experience || "10+ years",
    availability: doctor.availability || "By appointment",
    service1: services[0] || "Personalized consultation",
    service2: services[1] || "Preventive care planning",
    service3: services[2] || "Advanced treatment guidance",
    service4: services[3] || "Follow-up and recovery support",
    services,
  };
}

function copyDoctorImage(doctor) {
  if (!doctor.image) {
    return;
  }

  const sourceFile = path.join(sourceImagesDir, doctor.image);
  const outputFile = path.join(outputImagesDir, doctor.image);

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Image not found: data/images/${doctor.image}`);
  }

  fs.copyFileSync(sourceFile, outputFile);
}

function servicesList(doctor, className = "services") {
  const items = doctor.services.length
    ? doctor.services
    : [doctor.service1, doctor.service2, doctor.service3, doctor.service4];

  return `<ul class="${className}">${items
    .map((service) => `<li>${escapeHtml(service)}</li>`)
    .join("")}</ul>`;
}

function detailRows(doctor, className = "detail-list") {
  const details = [
    ["Company", doctor.company],
    ["Address", doctor.address],
    ["Phone", doctor.phone],
    ["Email", doctor.email],
    ["Availability", doctor.availability],
  ];

  return `<div class="${className}">${details
    .map(
      ([label, value]) =>
        `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("")}</div>`;
}

function getPhoneHref(phone) {
  return `tel:${String(phone ?? "").trim()}`;
}

function getWhatsAppHref(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function getImageFallbackLabel(doctor) {
  const role = doctor.role || doctor.specialty || "Healthcare Professional";
  return `${doctor.name} • ${role}`;
}

function renderImageFallbackScript() {
  return `<script>
    document.querySelectorAll('.js-image-frame img').forEach(function(img) {
      if (!img.getAttribute('src')) {
        img.parentElement.classList.add('is-fallback');
        return;
      }
      img.addEventListener('error', function() {
        img.parentElement.classList.add('is-fallback');
      });
    });
  </script>`;
}

function renderMotionScript() {
  return `<script>
    (function() {
      var root = document.documentElement;
      var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function setRevealDelays() {
        document.querySelectorAll('[data-reveal]').forEach(function(element, index) {
          element.style.setProperty('--reveal-delay', (index * 80) + 'ms');
        });
      }

      function setupPointerGlow() {
        if (prefersReducedMotion) {
          return;
        }

        window.addEventListener('pointermove', function(event) {
          root.style.setProperty('--pointer-x', event.clientX + 'px');
          root.style.setProperty('--pointer-y', event.clientY + 'px');
        });
      }

      function setupReveal() {
        var items = document.querySelectorAll('[data-reveal]');

        if (prefersReducedMotion || !('IntersectionObserver' in window)) {
          items.forEach(function(element) {
            element.classList.add('is-visible');
          });
          return;
        }

        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.14 });

        items.forEach(function(element) {
          observer.observe(element);
        });
      }

      function setupTilt() {
        if (prefersReducedMotion) {
          return;
        }

        document.querySelectorAll('[data-tilt]').forEach(function(element) {
          element.addEventListener('pointermove', function(event) {
            var rect = element.getBoundingClientRect();
            var x = (event.clientX - rect.left) / rect.width;
            var y = (event.clientY - rect.top) / rect.height;
            var rotateY = (x - 0.5) * 10;
            var rotateX = (0.5 - y) * 10;
            element.style.transform = 'perspective(1200px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) translateY(-6px)';
          });

          element.addEventListener('pointerleave', function() {
            element.style.transform = '';
          });
        });
      }

      setRevealDelays();
      setupPointerGlow();
      setupReveal();
      setupTilt();
    })();
  </script>`;
}

function pageShell({ title, bodyClass, content, description = "", canonicalUrl = "", ogImage = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ""}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
</head>
<body class="${bodyClass}">
${content}
</body>
</html>`;
}

function getDoctorSeo(doctor) {
  const title = `${doctor.name} | ${doctor.role} at ${doctor.company}`;
  const description = `${doctor.name} is a ${doctor.role} at ${doctor.company} based in ${doctor.city}.`;
  const canonicalUrl = `${siteBaseUrl}/${doctor.slug}.html`;
  const ogImage = doctor.image ? `${siteBaseUrl}/assets/images/${doctor.image}` : "";

  return {
    title,
    description,
    canonicalUrl,
    ogImage,
  };
}

const doctorThemes = {
  blue: {
    bodyClass: "theme-blue",
    shellBg: "linear-gradient(180deg,#f7fbff 0%,#edf7ff 100%)",
    heroBg: "linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.84)), linear-gradient(135deg, var(--surface), rgba(255,255,255,0))",
    ctaBg: "linear-gradient(135deg, var(--accent), var(--accent2))",
    cardTone: "rgba(255,255,255,.86)",
  },
  premium: {
    bodyClass: "theme-premium",
    shellBg: "linear-gradient(180deg,#fffdf8 0%,#f6efe6 100%)",
    heroBg: "linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,255,255,.9)), linear-gradient(135deg, var(--surface), rgba(255,255,255,0))",
    ctaBg: "linear-gradient(135deg, #0f172a, color-mix(in srgb, var(--accent) 70%, #111827))",
    cardTone: "rgba(255,255,255,.9)",
  },
  modern: {
    bodyClass: "theme-modern",
    shellBg: "linear-gradient(180deg,#0b1220 0%,#111827 100%)",
    heroBg: "linear-gradient(135deg, rgba(19,31,57,.94), rgba(17,24,39,.88)), linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, transparent), transparent)",
    ctaBg: "linear-gradient(135deg, #ffffff, #dbeafe)",
    cardTone: "rgba(255,255,255,.08)",
  },
};

function getDoctorTheme(themeName) {
  return doctorThemes[themeName] || doctorThemes.blue;
}

function renderDoctorPage(doctor, variant) {
  const seo = getDoctorSeo(doctor);
  const isDark = variant.bodyClass === "theme-modern";
  const ink = isDark ? "#f8fafc" : "#102033";
  const muted = isDark ? "#cbd5e1" : "#62748a";
  const line = isDark ? "rgba(255,255,255,.1)" : "rgba(16,32,51,.08)";
  const panel = variant.cardTone;
  const buttonText = isDark ? "#0f172a" : "#ffffff";
  const secondaryButtonBg = isDark ? "rgba(255,255,255,.08)" : "#ffffff";
  const secondaryButtonText = isDark ? "#ffffff" : "#102033";

  const fallbackLabel = getImageFallbackLabel(doctor);
  return pageShell({
    title: seo.title,
    bodyClass: variant.bodyClass,
    description: seo.description,
    canonicalUrl: seo.canonicalUrl,
    ogImage: seo.ogImage,
    content: `<style>
      :root{
        --accent:${doctor.accent};
        --accent2:${doctor.accent2};
        --surface:${doctor.surface};
        --ink:${ink};
        --muted:${muted};
        --line:${line};
        --panel:${panel};
        --buttonText:${buttonText};
        --secondaryButtonBg:${secondaryButtonBg};
        --secondaryButtonText:${secondaryButtonText};
        --pointer-x:50vw;
        --pointer-y:18vh;
      }
      *{box-sizing:border-box}
      body{
        margin:0;
        color:var(--ink);
        font-family:Arial,sans-serif;
        background:${variant.shellBg};
        position:relative;
        overflow-x:hidden;
      }
      body::before{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        background:radial-gradient(circle 220px at var(--pointer-x) var(--pointer-y), color-mix(in srgb, var(--accent2) 16%, transparent), transparent 72%);
        opacity:.9;
        z-index:0;
      }
      .page{
        width:min(1180px,calc(100% - 28px));
        margin:0 auto;
        padding:26px 0 56px;
        position:relative;
        z-index:1;
      }
      [data-reveal]{
        opacity:0;
        transform:translateY(28px);
        transition:
          opacity .7s ease,
          transform .7s cubic-bezier(.22,1,.36,1);
        transition-delay:var(--reveal-delay,0ms);
      }
      [data-reveal].is-visible{
        opacity:1;
        transform:translateY(0);
      }
      .nav{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:14px;
        padding-bottom:18px;
      }
      .nav strong,.nav a{
        color:var(--ink);
        text-decoration:none;
        font:700 14px/1.2 Arial,sans-serif;
      }
      .nav a{
        padding:11px 14px;
        border-radius:999px;
        border:1px solid var(--line);
        background:${isDark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.72)"};
      }
      .hero{
        position:relative;
        overflow:hidden;
        display:grid;
        grid-template-columns:320px 1fr;
        gap:30px;
        padding:34px;
        border-radius:34px;
        background:${variant.heroBg};
        border:1px solid ${isDark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.78)"};
        box-shadow:${isDark ? "0 28px 80px rgba(0,0,0,.22)" : "0 28px 80px rgba(15,23,42,.10)"};
        transition:transform .24s ease, box-shadow .24s ease;
      }
      .hero::after{
        content:"";
        position:absolute;
        right:-80px;
        top:-80px;
        width:240px;
        height:240px;
        border-radius:50%;
        background:linear-gradient(135deg,color-mix(in srgb, var(--accent2) 20%, transparent), transparent);
        pointer-events:none;
      }
      .portrait{
        position:relative;
        min-height:420px;
      }
      .portrait::before{
        content:"";
        position:absolute;
        inset:-14px;
        border-radius:30px;
        transform:rotate(-4deg);
        background:linear-gradient(135deg,var(--accent),var(--accent2));
        opacity:.14;
      }
      .portrait img{
        position:relative;
        width:100%;
        display:block;
        height:100%;
        min-height:420px;
        object-fit:cover;
        object-position:center top;
        border-radius:28px;
        background:linear-gradient(135deg,var(--surface),#ffffff);
        box-shadow:${isDark ? "0 22px 40px rgba(0,0,0,.24)" : "0 22px 40px rgba(15,23,42,.12)"};
        transition:transform .45s ease;
      }
      .portrait:hover img{
        transform:scale(1.03);
      }
      .image-frame{
        position:relative;
        height:100%;
      }
      .image-fallback{
        position:absolute;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:24px;
        border-radius:28px;
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, white), color-mix(in srgb, var(--accent2) 14%, white)),
          linear-gradient(135deg,var(--surface),#fff);
        color:var(--ink);
        font:700 18px/1.6 Georgia,"Times New Roman",serif;
        letter-spacing:-.02em;
      }
      .image-frame.is-fallback .image-fallback{
        display:flex;
      }
      .image-frame.is-fallback img{
        opacity:0;
      }
      .eyebrow{
        display:inline-block;
        padding:9px 14px;
        border-radius:999px;
        background:${isDark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.86)"};
        color:${isDark ? "#ffffff" : "var(--accent)"};
        font-size:12px;
        font-weight:700;
        letter-spacing:.1em;
        text-transform:uppercase;
      }
      h1{
        margin:18px 0 10px;
        font:700 clamp(38px,6vw,70px)/.92 Georgia,"Times New Roman",serif;
        letter-spacing:-.05em;
      }
      .clinic{
        font-size:24px;
        font-weight:700;
        margin-bottom:12px;
      }
      .lede{
        margin:0;
        max-width:60ch;
        color:var(--muted);
        font-size:17px;
        line-height:1.8;
      }
      .hero-meta{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:14px;
        margin-top:24px;
      }
      .meta-card{
        padding:16px;
        border-radius:20px;
        background:${isDark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.74)"};
        border:1px solid var(--line);
        transition:transform .24s ease, border-color .24s ease;
      }
      .meta-card:hover{
        transform:translateY(-4px);
        border-color:color-mix(in srgb, var(--accent) 28%, var(--line));
      }
      .meta-card span{
        display:block;
        margin-bottom:7px;
        color:var(--muted);
        font-size:11px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .meta-card strong{
        font-size:16px;
        line-height:1.5;
      }
      .hero-actions{
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        margin-top:24px;
      }
      .btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:14px 18px;
        border-radius:16px;
        text-decoration:none;
        font-weight:700;
      }
      .btn-primary{
        background:${variant.ctaBg};
        color:var(--buttonText);
        box-shadow:${isDark ? "0 18px 32px rgba(0,0,0,.16)" : "0 18px 32px rgba(37,99,235,.18)"};
      }
      .btn-secondary{
        background:var(--secondaryButtonBg);
        color:var(--secondaryButtonText);
        border:1px solid var(--line);
      }
      .content-grid{
        display:grid;
        grid-template-columns:1.06fr .94fr;
        gap:18px;
        margin-top:20px;
      }
      .stack{
        display:grid;
        gap:18px;
      }
      .card{
        padding:24px;
        border-radius:28px;
        background:var(--panel);
        border:1px solid var(--line);
        box-shadow:${isDark ? "none" : "0 18px 34px rgba(15,23,42,.06)"};
        backdrop-filter:blur(8px);
        transition:transform .24s ease, box-shadow .24s ease, border-color .24s ease;
      }
      .card:hover{
        transform:translateY(-6px);
        box-shadow:${isDark ? "0 20px 40px rgba(0,0,0,.24)" : "0 22px 44px rgba(15,23,42,.10)"};
        border-color:color-mix(in srgb, var(--accent2) 18%, var(--line));
      }
      .card h2{
        margin:0 0 16px;
        font:700 24px/1.05 Georgia,"Times New Roman",serif;
        letter-spacing:-.03em;
      }
      .copy{
        color:var(--muted);
        font-size:15px;
        line-height:1.8;
      }
      .services{
        list-style:none;
        padding:0;
        margin:0;
        display:grid;
        gap:12px;
      }
      .services li{
        padding:15px 16px;
        border-radius:18px;
        background:${isDark ? "rgba(255,255,255,.05)" : "#ffffff"};
        border:1px solid var(--line);
        line-height:1.7;
      }
      .detail-list{
        display:grid;
        gap:14px;
      }
      .detail{
        padding-bottom:14px;
        border-bottom:1px solid var(--line);
      }
      .detail:last-child{
        padding-bottom:0;
        border-bottom:0;
      }
      .detail span{
        display:block;
        margin-bottom:7px;
        color:var(--muted);
        font-size:11px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .detail strong{
        font-size:15px;
        line-height:1.7;
      }
      .availability{
        display:grid;
        gap:14px;
      }
      .availability-box{
        padding:18px;
        border-radius:20px;
        background:${isDark ? "rgba(255,255,255,.05)" : "#ffffff"};
        border:1px solid var(--line);
      }
      .availability-box strong{
        display:block;
        margin-bottom:8px;
        font-size:17px;
      }
      .availability-box p{
        margin:0;
        color:var(--muted);
        line-height:1.7;
      }
      .trust-strip{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
      }
      .trust-badge{
        padding:15px 16px;
        border-radius:18px;
        background:${isDark ? "rgba(255,255,255,.05)" : "#ffffff"};
        border:1px solid var(--line);
      }
      .trust-badge strong{
        display:block;
        margin-bottom:6px;
        font-size:15px;
      }
      .trust-badge span{
        color:var(--muted);
        font-size:13px;
        line-height:1.6;
      }
      .testimonial-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:14px;
      }
      .testimonial{
        padding:18px;
        border-radius:20px;
        background:${isDark ? "rgba(255,255,255,.05)" : "#ffffff"};
        border:1px solid var(--line);
      }
      .testimonial p{
        margin:0 0 12px;
        color:var(--muted);
        line-height:1.75;
      }
      .testimonial strong{
        display:block;
        font-size:14px;
      }
      .testimonial span{
        display:block;
        margin-top:4px;
        color:var(--muted);
        font-size:12px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .cta{
        margin-top:18px;
        padding:28px;
        border-radius:30px;
        background:${variant.ctaBg};
        color:${isDark ? "#0f172a" : "#ffffff"};
        display:grid;
        grid-template-columns:1fr auto;
        gap:16px;
        align-items:center;
      }
      .cta h2{
        margin:0 0 10px;
        font:700 28px/1.05 Georgia,"Times New Roman",serif;
        letter-spacing:-.03em;
      }
      .cta p{
        margin:0;
        line-height:1.8;
        color:${isDark ? "rgba(15,23,42,.78)" : "rgba(255,255,255,.84)"};
      }
      .cta .btn{
        background:#ffffff;
        color:#0f172a;
      }
      .floating-actions{
        position:fixed;
        right:18px;
        bottom:18px;
        z-index:40;
        display:grid;
        gap:12px;
      }
      .floating-btn{
        min-width:178px;
        padding:14px 16px;
        border-radius:999px;
        text-decoration:none;
        font-weight:700;
        font-size:14px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        box-shadow:0 18px 34px rgba(15,23,42,.16);
      }
      .floating-btn.call{
        background:linear-gradient(135deg,var(--accent),var(--accent2));
        color:#fff;
      }
      .floating-btn.whatsapp{
        background:#25d366;
        color:#fff;
      }
      footer{
        margin-top:18px;
        padding:22px 8px 6px;
        color:var(--muted);
        text-align:center;
        font-size:14px;
        line-height:1.7;
      }
      @media (max-width:960px){
        .hero,.content-grid,.cta{grid-template-columns:1fr}
        .hero-meta{grid-template-columns:1fr}
        .portrait,.portrait img{min-height:320px}
        .trust-strip,.testimonial-grid{grid-template-columns:1fr}
      }
      @media (max-width:640px){
        .floating-actions{
          left:14px;
          right:14px;
          bottom:14px;
          grid-template-columns:1fr 1fr;
        }
        .floating-btn{
          min-width:0;
          padding:14px 12px;
          font-size:13px;
        }
      }
      @media (prefers-reduced-motion: reduce){
        [data-reveal]{
          opacity:1;
          transform:none;
          transition:none;
        }
        .hero,.card,.meta-card,.portrait img{
          transition:none;
        }
        body::before{
          display:none;
        }
      }
    </style>
    <main class="page">
      <div class="nav" data-reveal>
        <strong>Healthcare Profile Demo</strong>
        <a href="${escapeHtml(doctor.linkedin_url || "#")}" target="_blank" rel="noreferrer">LinkedIn</a>
      </div>

      <section class="hero" data-reveal data-tilt>
        <div class="portrait">
          <div class="image-frame js-image-frame">
            <img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" />
            <div class="image-fallback">${escapeHtml(fallbackLabel)}</div>
          </div>
        </div>
        <div>
          <span class="eyebrow">${escapeHtml(doctor.role)}</span>
          <h1>${escapeHtml(doctor.name)}</h1>
          <div class="clinic">${escapeHtml(doctor.company)}</div>
          <p class="lede">${escapeHtml(doctor.bio)}</p>

          <div class="hero-meta">
            <div class="meta-card"><span>Experience</span><strong>${escapeHtml(doctor.experience)}</strong></div>
            <div class="meta-card"><span>Availability</span><strong>${escapeHtml(doctor.availability)}</strong></div>
            <div class="meta-card"><span>Location</span><strong>${escapeHtml(doctor.city)}</strong></div>
          </div>

          <div class="hero-actions">
            <a class="btn btn-primary" href="${escapeHtml(getPhoneHref(doctor.phone))}">Call Now</a>
            <a class="btn btn-secondary" href="${escapeHtml(getWhatsAppHref(doctor.phone))}" target="_blank" rel="noreferrer">WhatsApp Now</a>
            <a class="btn btn-secondary" href="mailto:${escapeHtml(doctor.email)}">Email Profile</a>
          </div>
        </div>
      </section>

      <section class="content-grid">
        <div class="stack">
          <article class="card" data-reveal data-tilt>
            <h2>About This Profile</h2>
            <p class="copy">${escapeHtml(doctor.bio)}</p>
          </article>

          <article class="card" data-reveal data-tilt>
            <h2>Trust Highlights</h2>
            <div class="trust-strip">
              <div class="trust-badge"><strong>${escapeHtml(doctor.experience)}</strong><span>Experience across healthcare leadership and delivery</span></div>
              <div class="trust-badge"><strong>Trusted Presence</strong><span>Clear communication and professional follow-up</span></div>
              <div class="trust-badge"><strong>Healthcare Focus</strong><span>Built to showcase leaders, founders, and clinic teams</span></div>
              <div class="trust-badge"><strong>Easy Contact</strong><span>Fast connection by phone, email, and WhatsApp</span></div>
            </div>
          </article>

          <article class="card" data-reveal data-tilt>
            <h2>Offerings</h2>
            ${servicesList(doctor)}
          </article>

          <article class="card" data-reveal data-tilt>
            <h2>Testimonials</h2>
            <p class="copy" style="margin-bottom:16px">The following testimonial cards are demo placeholders to show how feedback could appear on a premium healthcare profile page.</p>
            <div class="testimonial-grid">
              <div class="testimonial">
                <p>“The consultation felt calm, professional, and very easy to understand from the first visit onward.”</p>
                <strong>Demo Patient A</strong>
                <span>Demo Content</span>
              </div>
              <div class="testimonial">
                <p>“Connecting was simple, the profile felt modern and trustworthy, and every next step was explained clearly.”</p>
                <strong>Demo Contact B</strong>
                <span>Demo Content</span>
              </div>
              <div class="testimonial">
                <p>“A reassuring experience with thoughtful care, practical advice, and smooth follow-up communication.”</p>
                <strong>Demo Patient C</strong>
                <span>Demo Content</span>
              </div>
            </div>
          </article>

          <article class="card" data-reveal data-tilt>
            <h2>Strong Call To Action</h2>
            <p class="copy">People looking to connect with a trusted ${escapeHtml(String(doctor.role).toLowerCase())} can reach ${escapeHtml(doctor.name)} for healthcare collaboration, leadership conversations, and professional inquiries.</p>
            <div class="hero-actions" style="margin-top:18px">
              <a class="btn btn-primary" href="${escapeHtml(getPhoneHref(doctor.phone))}">Talk Now</a>
              <a class="btn btn-secondary" href="${escapeHtml(getWhatsAppHref(doctor.phone))}" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
              <a class="btn btn-secondary" href="mailto:${escapeHtml(doctor.email)}">Send Email</a>
            </div>
          </article>
        </div>

        <div class="stack">
          <aside class="card" data-reveal data-tilt>
            <h2>Profile Information</h2>
            ${detailRows(doctor)}
          </aside>

          <aside class="card" data-reveal data-tilt>
            <h2>Availability</h2>
            <div class="availability">
              <div class="availability-box">
                <strong>${escapeHtml(doctor.availability)}</strong>
                <p>Availability details can be shown clearly here for visitors on both mobile and desktop.</p>
              </div>
              <div class="availability-box">
                <strong>${escapeHtml(doctor.city)}</strong>
                <p>${escapeHtml(doctor.address)}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="cta" data-reveal data-tilt>
        <div>
          <h2>Build a premium healthcare profile presence</h2>
          <p>Designed for healthcare professionals, founders, clinic owners, and leaders, this concept highlights credibility, strong positioning, and fast contact intent.</p>
        </div>
        <a class="btn" href="mailto:${escapeHtml(doctor.email)}">Schedule Now</a>
      </section>

      <footer data-reveal>
        This is a concept demo website created for showcase purposes only. It is not an official healthcare organization website.
      </footer>

      <div class="floating-actions">
        <a class="floating-btn whatsapp" href="${escapeHtml(getWhatsAppHref(doctor.phone))}" target="_blank" rel="noreferrer">WhatsApp</a>
        <a class="floating-btn call" href="${escapeHtml(getPhoneHref(doctor.phone))}">Call Now</a>
      </div>
    </main>
    ${renderImageFallbackScript()}
    ${renderMotionScript()}`,
  });
}

function renderLayoutOne(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

function renderLayoutTwo(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

function renderLayoutThree(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

function renderLayoutFour(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

function renderLayoutFive(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

function renderLayoutSix(doctor) {
  return renderDoctorPage(doctor, getDoctorTheme(doctor.theme));
}

const profileLayouts = [
  renderLayoutOne,
  renderLayoutTwo,
  renderLayoutThree,
  renderLayoutFour,
  renderLayoutFive,
  renderLayoutSix,
];

function renderProfile(doctor) {
  const renderer = profileLayouts[doctor.index % profileLayouts.length];
  return renderer(doctor);
}

function renderIndex(doctors) {
  const cards = doctors
    .map((doctor) => {
      return `
        <article class="card" data-reveal data-tilt style="--accent:${escapeHtml(doctor.accent)};--accent2:${escapeHtml(doctor.accent2)};--surface:${escapeHtml(doctor.surface)};">
          <div class="image-shell js-image-frame">
            <img src="${escapeHtml(doctor.imagePath)}" alt="${escapeHtml(doctor.name)}" />
            <div class="image-fallback">${escapeHtml(getImageFallbackLabel(doctor))}</div>
          </div>
          <div class="content">
            <p class="eyebrow">${escapeHtml(doctor.role || "")}</p>
            <h2>${escapeHtml(doctor.name)}</h2>
            <p class="clinic">${escapeHtml(doctor.company)}</p>
            <p class="location">${escapeHtml(doctor.city)}</p>
            <p class="meta">${escapeHtml(doctor.experience)} experience</p>
            <p class="copy">${escapeHtml(doctor.bio)}</p>
            <a href="./${escapeHtml(doctor.slug)}.html">View Profile Website</a>
          </div>
        </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Healthcare Profile Demo Websites</title>
  <style>
    :root{--ink:#112033;--muted:#617287;--line:rgba(17,32,51,.08);--pointer-x:50vw;--pointer-y:18vh}
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial,sans-serif;
      color:var(--ink);
      background:
        radial-gradient(circle at top left, rgba(37,99,235,.14), transparent 26%),
        radial-gradient(circle at top right, rgba(15,118,110,.12), transparent 24%),
        linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);
      position:relative;
      overflow-x:hidden;
    }
    body::before{
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      background:radial-gradient(circle 240px at var(--pointer-x) var(--pointer-y), rgba(22,93,255,.12), transparent 72%);
      z-index:0;
    }
    .wrap{max-width:1220px;margin:0 auto;padding:34px 20px 68px;position:relative;z-index:1}
    [data-reveal]{
      opacity:0;
      transform:translateY(28px);
      transition:
        opacity .7s ease,
        transform .7s cubic-bezier(.22,1,.36,1);
      transition-delay:var(--reveal-delay,0ms);
    }
    [data-reveal].is-visible{
      opacity:1;
      transform:translateY(0);
    }
    .nav{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:16px;
      padding-bottom:16px;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:14px;
    }
    .brand-mark{
      width:52px;
      height:52px;
      border-radius:16px;
      display:grid;
      place-items:center;
      background:linear-gradient(135deg,#165dff,#07b6d5);
      color:#fff;
      font:700 20px/1 Georgia,serif;
      box-shadow:0 18px 34px rgba(22,93,255,.18);
    }
    .brand-copy strong{
      display:block;
      font:700 22px/1.05 Georgia,"Times New Roman",serif;
      letter-spacing:-.03em;
    }
    .brand-copy span{
      display:block;
      margin-top:4px;
      color:var(--muted);
      font-size:13px;
    }
    .nav-link{
      text-decoration:none;
      color:var(--ink);
      font-weight:700;
      padding:12px 15px;
      border-radius:999px;
      background:rgba(255,255,255,.75);
      border:1px solid var(--line);
    }
    .hero{
      display:grid;
      grid-template-columns:1.15fr .85fr;
      gap:22px;
      align-items:stretch;
      margin-bottom:28px;
    }
    .hero-copy,.hero-panel{
      padding:32px;
      border-radius:32px;
      background:rgba(255,255,255,.82);
      border:1px solid rgba(255,255,255,.86);
      box-shadow:0 24px 60px rgba(15,23,42,.08);
      backdrop-filter:blur(10px);
      transition:transform .24s ease, box-shadow .24s ease;
    }
    .eyebrow-top{
      display:inline-block;
      padding:10px 14px;
      border-radius:999px;
      background:#e0f2fe;
      color:#0c4a6e;
      font-size:12px;
      font-weight:700;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    h1{
      margin:18px 0 12px;
      font:700 clamp(44px,6vw,82px)/.92 Georgia,"Times New Roman",serif;
      letter-spacing:-.06em;
    }
    .sub{
      margin:0;
      color:var(--muted);
      font-size:18px;
      line-height:1.8;
      max-width:58ch;
    }
    .hero-actions{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:24px;
    }
    .hero-actions a,.feature a,.card a{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:13px 17px;
      border-radius:14px;
      text-decoration:none;
      font-weight:700;
    }
    .hero-actions .primary,.card a{
      color:#fff;
      background:linear-gradient(135deg,var(--accent),var(--accent2));
    }
    .hero-actions .secondary{
      color:var(--ink);
      background:#fff;
      border:1px solid var(--line);
    }
    .hero-panel h2,.feature h2{
      margin:0 0 12px;
      font:700 30px/1.05 Georgia,"Times New Roman",serif;
      letter-spacing:-.03em;
    }
    .hero-panel p,.feature p{
      margin:0;
      color:var(--muted);
      line-height:1.75;
    }
    .mini-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
      margin-top:20px;
    }
    .mini-card{
      padding:16px;
      border-radius:18px;
      background:#ffffff;
      border:1px solid var(--line);
      transition:transform .24s ease, border-color .24s ease;
    }
    .mini-card:hover{
      transform:translateY(-4px);
      border-color:rgba(22,93,255,.18);
    }
    .mini-card strong{
      display:block;
      margin-bottom:7px;
      font-size:15px;
    }
    .mini-card span{
      color:var(--muted);
      font-size:13px;
      line-height:1.6;
    }
    .feature{
      margin-bottom:24px;
      padding:28px;
      border-radius:32px;
      background:linear-gradient(135deg,#0f172a,#1d4ed8 60%,#06b6d4);
      color:#fff;
      box-shadow:0 28px 64px rgba(29,78,216,.2);
      display:grid;
      grid-template-columns:1fr auto;
      gap:18px;
      align-items:center;
      transition:transform .24s ease, box-shadow .24s ease;
    }
    .feature p{color:rgba(255,255,255,.84)}
    .feature a{background:#fff;color:#0f172a}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}
    .card{
      overflow:hidden;
      position:relative;
      border-radius:30px;
      background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(255,255,255,.84));
      border:1px solid rgba(255,255,255,.84);
      box-shadow:0 20px 48px rgba(15,23,42,.08);
      display:flex;
      flex-direction:column;
      transition:transform .24s ease, box-shadow .24s ease, border-color .24s ease;
    }
    .card:hover{
      transform:translateY(-6px);
      box-shadow:0 28px 56px rgba(15,23,42,.12);
      border-color:rgba(22,93,255,.16);
    }
    .card::before{
      content:"";
      position:absolute;
      inset:0 0 auto 0;
      height:220px;
      background:linear-gradient(135deg,var(--surface),rgba(255,255,255,0));
      pointer-events:none;
    }
    .image-shell{
      position:relative;
      height:260px;
      overflow:hidden;
      background:linear-gradient(135deg,var(--surface),#fff);
      border-bottom:1px solid rgba(255,255,255,.68);
    }
    .card img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
      object-position:center top;
      transform:scale(1.01);
      transition:transform .4s ease;
    }
    .card:hover img{
      transform:scale(1.05);
    }
    .image-fallback{
      position:absolute;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      text-align:center;
      padding:22px;
      background:linear-gradient(135deg,var(--surface),#ffffff);
      color:#163047;
      font:700 18px/1.5 Georgia,"Times New Roman",serif;
      letter-spacing:-.02em;
    }
    .js-image-frame.is-fallback .image-fallback{
      display:flex;
    }
    .js-image-frame.is-fallback img{
      opacity:0;
    }
    .content{position:relative;padding:24px}
    .eyebrow{
      margin:0 0 12px;
      color:var(--accent);
      font-size:12px;
      font-weight:700;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .content h2{
      margin:0 0 10px;
      font:700 28px/1.02 Georgia,"Times New Roman",serif;
      letter-spacing:-.03em;
    }
    .content p{margin:0 0 10px}
    .clinic{
      font-weight:700;
      color:#1e293b;
      font-size:15px;
      line-height:1.6;
    }
    .location{
      color:var(--muted);
      font-size:14px;
      line-height:1.6;
    }
    .meta{color:var(--muted);font-weight:600}
    .copy{color:#334155;line-height:1.7;min-height:96px;font-size:14px}
    .content a{
      margin-top:16px;
      width:100%;
      justify-content:center;
      box-shadow:0 16px 30px rgba(37,99,235,.16);
    }
    footer{
      margin-top:24px;
      text-align:center;
      color:var(--muted);
      font-size:14px;
      line-height:1.7;
    }
    @media (max-width:900px){
      .hero,.feature{grid-template-columns:1fr}
      .mini-grid{grid-template-columns:1fr}
    }
    @media (prefers-reduced-motion: reduce){
      [data-reveal]{
        opacity:1;
        transform:none;
        transition:none;
      }
      .card,.hero-copy,.hero-panel,.feature,.mini-card,.card img{
        transition:none;
      }
      body::before{
        display:none;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="nav" data-reveal>
      <div class="brand">
        <div class="brand-mark">M</div>
        <div class="brand-copy">
          <strong>Healthcare Profile Showcase</strong>
          <span>Premium static healthcare profile website concepts</span>
        </div>
      </div>
      <a class="nav-link" href="./apollo-inspired/">Hospital Network Demo</a>
    </div>
    <section class="hero">
      <div class="hero-copy" data-reveal data-tilt>
        <span class="eyebrow-top">Premium Profile Showcase</span>
        <h1>Modern healthcare profile websites that feel clean, credible, and high-trust</h1>
        <p class="sub">This homepage showcases premium static profile website concepts for healthcare professionals, founders, clinic owners, and healthcare leaders. Each page is generated from the same CSV data structure and stays fast, simple, and GitHub Pages-friendly.</p>
        <div class="hero-actions">
          <a class="primary" href="#doctors">Explore Profile Pages</a>
          <a class="secondary" href="./apollo-inspired/">Open Hospital Demo</a>
        </div>
      </div>
      <aside class="hero-panel" data-reveal data-tilt>
        <h2>What this generator now supports</h2>
        <p>Premium hero sections, cleaner typography, better spacing, improved card rhythm, stronger calls to action, mobile-friendly layouts, and polished healthcare profile sections generated from CSV data.</p>
        <div class="mini-grid">
          <div class="mini-card"><strong>Hero-First</strong><span>Clear professional identity, company branding, and immediate contact intent.</span></div>
          <div class="mini-card"><strong>Trust Signals</strong><span>Experience, availability, location, and company information are surfaced clearly.</span></div>
          <div class="mini-card"><strong>Static & Fast</strong><span>No framework, no backend, just static HTML, CSS, and vanilla JavaScript output.</span></div>
        </div>
      </aside>
    </section>
    <section class="feature" data-reveal data-tilt>
      <div>
        <h2>Hospital Network Landing Page</h2>
        <p>An Apollo-inspired multispeciality hospital homepage is also available in a separate folder, with large-scale navigation, service discovery, quick actions, centres of excellence, city network highlights, and a premium healthcare landing-page feel.</p>
      </div>
      <a href="./apollo-inspired/">Open Hospital Demo</a>
    </section>
    <section class="grid" id="doctors">${cards}</section>
    <footer data-reveal>
      This is a concept demo showcase for healthcare profile and hospital websites. All pages are generated from static project files.
    </footer>
  </main>
  ${renderImageFallbackScript()}
  ${renderMotionScript()}
</body>
</html>`;
}

function getDoctorOutputPath(doctor) {
  return path.join(docsDir, `${doctor.slug}.html`);
}

function getDoctorOutputLabel(doctor) {
  return `docs/${doctor.slug}.html`;
}

function generateDoctorPages(doctors) {
  const files = [];

  doctors.forEach((doctor) => {
    copyDoctorImage(doctor);
    writeTextFile(getDoctorOutputPath(doctor), renderProfile(doctor));
    files.push(getDoctorOutputLabel(doctor));
  });

  return files;
}

function generateStaticPages(doctors) {
  const files = [];

  writeTextFile(path.join(docsDir, "index.html"), renderIndex(doctors));
  files.push("docs/index.html");

  writeTextFile(path.join(apolloInspiredDir, "index.html"), renderApolloInspiredSite());
  files.push("docs/apollo-inspired/index.html");

  return files;
}

function getGeneratedUrls(doctors) {
  return [
    `${siteBaseUrl}/`,
    `${siteBaseUrl}/apollo-inspired/`,
    ...doctors.map((doctor) => `${siteBaseUrl}/${doctor.slug}.html`),
  ];
}

function logGenerationResult(files, urls) {
  console.log(`Generated ${files.length} page(s):`);
  files.forEach((file) => {
    console.log(`- ${file}`);
  });

  console.log("");
  console.log("GitHub Pages URLs:");
  urls.forEach((url) => {
    console.log(`- ${url}`);
  });
}

function renderApolloInspiredSite() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NovaCare Hospitals | Multispeciality Hospital Network Demo</title>
  <style>
    :root{
      --navy:#0b1f45;
      --blue:#165dff;
      --sky:#07b6d5;
      --teal:#0f766e;
      --mint:#dff8f5;
      --paper:#f5f9ff;
      --ink:#0f172a;
      --muted:#5b6b84;
      --line:#dce6f5;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial,sans-serif;
      color:var(--ink);
      background:
        radial-gradient(circle at top right, rgba(22,93,255,.12), transparent 26%),
        linear-gradient(180deg, #fbfdff 0%, #eef5ff 100%);
    }
    a{text-decoration:none}
    .topbar{
      background:linear-gradient(90deg,var(--navy),#123b85);
      color:#fff;
      padding:10px 18px;
      font-size:14px;
    }
    .topbar-inner,.nav-inner,.hero-inner,.section,.footer-inner{
      width:min(1220px,calc(100% - 28px));
      margin:0 auto;
    }
    .topbar-inner{
      display:flex;
      justify-content:space-between;
      gap:18px;
      flex-wrap:wrap;
      align-items:center;
    }
    .top-links{
      display:flex;
      gap:18px;
      flex-wrap:wrap;
      color:rgba(255,255,255,.86);
    }
    .nav{
      position:sticky;
      top:0;
      z-index:10;
      background:rgba(255,255,255,.9);
      backdrop-filter:blur(10px);
      border-bottom:1px solid rgba(220,230,245,.9);
    }
    .nav-inner{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:24px;
      padding:16px 0;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:14px;
      min-width:0;
    }
    .brand-mark{
      width:52px;
      height:52px;
      border-radius:16px;
      background:linear-gradient(135deg,var(--blue),var(--sky));
      color:#fff;
      display:grid;
      place-items:center;
      font:700 20px/1 Georgia,serif;
      box-shadow:0 18px 34px rgba(22,93,255,.22);
    }
    .brand-copy strong{
      display:block;
      font:700 20px/1.1 Georgia,serif;
      letter-spacing:-.02em;
    }
    .brand-copy span{
      display:block;
      margin-top:4px;
      color:var(--muted);
      font-size:13px;
    }
    .menu{
      display:flex;
      gap:18px;
      flex-wrap:wrap;
      align-items:center;
      color:#1e293b;
      font-weight:600;
      font-size:14px;
    }
    .menu a{color:inherit}
    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:13px 18px;
      border-radius:14px;
      font-weight:700;
    }
    .btn-primary{
      background:linear-gradient(135deg,var(--blue),var(--sky));
      color:#fff;
      box-shadow:0 18px 34px rgba(22,93,255,.2);
    }
    .btn-light{
      background:#fff;
      color:var(--ink);
      border:1px solid var(--line);
    }
    .hero{
      padding:32px 0 20px;
    }
    .hero-inner{
      display:grid;
      grid-template-columns:1.08fr .92fr;
      gap:26px;
      align-items:stretch;
    }
    .hero-copy{
      padding:40px;
      border-radius:34px;
      background:
        radial-gradient(circle at top right, rgba(7,182,213,.18), transparent 28%),
        linear-gradient(135deg,#ffffff,#edf5ff);
      box-shadow:0 28px 60px rgba(15,23,42,.08);
    }
    .eyebrow{
      display:inline-block;
      padding:10px 14px;
      border-radius:999px;
      background:#e0f2fe;
      color:#0c4a6e;
      font-size:12px;
      font-weight:700;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    h1{
      margin:18px 0 14px;
      font:700 clamp(42px,7vw,78px)/.92 Georgia,serif;
      letter-spacing:-.06em;
      color:#091733;
    }
    .hero-copy p{
      max-width:60ch;
      color:var(--muted);
      font-size:18px;
      line-height:1.8;
      margin:0 0 26px;
    }
    .hero-actions{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-bottom:28px;
    }
    .quick-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
    }
    .quick-card{
      padding:16px;
      border-radius:18px;
      background:#fff;
      border:1px solid var(--line);
      box-shadow:0 10px 24px rgba(15,23,42,.04);
    }
    .quick-card strong{
      display:block;
      margin-bottom:6px;
      font-size:14px;
    }
    .quick-card span{
      color:var(--muted);
      font-size:13px;
      line-height:1.55;
    }
    .hero-panel{
      display:grid;
      gap:18px;
    }
    .search-card,.contact-card,.art-card{
      border-radius:30px;
      background:#fff;
      box-shadow:0 24px 50px rgba(15,23,42,.08);
      border:1px solid rgba(220,230,245,.88);
    }
    .search-card{
      padding:24px;
    }
    .search-card h2,.contact-card h2,.section h2{
      margin:0 0 14px;
      font:700 30px/1.05 Georgia,serif;
      letter-spacing:-.03em;
    }
    .search-row{
      display:grid;
      grid-template-columns:1fr 1fr auto;
      gap:12px;
      margin-top:14px;
    }
    .field{
      padding:14px 16px;
      border-radius:14px;
      border:1px solid var(--line);
      background:#f8fbff;
      color:#1e293b;
      font-size:14px;
    }
    .chip-list{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:16px;
    }
    .chip{
      padding:10px 12px;
      border-radius:999px;
      background:#eef6ff;
      color:#244a7b;
      font-size:13px;
      font-weight:700;
    }
    .contact-card{
      padding:24px;
      background:linear-gradient(135deg,#0c1f47,#133b86 58%,#0d7490);
      color:#fff;
    }
    .contact-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }
    .contact-tile{
      padding:16px;
      border-radius:18px;
      background:rgba(255,255,255,.08);
      min-height:120px;
    }
    .contact-tile strong{
      display:block;
      margin-bottom:8px;
      font-size:14px;
    }
    .contact-tile span{
      display:block;
      color:rgba(255,255,255,.8);
      font-size:13px;
      line-height:1.6;
    }
    .art-card{
      overflow:hidden;
      min-height:240px;
      background:
        radial-gradient(circle at 18% 22%, rgba(255,255,255,.88), transparent 22%),
        radial-gradient(circle at 78% 20%, rgba(7,182,213,.22), transparent 18%),
        linear-gradient(135deg,#dff8f5,#dbeafe 45%,#eff6ff 100%);
      position:relative;
    }
    .art-card::before,.art-card::after{
      content:"";
      position:absolute;
      border-radius:50%;
      background:rgba(22,93,255,.12);
    }
    .art-card::before{
      width:220px;
      height:220px;
      right:-40px;
      bottom:-30px;
    }
    .art-card::after{
      width:120px;
      height:120px;
      left:42px;
      bottom:34px;
    }
    .art-overlay{
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      padding:28px;
    }
    .network-card{
      width:min(360px,100%);
      padding:24px;
      border-radius:28px;
      background:rgba(255,255,255,.9);
      box-shadow:0 18px 36px rgba(15,23,42,.08);
    }
    .network-card h3{
      margin:0 0 10px;
      font:700 24px/1.1 Georgia,serif;
      letter-spacing:-.03em;
    }
    .network-card p{
      margin:0;
      color:var(--muted);
      line-height:1.7;
    }
    .section{
      padding:24px 0;
    }
    .section-header{
      display:flex;
      justify-content:space-between;
      align-items:end;
      gap:16px;
      margin-bottom:18px;
    }
    .section-header p{
      max-width:58ch;
      color:var(--muted);
      line-height:1.7;
      margin:0;
    }
    .card-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:18px;
    }
    .service-card,.city-card,.insight-card,.trust-card{
      padding:22px;
      border-radius:26px;
      background:#fff;
      border:1px solid rgba(220,230,245,.82);
      box-shadow:0 18px 36px rgba(15,23,42,.05);
    }
    .service-card h3,.city-card h3,.insight-card h3,.trust-card h3{
      margin:0 0 10px;
      font:700 22px/1.08 Georgia,serif;
      letter-spacing:-.03em;
    }
    .service-card p,.city-card p,.insight-card p,.trust-card p{
      margin:0;
      color:var(--muted);
      line-height:1.7;
      font-size:14px;
    }
    .service-icon{
      width:54px;
      height:54px;
      border-radius:18px;
      display:grid;
      place-items:center;
      margin-bottom:16px;
      font:700 16px/1 Arial,sans-serif;
      color:#fff;
      background:linear-gradient(135deg,var(--blue),var(--sky));
    }
    .city-card{
      background:linear-gradient(180deg,#fff,#f7fbff);
    }
    .city-badge{
      display:inline-block;
      margin-top:14px;
      padding:9px 12px;
      border-radius:999px;
      background:#eef6ff;
      color:#214e89;
      font-size:12px;
      font-weight:700;
    }
    .split{
      display:grid;
      grid-template-columns:1.05fr .95fr;
      gap:20px;
    }
    .trust-panel{
      padding:28px;
      border-radius:30px;
      background:linear-gradient(135deg,#0f172a,#123b85);
      color:#fff;
    }
    .trust-panel h2{
      color:#fff;
    }
    .trust-panel p{
      color:rgba(255,255,255,.82);
      line-height:1.8;
    }
    .stats-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
      margin-top:22px;
    }
    .stat{
      padding:18px;
      border-radius:20px;
      background:rgba(255,255,255,.08);
    }
    .stat strong{
      display:block;
      margin-bottom:8px;
      font-size:26px;
      font-family:Georgia,serif;
    }
    .stat span{
      color:rgba(255,255,255,.76);
      font-size:13px;
      line-height:1.5;
    }
    .insight-grid{
      display:grid;
      gap:18px;
    }
    .cta{
      padding:30px;
      border-radius:34px;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.16), transparent 24%),
        linear-gradient(135deg,var(--blue),#0f766e);
      color:#fff;
      display:grid;
      grid-template-columns:1fr auto;
      gap:18px;
      align-items:center;
      box-shadow:0 26px 60px rgba(22,93,255,.18);
    }
    .cta h2{
      color:#fff;
      margin:0 0 10px;
    }
    .cta p{
      margin:0;
      color:rgba(255,255,255,.82);
      line-height:1.75;
      max-width:58ch;
    }
    .footer{
      margin-top:18px;
      background:#071427;
      color:#d8e3f3;
    }
    .footer-inner{
      padding:30px 0 36px;
      display:grid;
      gap:22px;
    }
    .footer-grid{
      display:grid;
      grid-template-columns:1.2fr .9fr .9fr .9fr;
      gap:18px;
    }
    .footer h3{
      margin:0 0 12px;
      font:700 18px/1.1 Georgia,serif;
    }
    .footer p,.footer li{
      color:#aac0dd;
      line-height:1.7;
      font-size:14px;
    }
    .footer ul{
      list-style:none;
      padding:0;
      margin:0;
      display:grid;
      gap:8px;
    }
    .mini{
      font-size:13px;
      color:#8ba5c7;
      border-top:1px solid rgba(255,255,255,.08);
      padding-top:18px;
    }
    @media (max-width:1080px){
      .hero-inner,.split,.cta,.footer-grid{grid-template-columns:1fr}
      .card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .search-row,.contact-grid,.stats-grid,.quick-grid{grid-template-columns:1fr}
    }
    @media (max-width:640px){
      .card-grid{grid-template-columns:1fr}
      .nav-inner{flex-direction:column;align-items:flex-start}
      .menu{width:100%}
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>Emergency 1066 | Lifeline International +91 4043441066 | Health Helpline 1860-500-1066</div>
      <div class="top-links">
        <span>Book Appointment</span>
        <span>Find Doctors</span>
        <span>Contact Us</span>
      </div>
    </div>
  </div>

  <header class="nav">
    <div class="nav-inner">
      <div class="brand">
        <div class="brand-mark">N</div>
        <div class="brand-copy">
          <strong>NovaCare Hospitals</strong>
          <span>Multispeciality Hospital Network Demo</span>
        </div>
      </div>
      <nav class="menu">
        <a href="#services">Services</a>
        <a href="#cities">Hospitals</a>
        <a href="#programs">Programs</a>
        <a href="#library">Health Library</a>
        <a href="../index.html">Back to Main Showcase</a>
        <a class="btn btn-primary" href="#appointment">Book Appointment</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">Inspired by Large Hospital Networks</span>
        <h1>Advanced care, specialist access, and hospital discovery in one premium homepage</h1>
        <p>This separate demo is inspired by enterprise healthcare websites like Apollo Hospitals, with large-scale service navigation, quick hospital discovery, patient action shortcuts, centres of excellence, and a trust-led hospital network presentation.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#appointment">Book Appointment</a>
          <a class="btn btn-light" href="#services">Explore Specialties</a>
        </div>
        <div class="quick-grid">
          <div class="quick-card"><strong>Book Appointment</strong><span>Connect patients to doctors and hospital locations from the first screen.</span></div>
          <div class="quick-card"><strong>Find Hospital</strong><span>Help users discover nearby hospitals by city, service line, or urgency.</span></div>
          <div class="quick-card"><strong>Health Check</strong><span>Promote preventive packages, screening journeys, and executive checkups.</span></div>
          <div class="quick-card"><strong>Expert Opinion</strong><span>Create a fast path for second opinions and complex case routing.</span></div>
        </div>
      </div>

      <div class="hero-panel">
        <div class="search-card" id="appointment">
          <h2>Search hospitals, doctors, and specialties</h2>
          <div class="search-row">
            <div class="field">Select City</div>
            <div class="field">Choose Specialty</div>
            <a class="btn btn-primary" href="#cities">Search</a>
          </div>
          <div class="chip-list">
            <span class="chip">Cardiology</span>
            <span class="chip">Oncology</span>
            <span class="chip">Neurosciences</span>
            <span class="chip">Orthopaedics</span>
            <span class="chip">Emergency</span>
          </div>
        </div>

        <div class="contact-card">
          <h2>Patient quick access</h2>
          <div class="contact-grid">
            <div class="contact-tile"><strong>Emergency</strong><span>24/7 command center and ambulance support across major locations.</span></div>
            <div class="contact-tile"><strong>International Desk</strong><span>Dedicated coordination for travel, treatment planning, and admission support.</span></div>
            <div class="contact-tile"><strong>Digital Health</strong><span>Second opinion, remote consultations, reports, and digital follow-up journeys.</span></div>
          </div>
        </div>

        <div class="art-card">
          <div class="art-overlay">
            <div class="network-card">
              <h3>Built for a national hospital brand</h3>
              <p>Use this concept as a premium enterprise healthcare landing page for multispeciality groups, city hospital networks, or trust-led medical institutions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="services">
    <div class="section-header">
      <div>
        <h2>Centres of Excellence</h2>
        <p>Apollo’s site emphasizes broad specialty-led care. This inspired version mirrors that product structure with strong service discovery blocks and clear clinical positioning.</p>
      </div>
    </div>
    <div class="card-grid">
      <article class="service-card"><div class="service-icon">CV</div><h3>Cardiac Sciences</h3><p>Advanced intervention, surgery pathways, rehab coordination, and long-term heart health programs.</p></article>
      <article class="service-card"><div class="service-icon">ON</div><h3>Oncology</h3><p>Integrated cancer care with diagnostics, precision treatment planning, and multidisciplinary coordination.</p></article>
      <article class="service-card"><div class="service-icon">NS</div><h3>Neurosciences</h3><p>Stroke, spine, neuro intervention, recovery planning, and complex neurological case management.</p></article>
      <article class="service-card"><div class="service-icon">OR</div><h3>Orthopaedics</h3><p>Joint care, trauma, sports rehabilitation, and post-operative recovery programs under one service line.</p></article>
    </div>
  </section>

  <section class="section" id="cities">
    <div class="section-header">
      <div>
        <h2>Hospital Network by City</h2>
        <p>The live Apollo site highlights a broad city footprint. This concept turns that into a polished discovery grid for flagship hospital locations and regional presence.</p>
      </div>
    </div>
    <div class="card-grid">
      <article class="city-card"><h3>Chennai</h3><p>Flagship tertiary care campus with high-acuity services, surgical depth, and premium inpatient experiences.</p><span class="city-badge">8 hospital units</span></article>
      <article class="city-card"><h3>Hyderabad</h3><p>Specialty-led hospital discovery for metro patients with emergency, oncology, and cardiac pathways.</p><span class="city-badge">5 major locations</span></article>
      <article class="city-card"><h3>Bengaluru</h3><p>Fast access to specialists, digital appointment flow, and strong executive-health positioning.</p><span class="city-badge">4 urban campuses</span></article>
      <article class="city-card"><h3>Delhi NCR</h3><p>High-visibility metro landing page model for premium tertiary and quaternary care presentation.</p><span class="city-badge">3 key hubs</span></article>
    </div>
  </section>

  <section class="section" id="programs">
    <div class="split">
      <div class="trust-panel">
        <h2>Why patients choose a hospital group like this</h2>
        <p>Patients evaluate large hospital networks on trust, outcomes, specialist depth, emergency readiness, and ease of access. The Apollo homepage leans heavily into those signals, so this inspired page does the same with a polished enterprise presentation.</p>
        <div class="stats-grid">
          <div class="stat"><strong>70+</strong><span>Specialty programs and integrated centres of care</span></div>
          <div class="stat"><strong>30+</strong><span>Urban and regional access points across major cities</span></div>
          <div class="stat"><strong>24/7</strong><span>Emergency coordination, digital support, and triage pathways</span></div>
          <div class="stat"><strong>1</strong><span>Unified hospital brand experience across patient journeys</span></div>
        </div>
      </div>

      <div class="insight-grid" id="library">
        <article class="insight-card">
          <h3>Preventive Programs</h3>
          <p>Feature executive checkups, women’s health, senior wellness, heart-risk screening, and corporate health programs as conversion drivers.</p>
        </article>
        <article class="insight-card">
          <h3>Health Library</h3>
          <p>Add a scalable content engine for diseases, treatments, symptoms, diagnostics, and medicine explainers to strengthen SEO and patient education.</p>
        </article>
        <article class="insight-card">
          <h3>International Patient Services</h3>
          <p>Provide clear global inquiry, travel support, and treatment coordination for a hospital group targeting international audiences.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="cta">
      <div>
        <h2>Want this adapted for your own hospital brand?</h2>
        <p>This separate demo can be turned into a full hospital-group website with custom branding, city pages, doctor directories, specialty landing pages, and appointment flows.</p>
      </div>
      <a class="btn btn-light" href="../index.html">Back to Demo Showcase</a>
    </div>
  </section>

  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <h3>NovaCare Hospitals</h3>
          <p>A concept-only multispeciality hospital network website built as a separate GitHub Pages demo, inspired by the information architecture and premium healthcare feel of enterprise hospital brands such as Apollo Hospitals.</p>
        </div>
        <div>
          <h3>Core Sections</h3>
          <ul>
            <li>Book Appointment</li>
            <li>Find Hospital</li>
            <li>Centres of Excellence</li>
            <li>Health Checks</li>
          </ul>
        </div>
        <div>
          <h3>Programs</h3>
          <ul>
            <li>Preventive Care</li>
            <li>Emergency Access</li>
            <li>Second Opinion</li>
            <li>International Patients</li>
          </ul>
        </div>
        <div>
          <h3>Important</h3>
          <ul>
            <li>Demo content only</li>
            <li>Not an official hospital website</li>
            <li>No live booking backend</li>
            <li>Built for showcase use</li>
          </ul>
        </div>
      </div>
      <div class="mini">This page is an inspired original demo and is not affiliated with Apollo Hospitals.</div>
    </div>
  </footer>
</body>
</html>`;
}

function main() {
  cleanDocs();

  const doctorRecords = readDoctorsFromCsv();
  validateDoctors(doctorRecords);
  const doctors = doctorRecords.map(normalizeDoctor);
  const staticFiles = generateStaticPages(doctors);
  const doctorFiles = generateDoctorPages(doctors);
  const files = [...staticFiles, ...doctorFiles];
  const urls = getGeneratedUrls(doctors);

  logGenerationResult(files, urls);
}

try {
  main();
} catch (error) {
  console.error(`Generation failed: ${error.message}`);
  process.exitCode = 1;
}
