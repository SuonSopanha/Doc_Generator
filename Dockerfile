# Use the official Node.js image as the base
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Next.js app
RUN npm run build

# Production stage with a smaller image
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Copy the Next.js build output from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Expose the Next.js port
EXPOSE 3000

# Start Next.js in production mode
CMD ["npm", "start"]
