# Use Node.js LTS version
FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create output directory
RUN mkdir -p output

# Set environment variables
ENV NODE_ENV=production

# Volume for output directory
VOLUME ["/app/output"]

# Command to run the application (will be overridden by docker run)
CMD ["npm", "run", "test:amoy"] 