# Epsilon Backend

**Production-grade, API-first SaaS Backend for Brand Compliance Checking**

Epsilon analyzes Adobe Express designs against brand guidelines using Google Gemini AI. It detects violations in colors, typography, logos, accessibility, and tone—then suggests fixes.

---

## 🚀 Quick Start

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

Server runs at: `http://localhost:3000`

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/        # HTTP request handlers
│   │   ├── brandKit.controller.js
│   │   ├── design.controller.js
│   │   ├── analysis.controller.js    # Core analysis orchestration
│   │   ├── autofix.controller.js
│   │   ├── analytics.controller.js
│   │   └── report.controller.js
│   │
│   ├── models/             # MongoDB schemas
│   │   ├── BrandKit.js     # Brand rules definition
│   │   ├── Design.js       # Canvas design data
│   │   ├── AnalysisResult.js
│   │   ├── Report.js
│   │   └── User.js
│   │
│   ├── routes/             # API endpoint definitions
│   │   ├── brandKit.routes.js
│   │   ├── design.routes.js
│   │   ├── analysis.routes.js
│   │   ├── autofix.routes.js
│   │   ├── analytics.routes.js
│   │   └── report.routes.js
│   │
│   ├── services/           # Business logic
│   │   ├── gemini.service.js        # AI integration
│   │   ├── colorCheck.service.js    # Delta-E color matching
│   │   ├── fontCheck.service.js     # Typography validation
│   │   ├── logoCheck.service.js     # Logo size/ratio checks
│   │   ├── accessibility.service.js # WCAG compliance
│   │   ├── toneCheck.service.js     # Banned words, tone
│   │   └── autoFix.service.js       # Auto-fix generation
│   │
│   ├── utils/
│   │   ├── response.js     # Standardized API responses
│   │   └── logger.js       # Colored console logging
│   │
│   ├── app.js              # Express app configuration
│   └── server.js           # Server entry point
│
├── .env.example
├── package.json
└── README.md
```

---

## 🔌 API Endpoints

### Brand Kit (Upload in Add-on Panel)

| Method   | Endpoint            | Description         |
| -------- | ------------------- | ------------------- |
| `POST`   | `/api/brandkit`     | Create brand kit    |
| `GET`    | `/api/brandkit/:id` | Get brand kit       |
| `PUT`    | `/api/brandkit/:id` | Update brand kit    |
| `DELETE` | `/api/brandkit/:id` | Archive brand kit   |
| `GET`    | `/api/brandkit`     | List all brand kits |

### Design (Canvas Data from Adobe Express)

| Method | Endpoint          | Description   |
| ------ | ----------------- | ------------- |
| `POST` | `/api/design`     | Submit design |
| `GET`  | `/api/design/:id` | Get design    |
| `GET`  | `/api/designs`    | List designs  |

### Analysis (Core Feature)

| Method | Endpoint                | Description            |
| ------ | ----------------------- | ---------------------- |
| `POST` | `/api/analysis/run`     | **Run brand analysis** |
| `GET`  | `/api/analysis/:id`     | Get analysis result    |
| `GET`  | `/api/analysis/history` | Get analysis history   |

### Auto-Fix

| Method | Endpoint               | Description      |
| ------ | ---------------------- | ---------------- |
| `POST` | `/api/autofix/apply`   | Apply auto-fixes |
| `POST` | `/api/autofix/preview` | Preview fixes    |

### Analytics

| Method | Endpoint               | Description           |
| ------ | ---------------------- | --------------------- |
| `GET`  | `/api/analytics`       | Get aggregated stats  |
| `GET`  | `/api/analytics/quick` | Quick dashboard stats |

### Reports

| Method | Endpoint               | Description     |
| ------ | ---------------------- | --------------- |
| `POST` | `/api/report/generate` | Generate report |
| `GET`  | `/api/report/:id`      | Get report      |
| `GET`  | `/api/report`          | List reports    |

---

## 📦 Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "message": "Error description"
}
```

---

## 🎨 Adobe Express Add-on → Backend Flow

```
┌─────────────────────────────────────────────────────┐
│                 Adobe Express Add-on                 │
├─────────────────────────────────────────────────────┤
│  1. User opens Add-on panel                         │
│  2. User uploads Brand Kit (colors, fonts, rules)   │
│  3. User clicks "Analyze Design"                    │
│  4. Add-on reads canvas data (colors, fonts, text)  │
│  5. Add-on sends data to backend                    │
│  6. Backend returns compliance score + violations   │
│  7. Add-on displays results in panel                │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Epsilon Backend                   │
├─────────────────────────────────────────────────────┤
│  POST /api/brandkit   → Create brand kit            │
│  POST /api/design     → Submit canvas data          │
│  POST /api/analysis/run → Run compliance check      │
│  POST /api/autofix/apply → Apply suggested fixes    │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  Gemini AI Service                   │
├─────────────────────────────────────────────────────┤
│  • Structured prompts with brand kit + design JSON  │
│  • Returns compliance score (0-100)                 │
│  • Identifies violations with severity             │
│  • Suggests specific fixes                         │
│  • Mock mode available for development             │
└─────────────────────────────────────────────────────┘
```

---

## 🧠 Gemini Integration Strategy

### Prompt Structure

The Gemini service uses structured prompts with:

1. **Brand Kit JSON** - All brand rules (colors, fonts, logo rules, etc.)
2. **Design JSON** - Canvas data from Adobe Express
3. **Weighted scoring rubric** (colors: 30%, fonts: 25%, logo: 20%, accessibility: 15%, tone: 10%)
4. **Required JSON output format** for consistent parsing

### Mock Mode

Set `USE_MOCK_AI=true` in `.env` to use mock responses during development.
Mock responses:

- Follow exact same structure as real Gemini responses
- Include realistic violations based on input data
- Enable development without API key

### Real API Integration

Set `USE_MOCK_AI=false` and provide `GEMINI_API_KEY` to use actual Gemini API.
The prompt structure is production-ready and tested.

---

## 🔢 Compliance Scoring

### Weight Distribution

| Category      | Weight | Description              |
| ------------- | ------ | ------------------------ |
| Color         | 30%    | Brand palette compliance |
| Typography    | 25%    | Approved font usage      |
| Logo          | 20%    | Size, ratio, clear space |
| Accessibility | 15%    | WCAG contrast, alt text  |
| Tone          | 10%    | Language, banned words   |

### Score Interpretation

| Score  | Label      | Meaning                    |
| ------ | ---------- | -------------------------- |
| 90-100 | Excellent  | Fully brand compliant      |
| 70-89  | Good       | Minor issues, easily fixed |
| 50-69  | Needs Work | Multiple violations        |
| 0-49   | Poor       | Major revisions needed     |

---

## 📊 Example: Running Analysis

### 1. Create Brand Kit

```bash
curl -X POST http://localhost:3000/api/brandkit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp Brand Kit",
    "colors": [
      { "name": "Primary Blue", "hex": "#1A73E8", "tolerance": 10 },
      { "name": "White", "hex": "#FFFFFF", "tolerance": 5 }
    ],
    "fonts": [
      { "name": "Roboto", "usage": "heading" },
      { "name": "Open Sans", "usage": "body" }
    ],
    "logoRules": {
      "minWidth": 100,
      "minHeight": 50
    },
    "toneRules": {
      "style": "professional",
      "bannedWords": ["cheap", "free", "guaranteed"]
    }
  }'
```

### 2. Submit Design

```bash
curl -X POST http://localhost:3000/api/design \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "exp_canvas_123",
    "colorsUsed": ["#1A73E8", "#FF5733", "#FFFFFF"],
    "fontsUsed": ["Roboto", "Comic Sans"],
    "textContent": [
      { "text": "Welcome to Acme", "font": "Roboto", "fontSize": 32 },
      { "text": "Buy our cheap products!", "font": "Comic Sans", "fontSize": 16 }
    ],
    "images": [
      { "type": "logo", "width": 80, "height": 40 }
    ]
  }'
```

### 3. Run Analysis

```bash
curl -X POST http://localhost:3000/api/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "brandKitId": "<brand_kit_id>",
    "designId": "<design_id>"
  }'
```

### Example Response

```json
{
  "success": true,
  "data": {
    "complianceScore": 52,
    "scoreLabel": "needs_work",
    "violations": [
      {
        "type": "color",
        "severity": "high",
        "description": "Color #FF5733 is not in the approved brand palette",
        "affectedElement": "#FF5733",
        "suggestedFix": "#1A73E8",
        "autoFixable": true
      },
      {
        "type": "font",
        "severity": "medium",
        "description": "Font \"Comic Sans\" is not in the approved brand typography",
        "affectedElement": "Comic Sans",
        "suggestedFix": "Open Sans",
        "autoFixable": true
      },
      {
        "type": "logo",
        "severity": "high",
        "description": "Logo dimensions (80x40) are below minimum required (100x50)",
        "affectedElement": { "width": 80, "height": 40 },
        "suggestedFix": { "width": 100, "height": 50 },
        "autoFixable": false
      },
      {
        "type": "tone",
        "severity": "high",
        "description": "Banned word \"cheap\" found in text",
        "affectedElement": "cheap",
        "suggestedFix": "Remove or replace banned words",
        "autoFixable": false
      }
    ],
    "summary": "Design needs attention. Multiple brand guideline violations detected."
  },
  "message": "Brand analysis completed successfully"
}
```

---

## 🔧 Environment Variables

| Variable          | Description               | Default                                       |
| ----------------- | ------------------------- | --------------------------------------------- |
| `PORT`            | Server port               | `3000`                                        |
| `NODE_ENV`        | Environment               | `development`                                 |
| `MONGODB_URI`     | MongoDB connection string | `mongodb://localhost:27017/brandguard`        |
| `GEMINI_API_KEY`  | Google Gemini API key     | -                                             |
| `USE_MOCK_AI`     | Use mock AI responses     | `true`                                        |
| `ALLOWED_ORIGINS` | CORS allowed origins      | `http://localhost:5173,http://localhost:3000` |

---

## 🏗️ Architecture Decisions

1. **No logic in routes** - Routes only define endpoints and map to controllers
2. **Controllers orchestrate** - Controllers handle HTTP concerns, delegate to services
3. **Services contain logic** - All business logic lives in services
4. **Gemini service isolated** - Easy to swap AI providers or mock for testing
5. **Modular compliance checks** - Each check type (color, font, etc.) is a separate service
6. **Consistent response format** - All endpoints return `{ success, data, message }`

---

## 📜 License

MIT License - Built for Adobe Express Hackathon
