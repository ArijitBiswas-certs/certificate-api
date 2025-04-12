// Required packages
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// In-memory data storage
const templates = [
  { 
    id: "temp-001", 
    name: "Professional Certification", 
    description: "Standard certification for professional achievements" 
  },
  { 
    id: "temp-002", 
    name: "Course Completion", 
    description: "Certification for completing a specific course" 
  },
  { 
    id: "temp-003", 
    name: "Award of Excellence", 
    description: "Special recognition for outstanding performance" 
  }
];

const badges = [
  { 
    id: "badge-001", 
    name: "Gold", 
    description: "Top tier achievement" 
  },
  { 
    id: "badge-002", 
    name: "Silver", 
    description: "High level of proficiency" 
  },
  { 
    id: "badge-003", 
    name: "Bronze", 
    description: "Standard level of competence" 
  }
];

// Store issued certificates
const certificates = [];

// Additional data: certificate signatories
const signatories = [
  {
    id: "sig-001",
    name: "Dr. Jane Smith",
    title: "Program Director",
    signature: "JSmith2025"
  },
  {
    id: "sig-002",
    name: "Prof. Robert Johnson",
    title: "Department Chair",
    signature: "RJohnson"
  },
  {
    id: "sig-003",
    name: "Alex Williams",
    title: "CEO",
    signature: "AWilliams"
  }
];

// 1. API to get available templates
app.get('/api/templates', (req, res) => {
  res.json({ 
    success: true, 
    data: templates 
  });
});

// 2. API to get available badges
app.get('/api/badges', (req, res) => {
  res.json({ 
    success: true, 
    data: badges 
  });
});

// 3. API to get available signatories
app.get('/api/signatories', (req, res) => {
  res.json({
    success: true,
    data: signatories
  });
});

// 4. API to create a certificate
app.post('/api/certificates', (req, res) => {
  const { name, email, templateId, badgeId, issuanceDate, expiryDate, signatoryIds } = req.body;
  
  // Validations
  if (!name || !email || !templateId || !badgeId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields: name, email, templateId, and badgeId are required' 
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid email format' 
    });
  }
  
  // Validate template exists
  const template = templates.find(t => t.id === templateId);
  if (!template) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid template ID' 
    });
  }
  
  // Validate badge exists
  const badge = badges.find(b => b.id === badgeId);
  if (!badge) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid badge ID' 
    });
  }
  
  // Validate signatories if provided
  let certificateSignatories = [];
  if (signatoryIds && Array.isArray(signatoryIds)) {
    certificateSignatories = signatoryIds.map(id => {
      const signatory = signatories.find(s => s.id === id);
      if (!signatory) {
        return null;
      }
      return {
        id: signatory.id,
        name: signatory.name,
        title: signatory.title
      };
    }).filter(s => s !== null);
  }
  
  const today = new Date().toISOString().split('T')[0];
  const parsedIssuanceDate = issuanceDate || today;
  
  // Default expiry to 1 year from issuance if not provided
  let parsedExpiryDate = expiryDate;
  if (!parsedExpiryDate) {
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);
    parsedExpiryDate = expDate.toISOString().split('T')[0];
  }
  
  // Create certificate
  const certificate = {
    id: uuidv4(),
    name,
    email,
    templateId,
    templateName: template.name,
    badgeId,
    badgeName: badge.name,
    signatories: certificateSignatories,
    issuanceDate: parsedIssuanceDate,
    expiryDate: parsedExpiryDate,
    status: "active",
    createdAt: new Date().toISOString()
  };
  
  certificates.push(certificate);
  
  res.status(201).json({ 
    success: true, 
    data: certificate 
  });
});

// 5. API to generate certificate preview
app.post('/api/certificates/preview', (req, res) => {
  const { name, templateId, badgeId, signatoryIds } = req.body;
  
  // Basic validations
  if (!name || !templateId || !badgeId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name, template ID, and badge ID are required for preview' 
    });
  }
  
  // Validate template exists
  const template = templates.find(t => t.id === templateId);
  if (!template) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid template ID' 
    });
  }
  
  // Validate badge exists
  const badge = badges.find(b => b.id === badgeId);
  if (!badge) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid badge ID' 
    });
  }
  
  // Get signatories if provided
  let previewSignatories = [];
  if (signatoryIds && Array.isArray(signatoryIds)) {
    previewSignatories = signatoryIds.map(id => {
      const signatory = signatories.find(s => s.id === id);
      if (!signatory) {
        return null;
      }
      return {
        id: signatory.id,
        name: signatory.name,
        title: signatory.title
      };
    }).filter(s => s !== null);
  }
  
  // Create certificate preview
  const preview = {
    previewId: uuidv4(),
    name,
    templateId,
    templateName: template.name,
    badgeId,
    badgeName: badge.name,
    signatories: previewSignatories,
    previewDate: new Date().toISOString(),
    // Simple HTML representation of the certificate (just for demo)
    previewHtml: `
      <div style="border: 2px solid gold; padding: 20px; text-align: center; max-width: 800px; margin: 0 auto;">
        <h1>${template.name}</h1>
        <h2>This certificate is presented to</h2>
        <h1>${name}</h1>
        <p>with a ${badge.name} badge of achievement</p>
        ${previewSignatories.length > 0 ? 
          `<div style="margin-top: 50px;">
            ${previewSignatories.map(sig => 
              `<div style="display: inline-block; margin: 0 20px;">
                <p style="border-top: 1px solid black; padding-top: 5px;">${sig.name}</p>
                <p>${sig.title}</p>
              </div>`
            ).join('')}
          </div>` : ''
        }
      </div>
    `
  };
  
  res.json({ 
    success: true, 
    data: preview 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Certificate API server running on port ${PORT}`);
});

module.exports = app;