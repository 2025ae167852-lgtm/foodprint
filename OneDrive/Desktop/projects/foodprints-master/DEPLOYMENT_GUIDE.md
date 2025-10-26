# Deployment Guide for FoodPrint to Render

## Prerequisites

1. A Render account (https://render.com)
2. A GitHub repository for your code
3. Environment variables configured

## Steps to Deploy

### 1. Push to GitHub

First, make sure you have a GitHub repository set up:

```bash
# Add remote repository (if not already added)
git remote add origin https://github.com/yourusername/your-repo.git

# Push your code
git push -u origin master
```

### 2. Create a New Web Service on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository and branch (master)

### 3. Configure Build Settings

Use these settings:

- **Name:** foodprints (or your preferred name)
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

### 4. Environment Variables

Add these environment variables in the Render dashboard:

**Required:**

- `DATABASE_URL` - Your MySQL/PostgreSQL database connection string
- `NODE_ENV` - Set to `production`
- `SESSION_SECRET` - A random secret string for session management

**Optional but Recommended:**

- `EMAIL_ENABLED` - Set to `true` to enable email functionality
- `EMAIL_HOST` - SMTP host
- `EMAIL_PORT` - SMTP port
- `EMAIL_ADDRESS` - SMTP username/email
- `WEBAPP_PASSWORD` - SMTP password
- `CLOUDINARY_URL` - Cloudinary configuration URL
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token

### 5. Database Setup

Set up your database on Render:

1. Go to "New +" → "PostgreSQL" or "MySQL"
2. Copy the Internal Database URL
3. Use this as your `DATABASE_URL` environment variable

### 6. Health Check

The server should automatically detect:

- Root route `/` - Landing page
- `/app/auth/login` - Login page
- `/app/auth/register` - Registration page

### 7. Deploy

Click "Create Web Service" and Render will:

1. Build your application
2. Install dependencies
3. Start the server
4. Make it available on a public URL

## Post-Deployment

### Check Logs

Monitor the deployment logs to ensure:

- All routes mount successfully
- Database connection established
- No error messages

### Test Endpoints

- `/app/harvest` - Should redirect to login if not authenticated
- `/app/storage` - Should redirect to login if not authenticated
- `/app/produce` - Should redirect to login if not authenticated

### Common Issues

1. **Database Connection Errors**
   - Check `DATABASE_URL` is correct
   - Ensure database is accessible from Render's network
2. **PDF Service Warnings**
   - This is expected if pdfkit is not installed
   - Routes will still work without PDF generation

3. **Email Errors**
   - Configure email environment variables
   - Or set `EMAIL_ENABLED=false` to disable

## Monitoring

View logs in real-time:

1. Go to your service in Render dashboard
2. Click "Logs" tab
3. Monitor for errors and successful deployments

## Updates

To deploy updates:

```bash
git add .
git commit -m "Your changes"
git push origin master
```

Render will automatically redeploy when you push to the master branch.
