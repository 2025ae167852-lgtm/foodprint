# Use official Node.js 14 image
FROM node:14

# Set working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock first to leverage caching
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Expose port (change if your app runs on a different port)
EXPOSE 3000

# Set environment variable for Node.js
ENV NODE_ENV=production

# Default command to run your server
CMD ["node", "server.js"]
