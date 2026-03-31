# FarmTrace Email Setup Guide (Forgot Password Feature)

## Quick Start (Gmail - 5 minutes)

### Step 1: Enable 2-Step Verification
```
Go to: https://myaccount.google.com/security
1. Left side में "Security" click करो
2. Scroll down → "2-Step Verification" 
3. Click करके enable करो (पहले से enabled है तो skip करो)
```

### Step 2: Create Gmail App Password
```
Go to: https://myaccount.google.com/apppasswords
1. Login करो same Gmail account से
2. Top से select करो: Device = "Windows Computer" (या Mac)
3. App = "Mail"
4. "Generate" click करो
5. **16-character password मिलेगा** जैसे:
   qwer tyui asdf ghjk
```

### Step 3: Update Backend .env File
```bash
# File path: backend/.env

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=qwer tyui asdf ghjk
MAIL_FROM=FarmTrace <your-email@gmail.com>
```

**IMPORTANT:**
- `SMTP_PASS` = 16-character password from Step 2
- Spaces include करो password में (copy-paste करते समय)
- `SMTP_USER` = आपका Gmail address
- `MAIL_FROM` = "FarmTrace <your-email@gmail.com>" format में

---

## Testing करो:

### Option 1: Production में Test (सीधे app से)
```
1. Frontend खोलो: https://farmtrace-bay.vercel.app
2. Login करो
3. Forgot Password link click करो
4. अपना email डालो
5. Check करो inbox में email आयी या नहीं
```

### Option 2: Development में Test
```bash
# Backend start करो
cd backend
node index.js

# Frontend खोलो (dev server):
cd frontend
npm start

# अब http://localhost:3000 में test करो
```

**Dev Mode में क्या होगा:**
- अगर SMTP configured है → Email भेजी जाएगी
- अगर SMTP नहीं है → Backend console में reset link print होगा:
  ```
  SMTP configure nahi hai. Reset link: 
  https://localhost:3000/reset-password/a1b2c3d4...
  ```

---

## Code क्या करता है?

### When User clicks "Forgot Password":
1. **Frontend** → Email input field दिखाता है
2. User email डालता है
3. **Backend** `/api/auth/forgot-password` को POST request भेजता है
4. **Backend**:
   - Email से user ढूंढता है
   - Secure random token generate करता है (crypto.randomBytes)
   - Token को SHA256 से hash करके DB में save करता है
   - Token expiry = 15 minutes
   - nodemailer से email भेजता है
5. **Email** में link होता है:
   ```
   https://farmtrace-bay.vercel.app/reset-password/[TOKEN]
   ```
6. User email खोलकर link click करता है
7. **Frontend** `/reset-password/[TOKEN]` page खोलता है
8. User नया password enter करता है
9. **Backend** token verify करके password reset करता है

---

## Alternative Free SMTP Services

### Mailtrap (Testing के लिए बेहतरीन)
```
Website: https://mailtrap.io
1. Sign up करो (free)
2. Email testing inbox मिलेगा
3. Settings से SMTP credentials copy करो
4. .env में paste करो

SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
```

### SendGrid (Production के लिए बेहतर)
```
Website: https://sendgrid.com
1. Free account बना (100 emails/day)
2. API key generate करो
3. Settings → API Keys

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxx...
```

### Brevo (सबसे ज्यादा free quota - 300/day)
```
Website: https://www.brevo.com
1. Sign up करो
2. 300 free emails per day
3. SMTP credentials मिलेंगे
```

---

## Troubleshooting

### Email नहीं आ रहा?
```
1. Check करो .env में variables सही हैं
2. Gmail की 2-Step Verification on है?
3. App Password सही (spaces include करके) है?
4. Backend restart करो:
   cd backend
   node index.js
5. Browser console में क्या error है देख
```

### "Invalid credentials" error आ रहा है?
```
- Gmail password गलत है
- 16-character app password नहीं है (normal password use किया?)
- Gmail account lock है? (unusual login से)
  → Gmail पर जाओ → "Your Google Account was accessed" → "It was me"
```

### SMTP options सही हैं पर email नहीं भेज रहा?
```
- Gmail less secure apps के लिए allow करना छोड़ सकता है
- Try करो: https://accounts.google.com/b/0/DisplayUnlockCaptcha
- फिर से 16-character app password बनाओ
```

---

## Code में यह सब पहले से है:

File: `backend/routes/auth.js`

```javascript
const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const createMailTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Boolean(process.env.SMTP_SECURE),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Automatically checks if SMTP is configured
// If not, logs reset URL to console instead
```

---

## Next Steps:
1. ✅ Gmail account से app password generate करो
2. ✅ Backend .env में variables add करो
3. ✅ Backend restart करो (`node index.js`)
4. ✅ Frontend में forgot password test करो
5. ✅ Email inbox check करो

**Bas! Password reset feature live हो जाएगा! 🚀**
