# porra-deportiva frontend — Vite dev server on Node 20.
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching. No lockfile yet → npm install.
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
