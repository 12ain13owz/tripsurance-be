# Use Node.js as base image
FROM node:24.19.0-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies — needed for the build
# step below; NODE_ENV=production isn't set yet, so npm ci installs them).
RUN npm ci

# Copy the rest of the application
COPY . .

# Compile TypeScript during image build (build stage has more memory available
# than the running instance) — avoids OOM on small/free hosting plans at startup.
RUN npm run build

# Default to production so a plain `docker run` / `docker compose up` behaves
# like a real deployment (e.g. Render) instead of dev/watch mode. Override
# with `-e NODE_ENV=development` if you want dev behavior in a container.
# Set after the build step so devDependencies (rimraf, typescript) were
# available to `npm run build` above.
ENV NODE_ENV=production

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]