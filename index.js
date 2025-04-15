const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

// Serve static files from src/images
const path = require('path');
app.use('/images', express.static(path.join(__dirname, 'src/images')));

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
app.post("/api/certificates", (req, res) => {
  // Validate base required fields (name and email)
  let missingBase = validateFields(req.body, baseRequired);
  if (missingBase) {
    return res.status(400).json({
      success: false,
      message: `Missing required field: ${missingBase}`,
    });
  }

  const { name, email, templateId } = req.body;

  // Validate template exists
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

  // If badgeId is required, validate its existence.
  if (template.requiredFields.includes("badgeId")) {
    const badge = badges.find((b) => b.id === req.body.badgeId);
    if (!badge) {
      return res.status(400).json({
        success: false,
        message: "Invalid badge ID",
      });
    }
  }

  // If signatoryIds is required, check that it's an array and that at least one valid signatory exists.
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
          ? {
              id: signatory.id,
              name: signatory.name,
              title: signatory.title,
            }
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

  // Email regex validation (applies to all certificates)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // Use provided issuanceDate or default to today.
  const today = new Date().toISOString().split("T")[0];
  const issuanceDate = req.body.issuanceDate || today;

  // For expiryDate, if required then it must be provided; otherwise, default to 1 year from issuance.
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

  // Collect additional custom attributes required by the template.
  // In this example, they are certificateNumber and recipientName.
  const customAttributes = {};
  template.requiredFields.forEach((field) => {
    if (
      !["badgeId", "expiryDate", "signatoryIds", "issuanceDate"].includes(field)
    ) {
      customAttributes[field] = req.body[field];
    }
  });

  // Create the certificate object
  const certificate = {
    id: uuidv4(),
    name,
    email,
    templateId,
    templateName: template.name,
    badgeId: req.body.badgeId || null,
    badgeName: req.body.badgeId
      ? badges.find((b) => b.id === req.body.badgeId).name
      : null,
    expiryDate,
    signatories: certificateSignatories,
    issuanceDate,
    customAttributes,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  certificates.push(certificate);

  res.status(201).json({
    success: true,
    data: certificate,
  });
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