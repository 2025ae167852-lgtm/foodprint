# Cloudinary Configuration Guide

## Environment Variables Required

To use Cloudinary for file storage, you need to set up the following environment variables:

### Required Cloudinary Variables:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Optional Variables:

```bash
# Alternative: You can use CLOUDINARY_URL instead of individual variables
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Default QR code logo URL (if no file is uploaded)
DEFAULT_QR_LOGO_URL=https://your-default-logo-url.com/logo.png
```

## How to Get Cloudinary Credentials

1. Sign up for a free Cloudinary account at https://cloudinary.com
2. Go to your Dashboard
3. Copy the following values:
   - Cloud Name
   - API Key
   - API Secret

## Migration from AWS/DigitalOcean

The project has been migrated from AWS S3/DigitalOcean Spaces to Cloudinary. The following changes
were made:

### Files Modified:

- `config/cloudinary/file-upload.js` - New Cloudinary upload helper
- `routes/harvest.js` - Updated to use Cloudinary for image and PDF uploads
- `routes/storage.js` - Updated to use Cloudinary for PDF uploads
- `routes/produce.js` - Updated to use Cloudinary for PDF uploads
- `routes/qrcode.js` - Updated to use Cloudinary for QR code logo uploads
- `routes/auth.js` - Cleaned up AWS references

### Files Removed:

- `config/digitalocean/file-upload.js` - Old AWS/DigitalOcean upload helper
- `tests/test_digitaloceanfileexists.js` - AWS-specific test file

### Dependencies Removed:

- `aws-sdk` - No longer needed
- `multer-s3` - No longer needed

### Dependencies Added/Updated:

- `cloudinary` - For Cloudinary integration
- `multer-storage-cloudinary` - For Cloudinary multer storage

## Installation Commands

Use Yarn to install dependencies:

```bash
# Install all dependencies
yarn install

# Add Cloudinary dependencies (if not already present)
yarn add cloudinary multer-storage-cloudinary

# Remove AWS dependencies (if still present)
yarn remove aws-sdk multer-s3
```

## File Organization in Cloudinary

Files are organized in the following folder structure:

- `foodprint/harvest/` - Harvest images
- `foodprint/harvest/pdfs/` - Harvest PDF reports
- `foodprint/storage/pdfs/` - Storage PDF reports
- `foodprint/produce/pdfs/` - Produce price PDF reports
- `foodprint/qrcodes/` - QR code logos

## Testing the Migration

1. Set up your Cloudinary environment variables
2. Run `yarn install` to install dependencies
3. Start the application with `yarn start` or `yarn dev`
4. Test file uploads in the following areas:
   - Harvest logbook (image uploads)
   - Storage logbook (PDF generation)
   - Produce price reports (PDF generation)
   - QR code generation (logo uploads)

## Troubleshooting

### Common Issues:

1. **"Cloudinary not configured" error**
   - Check that all required environment variables are set
   - Verify your Cloudinary credentials are correct

2. **Upload failures**
   - Check your Cloudinary account limits
   - Verify file size limits (Cloudinary free tier has limits)
   - Check file format support

3. **File not found errors**
   - Ensure the file was uploaded successfully
   - Check the Cloudinary dashboard for uploaded files
   - Verify the URL format is correct

### Support:

- Cloudinary Documentation: https://cloudinary.com/documentation
- Cloudinary Node.js SDK: https://cloudinary.com/documentation/node_integration
