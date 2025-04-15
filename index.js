const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { createCanvas, loadImage } = require("canvas");

const app = express();
const PORT = 3000;

// Serve static files from src/images
const path = require("path");
app.use("/images", express.static(path.join(__dirname, "src/images")));
app.use("/issued", express.static(path.join(__dirname, "src/issued")));

// Parse JSON bodies
app.use(bodyParser.json());

// Standardized required fields for certificates:
const baseRequired = ["name", "email"];

// Each template now defines its own set of additional required fields using standardized names.
const templates = [
  {
    id: "temp-001",
    name: "Professional Certification",
    description: "Standard certification for professional achievements",
    image: "/images/temp-001.jpg",
    // Requires badgeId, expiryDate, signatoryIds, issuanceDate, certificateNumber and recipientName.
    requiredFields: [
      "badgeId",
      "expiryDate",
      "signatoryIds",
      "issuanceDate",
      "certificateNumber",
      "recipientName",
    ],
  },
  {
    id: "temp-002",
    name: "Course Completion",
    description: "Certification for completing a specific course",
    image: "/images/temp-002.jpg",
    // This certificate does NOT require badgeId or signatories – only dates and custom attributes.
    requiredFields: [
      "issuanceDate",
      "expiryDate",
      "certificateNumber",
      "recipientName",
    ],
  },
  {
    id: "temp-003",
    name: "Award of Excellence",
    description: "Special recognition for outstanding performance",
    image: "/images/temp-003.jpg",
    // Requires badgeId and custom fields but not signatories or expiryDate
    requiredFields: [
      "badgeId",
      "issuanceDate",
      "certificateNumber",
      "recipientName",
    ],
  },
];

const badges = [
  {
    id: "badge-001",
    name: "Gold",
    description: "Top tier achievement",
    image: "/images/badge-001.jpg",
  },
  {
    id: "badge-002",
    name: "Silver",
    description: "High level of proficiency",
    image: "/images/badge-002.jpg",
  },
  {
    id: "badge-003",
    name: "Bronze",
    description: "Standard level of competence",
    image: "/images/badge-003.jpg",
  },
];

// Store issued certificates
const certificates = [];

// Additional data: certificate signatories
const signatories = [
  {
    id: "sig-001",
    name: "Dr. Jane Smith",
    title: "Program Director",
    signature: "JSmith2025",
  },
  {
    id: "sig-002",
    name: "Prof. Robert Johnson",
    title: "Department Chair",
    signature: "RJohnson",
  },
  {
    id: "sig-003",
    name: "Alex Williams",
    title: "CEO",
    signature: "AWilliams",
  },
];

// Helper function to check if required fields are present in an object.
function validateFields(obj, fields) {
  for (let field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      return field;
    }
  }
  return null;
}

// 1. API to get available templates
app.get("/api/templates", (req, res) => {
  res.json({
    success: true,
    data: templates,
  });
});

// 2. API to get available badges
app.get("/api/badges", (req, res) => {
  res.json({
    success: true,
    data: badges,
  });
});

// 3. API to get available signatories
app.get("/api/signatories", (req, res) => {
  res.json({
    success: true,
    data: signatories,
  });
});

// 4. API to create a certificate
app.post("/api/certificates", async (req, res) => {
  const { name, email, templateId } = req.body;

  // Validate base required fields (from OpenAPI schema)
  const baseRequired = ["name", "email", "templateId"];
  let missingBase = validateFields(req.body, baseRequired);
  if (missingBase) {
    return res.status(400).json({
      success: false,
      message: `Missing required field: ${missingBase}`,
    });
  }

  // Find template
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(400).json({
      success: false,
      message: "Invalid template ID",
    });
  }

  // 🔁 Auto-map name to recipientName if required by template
  if (
    template.requiredFields?.includes("recipientName") &&
    !req.body.recipientName
  ) {
    req.body.recipientName = req.body.name;
  }

  // Validate template-specific required fields
  let missingTemplateField = validateFields(
    req.body,
    template.requiredFields || []
  );
  if (missingTemplateField) {
    return res.status(400).json({
      success: false,
      message: `Missing required attribute: ${missingTemplateField}`,
    });
  }

  // Validate badge if required
  if (template.requiredFields.includes("badgeId")) {
    const badge = badges.find((b) => b.id === req.body.badgeId);
    if (!badge) {
      return res.status(400).json({
        success: false,
        message: "Invalid badge ID",
      });
    }
  }

  // Validate signatories
  let certificateSignatories = [];
  if (template.requiredFields.includes("signatoryIds")) {
    if (
      !Array.isArray(req.body.signatoryIds) ||
      req.body.signatoryIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "signatoryIds must be a non-empty array",
      });
    }

    certificateSignatories = req.body.signatoryIds
      .map((id) => {
        const signatory = signatories.find((s) => s.id === id);
        return signatory
          ? { id: signatory.id, name: signatory.name, title: signatory.title }
          : null;
      })
      .filter((s) => s !== null);

    if (certificateSignatories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid signatory IDs provided",
      });
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // Set issuanceDate (default: today)
  const today = new Date().toISOString().split("T")[0];
  const issuanceDate = req.body.issuanceDate || today;

  // Set expiryDate (default: 1 year later if not required)
  let expiryDate = req.body.expiryDate;
  if (template.requiredFields.includes("expiryDate")) {
    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required attribute: expiryDate",
      });
    }
  } else if (!expiryDate) {
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);
    expiryDate = expDate.toISOString().split("T")[0];
  }

  // Collect custom attributes
  const customAttributes = {};
  template.requiredFields.forEach((field) => {
    if (
      !["badgeId", "expiryDate", "signatoryIds", "issuanceDate"].includes(field)
    ) {
      customAttributes[field] = req.body[field];
    }
  });

  const badgeName = req.body.badgeId
    ? badges.find((b) => b.id === req.body.badgeId)?.name || null
    : null;

  const certificate = {
    id: uuidv4(),
    name,
    email,
    templateId,
    templateName: template.name,
    badgeId: req.body.badgeId || null,
    badgeName,
    expiryDate,
    signatories: certificateSignatories,
    issuanceDate,
    customAttributes,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  certificates.push(certificate);

  // 🧹 Delete existing certificate image (if any)
  const outputDir = path.join(__dirname, "src", "issued");
  const outputPath = path.join(outputDir, "newCertificate.png");

  // ✅ Ensure 'issued' directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // 🖼️ Generate certificate image
    const width = 1200;
    const height = 850;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const templatePath = path.join(__dirname, "src", template.image);
    const backgroundImage = await loadImage(templatePath);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    ctx.fillStyle = "#000";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText(certificate.name, width / 2, 250);

    if (certificate.badgeName) {
      ctx.font = "30px Arial";
      ctx.fillText(`Awarded: ${certificate.badgeName}`, width / 2, 310);
    }

    ctx.font = "28px Arial";
    ctx.fillText(`Issued on: ${certificate.issuanceDate}`, width / 2, 370);

    if (certificate.expiryDate) {
      ctx.fillText(`Valid till: ${certificate.expiryDate}`, width / 2, 410);
    }

    let y = 470;
    ctx.font = "26px Arial";
    for (const key in certificate.customAttributes) {
      ctx.fillText(
        `${key}: ${certificate.customAttributes[key]}`,
        width / 2,
        y
      );
      y += 40;
    }

    if (certificate.signatories?.length) {
      y += 60;
      certificate.signatories.forEach((sig) => {
        ctx.fillText(`${sig.name}, ${sig.title}`, width / 2, y);
        y += 40;
      });
    }

    // 💾 Save image to disk
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on("finish", () => {
      return res.status(200).json({
        success: true,
        message: "Certificate generated successfully",
        imagePath: "issued/newCertificate.png",
        certificateId: certificate.id,
      });
    });
  } catch (err) {
    console.error("Image generation error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate certificate image",
    });
  }
});

// 5. API to generate certificate preview
app.post("/api/certificates/preview", (req, res) => {
  // Validate base required fields
  let missingBase = validateFields(req.body, baseRequired);
  if (missingBase) {
    return res.status(400).json({
      success: false,
      message: `Missing required field: ${missingBase}`,
    });
  }

  const { name, templateId } = req.body;

  // Validate template existence
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(400).json({
      success: false,
      message: "Invalid template ID",
    });
  }

  // Validate additional required fields as specified by the template.
  let missingTemplateField = validateFields(
    req.body,
    template.requiredFields || []
  );
  if (missingTemplateField) {
    return res.status(400).json({
      success: false,
      message: `Missing required attribute: ${missingTemplateField}`,
    });
  }

  // Validate badge if required.
  let badge = null;
  if (template.requiredFields.includes("badgeId")) {
    badge = badges.find((b) => b.id === req.body.badgeId);
    if (!badge) {
      return res.status(400).json({
        success: false,
        message: "Invalid badge ID",
      });
    }
  }

  // Validate signatories if required.
  let previewSignatories = [];
  if (template.requiredFields.includes("signatoryIds")) {
    if (
      !Array.isArray(req.body.signatoryIds) ||
      req.body.signatoryIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "signatoryIds must be a non-empty array",
      });
    }
    previewSignatories = req.body.signatoryIds
      .map((id) => {
        const signatory = signatories.find((s) => s.id === id);
        return signatory
          ? {
              id: signatory.id,
              name: signatory.name,
              title: signatory.title,
            }
          : null;
      })
      .filter((s) => s !== null);
  }

  // Build custom attributes HTML for preview.
  let customAttributesHtml = "";
  // We assume custom attributes are those that are not base keys or the known ones.
  Object.keys(req.body).forEach((key) => {
    if (
      !baseRequired.includes(key) &&
      ![
        "templateId",
        "badgeId",
        "expiryDate",
        "signatoryIds",
        "issuanceDate",
      ].includes(key)
    ) {
      customAttributesHtml += `<p><strong>${key}:</strong> ${req.body[key]}</p>`;
    }
  });

  // Build the preview HTML.
  const previewHtml = `
    <div style="border: 2px solid gold; padding: 20px; text-align: center; max-width: 800px; margin: 0 auto;">
      <h1>${template.name}</h1>
      <h2>This certificate is presented to</h2>
      <h1>${name}</h1>
      ${badge ? `<p>with a ${badge.name} badge of achievement</p>` : ""}
      ${req.body.expiryDate ? `<p>Expiry Date: ${req.body.expiryDate}</p>` : ""}
      ${customAttributesHtml}
      ${
        previewSignatories.length > 0
          ? `<div style="margin-top: 50px;">` +
            previewSignatories
              .map(
                (sig) =>
                  `<div style="display: inline-block; margin: 0 20px;">
              <p style="border-top: 1px solid black; padding-top: 5px;">${sig.name}</p>
              <p>${sig.title}</p>
            </div>`
              )
              .join("") +
            `</div>`
          : ""
      }
    </div>
  `;

  const preview = {
    previewId: uuidv4(),
    name,
    templateId,
    templateName: template.name,
    badgeId: req.body.badgeId || null,
    badgeName: badge ? badge.name : null,
    expiryDate: req.body.expiryDate || null,
    signatories: previewSignatories,
    issuanceDate: req.body.issuanceDate || today,
    customAttributes: Object.keys(req.body).reduce((attrs, key) => {
      if (
        !baseRequired.includes(key) &&
        ![
          "templateId",
          "badgeId",
          "expiryDate",
          "signatoryIds",
          "issuanceDate",
        ].includes(key)
      ) {
        attrs[key] = req.body[key];
      }
      return attrs;
    }, {}),
    previewDate: new Date().toISOString(),
    previewHtml,
  };

  res.json({
    success: true,
    data: preview,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Certificate API server running on port ${PORT}`);
});

module.exports = app;
