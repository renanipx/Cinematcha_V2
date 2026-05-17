FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# Bind to 0.0.0.0 to make the dev server accessible outside the Docker container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
