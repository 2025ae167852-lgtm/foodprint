# Use Node 18 LTS (compatible with connect-pg-simple and modern packages)
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock first to leverage Docker caching
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of the project files
COPY . .

# Expose port (update if your server uses a different port)
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Default command to start your server
CMD ["node", "server.js"]
