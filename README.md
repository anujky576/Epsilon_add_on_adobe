# 🎨 Epsilon - Adobe Express Add-on

> **Intelligent Brand Compliance Analysis for Adobe Express Designs**  
> Automatically detect and fix brand guideline violations using AI-powered analysis.

[![Adobe Express](https://img.shields.io/badge/Adobe%20Express-Add--on-FF0000?style=flat&logo=adobe&logoColor=white)](https://www.adobe.com/express/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 📖 Overview

**Epsilon** is an intelligent Adobe Express add-on that ensures your designs comply with brand guidelines. It analyzes colors, typography, logos, accessibility, and tone—providing real-time feedback and automated fixes powered by Google Gemini AI.

### ✨ Key Features

- 🎨 **Brand Compliance Analysis** - Automated checking of colors, fonts, logos, and more
- 🤖 **AI-Powered Insights** - Google Gemini AI generates contextual suggestions
- 🔧 **Auto-Fix Violations** - One-click fixes for common brand guideline issues
- 📊 **Detailed Analytics** - Track compliance trends and violation patterns
- 🔍 **Brand Kit Comparison** - Compare your brand against competitors (Premium)
- ♿ **Accessibility Checks** - WCAG-compliant contrast and readability validation
- 📈 **Executive Reports** - Generate shareable compliance reports

---

## 🏗️ Architecture

This project consists of three main components:

```
├── brandguard-addon/      # Adobe Express Add-on (Frontend)
├── backend/               # Node.js API Server (Backend)
└── dashboard/             # React Analytics Dashboard (Web App)
```

### Technology Stack

| Component | Technologies |
|-----------|--------------|
| **Add-on** | HTML, CSS, JavaScript, Adobe Express SDK |
| **Backend** | Node.js, Express, MongoDB, Google Gemini AI |
| **Dashboard** | React, Vite, TailwindCSS |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **MongoDB** (local or Atlas)
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))
- **Adobe Express** account

### Installation

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/anujky576/Epsilon_add_on_adobe.git
cd Epsilon_add_on_adobe
```

#### 2️⃣ Setup Backend

```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your MongoDB URI and Gemini API key
```

**Required Environment Variables:**

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/brandguard
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

**Start Backend Server:**

```bash
npm run dev
```

Server runs at: `http://localhost:3000`

#### 3️⃣ Setup Adobe Express Add-on

```bash
cd ../brandguard-addon
npm install

# Build the add-on
npm run build

# Package for distribution (creates .ccx file)
npm run package
```

#### 4️⃣ Setup Dashboard (Optional)

```bash
cd ../dashboard
npm install
npm run dev
```

Dashboard runs at: `http://localhost:5173`

---

## 📱 Usage

### Installing the Add-on in Adobe Express

1. Open **Adobe Express** in your browser
2. Go to **Add-ons** → **Your Add-ons**
3. Click **Manage** → **Upload Add-on**
4. Select the `.ccx` file from `brandguard-addon/dist/`
5. The add-on will appear in your **Add-ons** panel

### Using the Add-on

1. **Login** - Sign in with your email
2. **Upload Brand Kit** - Define your brand colors, fonts, logo rules, and tone guidelines
3. **Analyze Design** - Click "Analyze" to check your current design against the brand kit
4. **Review Results** - See compliance score, violations, and category breakdowns
5. **Auto-Fix** - Apply suggested fixes with one click
6. **Compare Brands** - Compare your brand kit with competitors (Premium feature)

---

## 🎯 Features Deep Dive

### 1. Brand Compliance Analysis

**What it checks:**

| Category | Weight | Checks |
|----------|--------|--------|
| **Color** | 30% | Brand palette compliance, color tolerance matching |
| **Typography** | 25% | Approved font usage, font hierarchy |
| **Logo** | 20% | Size requirements, aspect ratio, clear space |
| **Accessibility** | 15% | WCAG contrast ratios, text readability |
| **Tone** | 10% | Banned words, messaging guidelines |

**Compliance Score Interpretation:**

- **90-100** (Excellent) - Fully brand compliant
- **70-89** (Good) - Minor issues, easily fixed
- **50-69** (Needs Work) - Multiple violations
- **0-49** (Poor) - Major revisions needed

### 2. AI-Powered Analysis

Google Gemini AI provides:
- Contextual violation descriptions
- Intelligent fix suggestions
- Executive summaries for stakeholders
- Brand personality insights

### 3. Auto-Fix Engine

Automatically fixes:
- Off-brand colors → Replace with closest brand color
- Unapproved fonts → Swap with approved typography
- Small logos → Resize to minimum dimensions
- Low contrast text → Adjust for WCAG compliance

### 4. Brand Kit Comparison (Premium)

Compare your brand against:
- Competitors in your industry
- Similar brands in the market
- Historical brand versions

Get insights on:
- Visual similarity percentage
- Differentiation opportunities
- Strategic recommendations

---

## 🔌 API Documentation

### Core Endpoints

```
POST   /api/brandkit              Create brand kit
POST   /api/design                Submit design for analysis
POST   /api/analysis/run          Run compliance analysis
GET    /api/analysis/:id          Get analysis results
POST   /api/autofix/apply         Apply auto-fix suggestions
GET    /api/analytics/overview    Get compliance analytics
POST   /api/report/generate       Generate PDF report
```

Full API documentation: See [backend/README.md](backend/README.md)

---

## 📊 Analytics Dashboard

The dashboard provides:

- **Overview** - Total scans, average compliance, trends
- **Violations** - Most common issues by category
- **Score Distribution** - Range analysis of all designs
- **Trends** - 7-day compliance trend charts
- **Reports** - Historical report access

Access at: `http://localhost:5173` (after running dashboard)

---

## 🛠️ Development

### Project Structure

```
Epsilon_add_on_adobe/
│
├── brandguard-addon/
│   ├── src/
│   │   ├── index.html          # Add-on UI
│   │   ├── index.js            # Add-on logic
│   │   ├── code.js             # Adobe SDK integration
│   │   └── manifest.json       # Add-on configuration
│   └── dist/                   # Built files
│
├── backend/
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/             # MongoDB schemas
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   └── utils/              # Helpers
│   └── server.js
│
└── dashboard/
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Page views
    │   ├── api/                # API client
    │   └── hooks/              # Custom hooks
    └── public/
```

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Add-on validation
cd brandguard-addon
npm run validate
```

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build add-on
cd brandguard-addon
npm run build
npm run package

# Build dashboard
cd dashboard
npm run build
```

---

## 🎨 Customization

### Adding Custom Brand Rules

Edit your brand kit to include:

```json
{
  "colors": [
    { "name": "Primary", "hex": "#FF6B35" },
    { "name": "Secondary", "hex": "#004E89" }
  ],
  "fonts": [
    { "name": "Roboto", "weights": ["400", "700"] }
  ],
  "logoRules": {
    "minWidth": 100,
    "minHeight": 100,
    "clearSpace": 20
  },
  "toneRules": {
    "style": "professional",
    "bannedWords": ["cheap", "free"]
  }
}
```

### Modifying Analysis Weights

In [backend/src/controllers/analysis.controller.js](backend/src/controllers/analysis.controller.js):

```javascript
const categoryWeights = {
  color: 0.3,        // 30%
  typography: 0.25,  // 25%
  logo: 0.2,         // 20%
  accessibility: 0.15, // 15%
  tone: 0.1          // 10%
};
```

---

## 🚧 Roadmap

- [ ] Multi-language support
- [ ] Figma plugin version
- [ ] AI-generated brand kits
- [ ] Team collaboration features
- [ ] Advanced analytics with ML insights
- [ ] White-label version for agencies

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Adobe** - For the Express Add-on SDK
- **Google** - For Gemini AI API
- **MongoDB** - For database infrastructure
- **Community** - For feedback and contributions

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/anujky576/Epsilon_add_on_adobe/issues)
- **Email**: support@brandguard.ai
- **Documentation**: [Wiki](https://github.com/anujky576/Epsilon_add_on_adobe/wiki)

---

## 🌟 Screenshots

### Add-on Interface
![BrandGuard Add-on](https://via.placeholder.com/800x500?text=Add-on+Interface)

### Analysis Results
![Analysis Results](https://via.placeholder.com/800x500?text=Analysis+Results)

### Analytics Dashboard
![Analytics Dashboard](https://via.placeholder.com/800x500?text=Analytics+Dashboard)

---

<div align="center">
  <p>Built with ❤️ for designers and brand managers</p>
  <p>© 2026 Epsilon. All rights reserved.</p>
</div>
