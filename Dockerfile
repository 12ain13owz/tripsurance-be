# Use Node.js as base image
FROM node:24.19.0-alpine

# Default to production so a plain `docker run` / `docker compose up` behaves
# like a real deployment (e.g. Render) instead of dev/watch mode. Override
# with `-e NODE_ENV=development` if you want dev behavior in a container.
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Compile TypeScript during image build (build stage has more memory available
# than the running instance) — avoids OOM on small/free hosting plans at startup.
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]