# Use Microsoft Playwright base image (pre-installed browsers & deps)
FROM mcr.microsoft.com/playwright:v1.58.2-noble

# Set working directory
WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Build the frontend
RUN npm run build

# Expose port (Cloud Run sets PORT env var automatically)
EXPOSE 8080

# Environment variables (these can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=8080

# Start it up using tsx directly (simplest for a prototype)
CMD ["npx", "tsx", "src/server/agent.ts"]
