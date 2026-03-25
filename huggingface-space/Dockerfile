FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY hyper_crawler.mjs .

# Hugging Face Spaces REQUIRES port 7860 to be exposed for Health Checks
EXPOSE 7860

# MANDATORY FIX: Node 20 on Alpine Linux has an IPv6 DNS resolution bug that causes "fetch failed". This forces IPv4.
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

CMD ["npm", "start"]
