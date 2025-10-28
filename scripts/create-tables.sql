-- Create user table
CREATE TABLE IF NOT EXISTS "user" (
    "ID" SERIAL PRIMARY KEY,
    "firstName" VARCHAR(255),
    "middleName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "email" VARCHAR(255),
    "phoneNumber" VARCHAR(255) NOT NULL UNIQUE,
    "role" VARCHAR(255),
    "password" VARCHAR(255),
    "passwordHash" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "registrationChannel" VARCHAR(255),
    "nationalIdPhotoHash" BYTEA,
    "user_identifier_image_url" VARCHAR(255),
    "passwordResetToken" VARCHAR(255),
    "passwordResetExpires" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "user_email" ON "user" ("email");
CREATE INDEX IF NOT EXISTS "user_phoneNumber" ON "user" ("phoneNumber");

-- Create foodprint_harvest table
CREATE TABLE IF NOT EXISTS "foodprint_harvest" (
    "pk" SERIAL PRIMARY KEY,
    "harvest_logid" VARCHAR(255),
    "harvest_supplierShortcode" VARCHAR(255),
    "harvest_supplierName" VARCHAR(255),
    "harvest_farmerName" VARCHAR(255),
    "harvest_supplierAddress" VARCHAR(255),
    "harvest_produceName" VARCHAR(255),
    "harvest_photoHash" BYTEA,
    "harvest_TimeStamp" TIMESTAMP,
    "harvest_CaptureTime" TIMESTAMP,
    "harvest_Description" VARCHAR(1000),
    "harvest_geolocation" VARCHAR(255),
    "harvest_quantity" VARCHAR(255),
    "harvest_unitOfMeasure" VARCHAR(255),
    "harvest_description_json" VARCHAR(1000),
    "harvest_BlockchainHashID" VARCHAR(255),
    "harvest_BlockchainHashData" VARCHAR(2000),
    "supplierproduce" VARCHAR(255),
    "harvest_bool_added_to_blockchain" VARCHAR(255),
    "harvest_added_to_blockchain_date" TIMESTAMP,
    "harvest_added_to_blockchain_by" VARCHAR(255),
    "harvest_blockchain_uuid" VARCHAR(255),
    "blockchain_explorer_url" VARCHAR(255),
    "harvest_user" VARCHAR(255),
    "logdatetime" TIMESTAMP,
    "lastmodifieddatetime" TIMESTAMP,
    "year_established" VARCHAR(255),
    "covid19_response" VARCHAR(255),
    "twilio_url" VARCHAR(255),
    "channel" VARCHAR(255),
    "harvest_image_url" VARCHAR(255)
);

-- Create foodprint_storage table (simplified)
CREATE TABLE IF NOT EXISTS "foodprint_storage" (
    "pk" SERIAL PRIMARY KEY,
    "storage_logid" VARCHAR(255),
    "storage_user" VARCHAR(255),
    "storage_qrcode_url" VARCHAR(255),
    "logdatetime" TIMESTAMP
);

-- Add more tables as needed...

